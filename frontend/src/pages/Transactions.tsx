import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Camera,
  Plus,
  Search,
  FileSpreadsheet,
  Repeat,
  Receipt,
  ArrowUpDown,
  Landmark,
  Wallet,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  Check,
  RotateCcw,
  SlidersHorizontal,
  Layers,
} from 'lucide-react';
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
import { useToast } from '@/components/ui/Toast';
import { useTransactions } from '@/hooks/useTransactions';
import { useAccounts } from '@/hooks/usePluggy';
import { useCategories } from '@/hooks/useCategories';
import { dateGroupLabel } from '@/lib/format';
import { useFmt, useFmtRaw } from '@/contexts/CurrencyContext';
import { cn } from '@/lib/utils';
import type { ConnectedAccount, Transaction } from '@/types/finance';

const BANK_TABS_ORDER_KEY = 'rastro_bank_tabs_order';

function loadSavedTabOrder(): string[] {
  try {
    const raw = localStorage.getItem(BANK_TABS_ORDER_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function saveTabOrder(order: string[]): void {
  try {
    localStorage.setItem(BANK_TABS_ORDER_KEY, JSON.stringify(order));
  } catch {}
}

function getBankTabLabel(acc: ConnectedAccount, allAccounts: ConnectedAccount[]): string {
  if (acc.institution_name.toLowerCase() === 'dinheiro') {
    return 'Dinheiro';
  }
  const sameInstCount = allAccounts.filter(
    (a) => a.institution_name.toLowerCase() === acc.institution_name.toLowerCase(),
  ).length;
  if (sameInstCount > 1 && acc.account_name && acc.account_name.toLowerCase() !== acc.institution_name.toLowerCase()) {
    return `${acc.institution_name} (${acc.account_name})`;
  }
  return acc.institution_name || acc.account_name;
}

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
  const fmtRaw = useFmtRaw();
  const { notify } = useToast();
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

  // Estado para organização da ordem das abas de bancos
  const [tabOrder, setTabOrder] = useState<string[]>(loadSavedTabOrder);
  const [isOrganizingTabs, setIsOrganizingTabs] = useState(false);
  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const initialTabAppliedRef = useRef(false);

  const { categoryNames } = useCategories();

  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('import') === 'true') {
      setImportOpen(true);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [location]);

  const { accounts: rawAccounts } = useAccounts();
  const accounts = useMemo(
    () => rawAccounts.filter((a) => a.is_active !== false),
    [rawAccounts],
  );

  // Busca transações do mês/categoria e filtra por banco na memória para troca instantânea de abas e contadores por banco
  const { transactions: allMonthTransactions, loading, error, reload } = useTransactions({
    month: activeSubTab === 'subscriptions' ? undefined : month,
    category: category || undefined,
  });

  // Lista ordenada de IDs de abas ('ALL' + IDs das contas ativas)
  const orderedTabIds = useMemo(() => {
    const validIds = new Set(['ALL', ...accounts.map((a) => a.id)]);
    const result: string[] = [];

    for (const id of tabOrder) {
      if (validIds.has(id) && !result.includes(id)) {
        result.push(id);
      }
    }
    if (!result.includes('ALL')) {
      result.push('ALL');
    }
    for (const acc of accounts) {
      if (!result.includes(acc.id)) {
        result.push(acc.id);
      }
    }
    return result;
  }, [accounts, tabOrder]);

  // Se o usuário colocou um banco específico como 1ª aba da lista, abre nele inicialmente
  useEffect(() => {
    if (initialTabAppliedRef.current || accounts.length === 0) return;
    initialTabAppliedRef.current = true;
    const firstTab = orderedTabIds[0];
    if (firstTab && firstTab !== 'ALL') {
      setAccount(firstTab);
    }
  }, [accounts, orderedTabIds]);

  const updateAndSaveTabOrder = (nextOrder: string[]) => {
    setTabOrder(nextOrder);
    saveTabOrder(nextOrder);
  };

  const moveTab = (tabId: string, direction: 'left' | 'right') => {
    const current = [...orderedTabIds];
    const idx = current.indexOf(tabId);
    if (idx === -1) return;
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= current.length) return;
    const temp = current[idx]!;
    current[idx] = current[targetIdx]!;
    current[targetIdx] = temp;
    updateAndSaveTabOrder(current);
  };

  const moveTabToFirst = (tabId: string) => {
    const current = orderedTabIds.filter((id) => id !== tabId);
    updateAndSaveTabOrder([tabId, ...current]);
    notify('Aba movida para a 1ª posição!', 'success');
  };

  const resetTabOrder = () => {
    const def = ['ALL', ...accounts.map((a) => a.id)];
    updateAndSaveTabOrder(def);
    notify('Ordem padrão das abas restaurada.', 'info');
  };

  const handleDropTab = (targetTabId: string) => {
    if (!draggedTabId || draggedTabId === targetTabId) {
      setDraggedTabId(null);
      setDragOverTabId(null);
      return;
    }
    const current = [...orderedTabIds];
    const fromIdx = current.indexOf(draggedTabId);
    const toIdx = current.indexOf(targetTabId);
    if (fromIdx !== -1 && toIdx !== -1) {
      current.splice(fromIdx, 1);
      current.splice(toIdx, 0, draggedTabId);
      updateAndSaveTabOrder(current);
    }
    setDraggedTabId(null);
    setDragOverTabId(null);
  };

  // Contagem de transações por banco (considerando a busca atual)
  const searchMatchedTransactions = useMemo(() => {
    if (!search.trim()) return allMonthTransactions;
    const q = search.toLowerCase();
    return allMonthTransactions.filter(
      (t) =>
        t.description.toLowerCase().includes(q) ||
        (t.merchant_name ?? '').toLowerCase().includes(q) ||
        Boolean(
          t.sub_transactions?.some(
            (st) =>
              st.description.toLowerCase().includes(q) ||
              (st.category ?? '').toLowerCase().includes(q),
          ),
        ),
    );
  }, [allMonthTransactions, search]);

  const txCountByAccount = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of searchMatchedTransactions) {
      if (t.account_id) {
        map.set(t.account_id, (map.get(t.account_id) ?? 0) + 1);
      }
    }
    return map;
  }, [searchMatchedTransactions]);

  const filtered = useMemo(() => {
    if (!account) return searchMatchedTransactions;
    return searchMatchedTransactions.filter((t) => t.account_id === account);
  }, [searchMatchedTransactions, account]);

  const selectedAccountObj = useMemo(
    () => (account ? accounts.find((a) => a.id === account) ?? null : null),
    [accounts, account],
  );

  const total = useMemo(
    () => filtered.reduce((acc, t) => acc + t.amount, 0),
    [filtered],
  );

  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Agrupa por data e ordena rigorosamente por horário dentro de cada dia.
  const groups = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of filtered) {
      const arr = map.get(t.date) ?? [];
      arr.push(t);
      map.set(t.date, arr);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => {
        const timeA = new Date(`${a}T00:00:00`).getTime();
        const timeB = new Date(`${b}T00:00:00`).getTime();
        return sortOrder === 'desc' ? timeB - timeA : timeA - timeB;
      })
      .map(([date, txs]) => [
        date,
        [...txs].sort((a, b) => {
          const tA = a.created_at ? new Date(a.created_at).getTime() : new Date(`${a.date}T00:00:00`).getTime();
          const tB = b.created_at ? new Date(b.created_at).getTime() : new Date(`${b.date}T00:00:00`).getTime();
          return sortOrder === 'desc' ? tB - tA : tA - tB;
        }),
      ] as [string, Transaction[]]);
  }, [filtered, sortOrder]);

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
            allTransactions={allMonthTransactions}
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

            {/* ================================================================= */}
            {/* ABAS POR BANCO (COM DRAG & DROP E ORGANIZADOR DE ORDEM DAS ABAS)  */}
            {/* ================================================================= */}
            <div className="rounded-2xl border border-border bg-bg-card/80 p-2 sm:p-2.5 space-y-2.5 shadow-xs">
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2 min-w-0">
                  <Landmark className="h-3.5 w-3.5 text-accent-gold shrink-0" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-text-secondary truncate">
                    Abas por Banco / Conta
                  </span>
                  <span className="hidden sm:inline text-[10px] text-text-muted">
                    (Arraste uma aba ou clique em &ldquo;Organizar Abas&rdquo; para mudar a ordem)
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setIsOrganizingTabs((prev) => !prev)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer shrink-0 select-none',
                    isOrganizingTabs
                      ? 'border-accent-gold bg-accent-gold text-black shadow-xs'
                      : 'border-accent-gold/35 bg-accent-gold/10 text-accent-gold hover:bg-accent-gold/20',
                  )}
                  title="Organizar a ordem das abas dos bancos"
                >
                  {isOrganizingTabs ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      <span>Concluir Ordem</span>
                    </>
                  ) : (
                    <>
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      <span>Organizar Abas</span>
                    </>
                  )}
                </button>
              </div>

              {/* Barra Horizontal de Abas dos Bancos */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {orderedTabIds.map((tabId, index) => {
                  const isAll = tabId === 'ALL';
                  const acc = isAll ? null : accounts.find((a) => a.id === tabId);
                  if (!isAll && !acc) return null;

                  const isActive = isAll ? account === '' : account === tabId;
                  const count = isAll
                    ? searchMatchedTransactions.length
                    : (txCountByAccount.get(tabId) ?? 0);
                  const label = isAll ? 'Todos os Bancos' : getBankTabLabel(acc!, accounts);
                  const accCurr = acc ? (acc.currency || 'BRL').toUpperCase() : 'BRL';
                  const isCash = acc?.institution_name.toLowerCase() === 'dinheiro';
                  const isBeingDragged = draggedTabId === tabId;
                  const isDragTarget = dragOverTabId === tabId && draggedTabId !== tabId;

                  return (
                    <div
                      key={tabId}
                      draggable
                      onDragStart={(e) => {
                        setDraggedTabId(tabId);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragOverTabId !== tabId) {
                          setDragOverTabId(tabId);
                        }
                      }}
                      onDragLeave={() => {
                        if (dragOverTabId === tabId) {
                          setDragOverTabId(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleDropTab(tabId);
                      }}
                      onDragEnd={() => {
                        setDraggedTabId(null);
                        setDragOverTabId(null);
                      }}
                      className={cn(
                        'group relative flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all select-none shrink-0',
                        isActive
                          ? 'border-accent-gold bg-accent-gold/15 text-accent-gold shadow-xs'
                          : 'border-border/80 bg-bg-elevated/50 text-text-secondary hover:border-accent-gold/40 hover:text-text-primary hover:bg-bg-elevated',
                        isBeingDragged && 'opacity-45 scale-95',
                        isDragTarget && 'ring-2 ring-accent-gold border-accent-gold',
                      )}
                    >
                      {/* Controles de mover para esquerda no modo Organizar */}
                      {isOrganizingTabs && (
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveTab(tabId, 'left');
                          }}
                          className="rounded p-0.5 hover:bg-bg-card disabled:opacity-25 text-text-muted hover:text-accent-gold cursor-pointer disabled:cursor-not-allowed"
                          title="Mover aba para a esquerda"
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setAccount(isAll ? '' : tabId)}
                        className="flex items-center gap-2 cursor-pointer text-left"
                      >
                        <GripVertical className="h-3 w-3 text-text-muted/50 group-hover:text-accent-gold/70 cursor-grab shrink-0" />

                        {/* Ícone do Banco */}
                        {isAll ? (
                          <Layers className="h-3.5 w-3.5 shrink-0 text-accent-gold" />
                        ) : isCash ? (
                          <Wallet className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        ) : acc?.institution_logo ? (
                          <img
                            src={acc.institution_logo}
                            alt={acc.institution_name}
                            className="h-4 w-4 rounded-full object-contain shrink-0"
                          />
                        ) : (
                          <Landmark className="h-3.5 w-3.5 shrink-0 text-accent-gold" />
                        )}

                        <div className="flex flex-col items-start leading-tight">
                          <div className="flex items-center gap-1.5">
                            <span className="whitespace-nowrap font-bold">{label}</span>
                            <span
                              className={cn(
                                'inline-flex items-center justify-center rounded-full px-1.5 py-0.2 text-[10px] font-mono font-bold',
                                isActive
                                  ? 'bg-accent-gold text-black'
                                  : 'bg-bg-card text-text-muted border border-border/60',
                              )}
                            >
                              {count}
                            </span>
                          </div>
                          {acc && (
                            <span className="text-[10px] font-mono text-text-muted whitespace-nowrap">
                              {fmtRaw(acc.balance, accCurr)}
                            </span>
                          )}
                        </div>
                      </button>

                      {/* Controles de mover para direita no modo Organizar */}
                      {isOrganizingTabs && (
                        <button
                          type="button"
                          disabled={index === orderedTabIds.length - 1}
                          onClick={(e) => {
                            e.stopPropagation();
                            moveTab(tabId, 'right');
                          }}
                          className="rounded p-0.5 hover:bg-bg-card disabled:opacity-25 text-text-muted hover:text-accent-gold cursor-pointer disabled:cursor-not-allowed"
                          title="Mover aba para a direita"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Painel Expandido de Organização da Ordem das Abas */}
              {isOrganizingTabs && (
                <div className="rounded-xl border border-accent-gold/30 bg-accent-gold/5 p-3 space-y-2.5 animate-in fade-in duration-150">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-accent-gold flex items-center gap-1.5">
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      <span>
                        Organize a ordem das abas (a 1ª aba da lista será aberta por padrão):
                      </span>
                    </p>
                    <button
                      type="button"
                      onClick={resetTabOrder}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-bg-card px-2.5 py-1 text-[11px] font-semibold text-text-secondary hover:text-accent-gold hover:border-accent-gold/40 transition-colors cursor-pointer"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Restaurar ordem padrão</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {orderedTabIds.map((tabId, idx) => {
                      const isAll = tabId === 'ALL';
                      const acc = isAll ? null : accounts.find((a) => a.id === tabId);
                      if (!isAll && !acc) return null;
                      const label = isAll ? 'Todos os Bancos' : getBankTabLabel(acc!, accounts);

                      return (
                        <div
                          key={tabId}
                          draggable
                          onDragStart={() => setDraggedTabId(tabId)}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOverTabId(tabId);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            handleDropTab(tabId);
                          }}
                          onDragEnd={() => {
                            setDraggedTabId(null);
                            setDragOverTabId(null);
                          }}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border/80 bg-bg-card px-2.5 py-1.5 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-gold/15 border border-accent-gold/30 font-mono text-[10px] font-bold text-accent-gold">
                              {idx + 1}º
                            </span>
                            <span className="truncate font-semibold text-text-primary">{label}</span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {idx > 0 && (
                              <button
                                type="button"
                                onClick={() => moveTabToFirst(tabId)}
                                className="rounded bg-accent-gold/10 hover:bg-accent-gold/25 border border-accent-gold/30 px-1.5 py-0.5 text-[10px] font-semibold text-accent-gold cursor-pointer"
                                title="Colocar como 1ª aba"
                              >
                                1º
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => moveTab(tabId, 'left')}
                              className="rounded border border-border bg-bg-elevated p-1 text-text-secondary hover:text-accent-gold disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                              title="Subir / Mover para antes"
                            >
                              <ChevronLeft className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              disabled={idx === orderedTabIds.length - 1}
                              onClick={() => moveTab(tabId, 'right')}
                              className="rounded border border-border bg-bg-elevated p-1 text-text-secondary hover:text-accent-gold disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                              title="Descer / Mover para depois"
                            >
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Card de Resumo do Banco Selecionado */}
            {selectedAccountObj && (() => {
              const accCurr = (selectedAccountObj.currency || 'BRL').toUpperCase();
              let subBalances: Record<string, number> | null = null;
              if (selectedAccountObj.account_number && selectedAccountObj.account_number.startsWith('{')) {
                try {
                  const parsed = JSON.parse(selectedAccountObj.account_number);
                  if (parsed && typeof parsed === 'object') subBalances = parsed;
                } catch {}
              }
              const validSubs = subBalances
                ? Object.entries(subBalances).filter(([, amt]) => typeof amt === 'number' && amt !== 0)
                : [];

              return (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent-gold/30 bg-accent-gold/5 px-4 py-3 text-xs">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-card border border-accent-gold/30 text-accent-gold">
                      <Landmark className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-text-primary">
                          {selectedAccountObj.institution_name} — {selectedAccountObj.account_name}
                        </span>
                        <span className="rounded bg-accent-gold/20 px-1.5 py-0.5 text-[10px] font-bold text-accent-gold border border-accent-gold/30">
                          {accCurr}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mt-0.5 text-text-secondary">
                        <span>
                          Saldo atual da conta:{' '}
                          <strong className="font-mono text-text-primary">
                            {fmtRaw(selectedAccountObj.balance, accCurr)}
                          </strong>
                        </span>
                        {validSubs.length > 1 && (
                          <span className="flex items-center gap-1.5">
                            ·
                            {validSubs.map(([cCode, amt]) => (
                              <span
                                key={cCode}
                                className="rounded bg-bg-card px-1.5 py-0.5 text-[10px] font-mono border border-border/70"
                              >
                                <strong>{cCode}:</strong> {fmtRaw(amt, cCode)}
                              </span>
                            ))}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setTxToEdit(null);
                      setAutoScanReceipt(false);
                      setAddOpen(true);
                    }}
                    className="h-8 gap-1.5 text-xs border-accent-gold/40 text-accent-gold hover:bg-accent-gold/15"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Lançar em {selectedAccountObj.institution_name}</span>
                  </Button>
                </div>
              );
            })()}

            {/* Filtros */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:flex-wrap items-center gap-2">
              <Select value={month ?? ''} onChange={setMonth}>
                {months.map((m) => (
                  <option key={m.value} value={m.value} className="capitalize">
                    {m.label}
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
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-bg-card px-4 py-2 text-sm">
                <div className="flex items-center gap-2 sm:gap-3">
                  <span className="text-text-secondary">
                    {filtered.length} transações
                    {selectedAccountObj ? ` em ${selectedAccountObj.institution_name}` : ''}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border/80 bg-bg-elevated/70 hover:bg-bg-elevated hover:border-accent-gold/40 text-xs font-semibold text-accent-gold transition-colors cursor-pointer select-none"
                    title="Alternar ordem de horário"
                  >
                    <ArrowUpDown className="h-3 w-3" />
                    <span>{sortOrder === 'desc' ? 'Mais recentes no topo' : 'Mais antigas no topo'}</span>
                  </button>
                </div>
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
                title={
                  selectedAccountObj
                    ? `Nenhuma transação em ${selectedAccountObj.institution_name} neste período.`
                    : 'Nenhuma transação encontrada para este período.'
                }
                description="Ajuste os filtros, selecione outra aba de banco ou adicione um novo lançamento."
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
        preferredAccountId={account || undefined}
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
