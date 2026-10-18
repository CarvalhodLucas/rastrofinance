import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Camera, Plus, Search, FileSpreadsheet, Repeat, Receipt } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { TransactionRow } from '@/components/dashboard/TransactionList';
import { TransactionDrawer } from '@/components/transactions/TransactionDrawer';
import { AddTransactionModal } from '@/components/transactions/AddTransactionModal';
import { ImportStatementModal } from '@/components/transactions/ImportStatementModal';
import { SubscriptionsTab } from '@/components/transactions/SubscriptionsTab';
import { ManageCategoriesModal } from '@/components/categories/ManageCategoriesModal';
import { useTransactions } from '@/hooks/useTransactions';
import { useAccounts } from '@/hooks/usePluggy';
import { useCategories } from '@/hooks/useCategories';
import { dateGroupLabel } from '@/lib/format';
import { useFmt } from '@/contexts/CurrencyContext';
import type { Transaction } from '@/types/finance';

function monthOptions(): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    opts.push({ value, label });
  }
  return opts;
}

export function Transactions() {
  const fmt = useFmt();
  const months = useMemo(monthOptions, []);
  const [month, setMonth] = useState(months[0]?.value);
  const [category, setCategory] = useState('');
  const [account, setAccount] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [txToEdit, setTxToEdit] = useState<Transaction | null>(null);
  const [autoScanReceipt, setAutoScanReceipt] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'extrato' | 'subscriptions'>('extrato');
  const [manageCatOpen, setManageCatOpen] = useState(false);

  const { categoryNames } = useCategories();

  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('import') === 'true') {
      setImportOpen(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [location]);

  const { accounts } = useAccounts();
  const { transactions, loading, error, reload } = useTransactions({
    month: activeSubTab === 'subscriptions' ? undefined : month,
    category: category || undefined,
    account: account || undefined,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return transactions;
    const q = search.toLowerCase();
    return transactions.filter(
      (t) =>
        t.description.toLowerCase().includes(q) ||
        (t.merchant_name ?? '').toLowerCase().includes(q),
    );
  }, [transactions, search]);

  const total = useMemo(
    () => filtered.reduce((acc, t) => acc + t.amount, 0),
    [filtered],
  );

  // Agrupa por data.
  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of filtered) {
      const arr = map.get(t.date) ?? [];
      arr.push(t);
      map.set(t.date, arr);
    }
    return Array.from(map.entries()).sort(
      ([a], [b]) => new Date(b).getTime() - new Date(a).getTime(),
    );
  }, [filtered]);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Sub-Abas de Navegação */}
      <div className="flex border-b border-border bg-bg-elevated/10 px-3 sm:px-6 shrink-0 overflow-x-auto no-scrollbar">
        <button
          onClick={() => setActiveSubTab('extrato')}
          className={`flex items-center gap-2 px-3 sm:px-4 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeSubTab === 'extrato'
              ? 'border-accent-gold text-accent-gold'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <Receipt className="h-4 w-4 shrink-0" />
          <span>Extrato e Lançamentos</span>
        </button>
        <button
          onClick={() => setActiveSubTab('subscriptions')}
          className={`flex items-center gap-2 px-3 sm:px-4 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors cursor-pointer whitespace-nowrap ${
            activeSubTab === 'subscriptions'
              ? 'border-accent-gold text-accent-gold'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          <Repeat className="h-4 w-4 shrink-0" />
          <span>Assinaturas e Recorrências</span>
        </button>
      </div>

      {/* Conteúdo Principal */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-8 space-y-4 sm:space-y-5">
        {activeSubTab === 'subscriptions' ? (
          <SubscriptionsTab
            allTransactions={transactions}
            accounts={accounts}
            onReload={() => void reload()}
            onEditSubscription={(sub) => {
              setTxToEdit(sub);
              setAutoScanReceipt(false);
              setAddOpen(true);
            }}
            onOpenAddModal={() => {
              setTxToEdit(null);
              setAutoScanReceipt(false);
              setAddOpen(true);
            }}
          />
        ) : (
          <>
            {/* Header Extrato */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base sm:text-lg font-semibold text-text-primary">Transações</h2>
              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setImportOpen(true)}
                  className="border-accent-gold/40 text-accent-gold hover:bg-accent-gold/10 gap-1.5 text-xs h-9"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">Extrato em Lote</span>
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setTxToEdit(null);
                    setAutoScanReceipt(true);
                    setAddOpen(true);
                  }}
                  className="gap-1.5 text-xs h-9"
                >
                  <Camera className="h-3.5 w-3.5 text-accent-gold shrink-0" />
                  <span className="truncate">Recibo Único</span>
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setTxToEdit(null);
                    setAutoScanReceipt(false);
                    setAddOpen(true);
                  }}
                  className="col-span-2 sm:col-span-1 gap-1.5 font-bold text-xs h-9"
                >
                  <Plus className="h-4 w-4 shrink-0" />
                  <span>Nova Transação</span>
                </Button>
              </div>
            </div>

            {/* Filtros */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-center gap-2">
              <Select value={month ?? ''} onChange={setMonth}>
                {months.map((m) => (
                  <option key={m.value} value={m.value} className="capitalize">
                    {m.label}
                  </option>
                ))}
              </Select>
              <Select value={account} onChange={setAccount}>
                <option value="">Todas as contas</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.institution_name}
                  </option>
                ))}
              </Select>
              <div className="flex items-center gap-1 w-full sm:w-auto">
                <div className="flex-1 sm:w-auto">
                  <Select value={category} onChange={setCategory}>
                    <option value="">Todas as categorias</option>
                    {categoryNames.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </Select>
                </div>
                <button
                  type="button"
                  onClick={() => setManageCatOpen(true)}
                  title="Gerenciar Categorias (Criar ou Excluir)"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-accent-gold/40 bg-accent-gold/10 text-accent-gold hover:bg-accent-gold hover:text-black transition-colors cursor-pointer"
                >
                  <Plus className="h-4 w-4 font-bold" />
                </button>
              </div>
              <div className="relative flex-1 min-w-full sm:min-w-[160px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar…"
                  className="h-10 w-full rounded-lg border border-border bg-bg-card pl-9 pr-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent-gold focus:outline-none"
                />
              </div>
            </div>

            {/* Resumo do filtro */}
            {!loading && !error && (
              <div className="flex items-center justify-between rounded-lg border border-border bg-bg-card px-4 py-2.5 text-sm">
                <span className="text-text-secondary">
                  {filtered.length} transações
                </span>
                <span
                  className={`font-mono font-semibold tnum ${total >= 0 ? 'text-accent-green' : 'text-accent-red'}`}
                >
                  Total: {total >= 0 ? '+' : '-'}
                  {fmt(Math.abs(total))}
                </span>
              </div>
            )}

            {error ? (
              <ErrorState message={error} onRetry={reload} />
            ) : loading ? (
              <Card>
                <CardContent className="space-y-2 pt-5">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </CardContent>
              </Card>
            ) : groups.length === 0 ? (
              <EmptyState
                title="Nenhuma transação encontrada para este período."
                description="Ajuste os filtros ou conecte uma conta bancária para começar."
              />
            ) : (
              <div className="space-y-5">
                {groups.map(([date, txs]) => {
                  const dayTotal = txs.reduce((acc, t) => acc + t.amount, 0);
                  return (
                    <div key={date}>
                      <div className="mb-1.5 flex items-center justify-between px-1">
                        <h3 className="text-sm font-semibold text-text-primary">
                          {dateGroupLabel(date)}
                        </h3>
                        <span
                          className={`font-mono text-xs tnum ${dayTotal >= 0 ? 'text-accent-green' : 'text-accent-red'}`}
                        >
                          {dayTotal >= 0 ? '+' : '-'}
                          {fmt(Math.abs(dayTotal))}
                        </span>
                      </div>
                      <Card>
                        <CardContent className="py-2">
                          <div className="divide-y divide-border/60">
                            {txs.map((tx) => (
                              <TransactionRow
                                key={tx.id}
                                tx={tx}
                                onClick={setSelected}
                              />
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <TransactionDrawer
        transaction={selected}
        onClose={() => setSelected(null)}
        onUpdated={(tx) => {
          setSelected(tx);
          void reload();
        }}
        onEdit={(tx) => {
          setSelected(null);
          setTxToEdit(tx);
          setAddOpen(true);
        }}
        onDeleted={() => {
          void reload();
        }}
      />

      <AddTransactionModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => void reload()}
        accounts={accounts}
        autoTriggerScan={autoScanReceipt}
        transactionToEdit={txToEdit}
      />

      <ImportStatementModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => void reload()}
        accounts={accounts}
      />

      <ManageCategoriesModal
        open={manageCatOpen}
        onClose={() => setManageCatOpen(false)}
      />
    </div>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-10 cursor-pointer rounded-lg border border-border bg-bg-card px-3 text-sm capitalize text-text-primary focus:border-accent-gold focus:outline-none"
    >
      {children}
    </select>
  );
}
