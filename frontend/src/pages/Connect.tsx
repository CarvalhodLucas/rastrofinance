import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Trash2, Landmark, Loader2, Plus, Globe, Edit2, Wallet, CreditCard } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { PluggyConnect } from '@/components/connect/PluggyConnect';
import { ImportStatementModal } from '@/components/transactions/ImportStatementModal';
import { AddManualAccountModal } from '@/components/connect/AddManualAccountModal';
import { useToast } from '@/components/ui/Toast';
import { useAccounts } from '@/hooks/usePluggy';
import { api } from '@/services/api';
import { timeAgo } from '@/lib/format';
import { useFmt } from '@/contexts/CurrencyContext';
import type { ConnectedAccount } from '@/types/finance';

const TYPE_LABEL: Record<string, string> = {
  CHECKING: 'Conta Corrente',
  SAVINGS: 'Poupança',
  CREDIT: 'Cartão de Crédito',
  INVESTMENT: 'Investimentos',
};

export function Connect() {
  const fmt = useFmt();
  const { accounts: allAccounts, loading, error, reload } = useAccounts();
  const accounts = allAccounts.filter(a => a.is_active !== false);
  const { notify } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'connections' | 'import'>('connections');

  const [showManualModal, setShowManualModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ConnectedAccount | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.sync();
      notify('Sincronização concluída.', 'success');
      await reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha ao sincronizar.', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleRemove = async (id: string) => {
    setBusyId(id);
    try {
      await api.removeAccount(id);
      notify('Conta removida.', 'success');
      await reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha ao remover.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleOpenEdit = (acc: ConnectedAccount) => {
    setEditingAccount(acc);
    setShowManualModal(true);
  };

  const handleOpenAddManual = () => {
    setEditingAccount(null);
    setShowManualModal(true);
  };

  const connectionOptions = (
    <div className="mt-8 space-y-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
        Adicionar Nova Conexão ou Saldo
      </h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Card Saldo Manual */}
        <Card className="border-accent-gold/40 bg-accent-gold/5 transition-colors hover:bg-accent-gold/10">
          <CardContent className="flex flex-col h-full justify-between p-5">
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-gold/15 text-accent-gold mb-3">
                <Wallet className="h-5 w-5" />
              </div>
              <h4 className="font-semibold text-text-primary mb-1">
                Cadastrar Saldo / Conta Manual
              </h4>
              <p className="text-xs text-text-secondary mb-4">
                Digite seu saldo direto (Wise USD, Wise EUR, Caixinhas ou Dinheiro Físico) sem precisar de extrato.
              </p>
            </div>
            <div className="pt-2">
              <Button
                size="sm"
                variant="primary"
                onClick={handleOpenAddManual}
                className="w-full gap-1.5 font-bold text-xs"
              >
                <Plus className="h-4 w-4" />
                <span>Digitar Saldo Manual</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Card Pluggy */}
        <Card className="border-border bg-bg-card/40 transition-colors hover:bg-bg-card/65">
          <CardContent className="flex flex-col h-full justify-between p-5">
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-gold/10 text-accent-gold mb-3">
                <Plus className="h-5 w-5" />
              </div>
              <h4 className="font-semibold text-text-primary mb-1">
                Contas do Brasil (Open Finance)
              </h4>
              <p className="text-xs text-text-secondary mb-4">
                Conecte Itaú, Nubank, Bradesco, Inter, C6 Bank e outros bancos nacionais via Pluggy.
              </p>
            </div>
            <div className="pt-2">
              <PluggyConnect onConnected={reload} />
            </div>
          </CardContent>
        </Card>

        {/* Card Enable Banking */}
        <Card className="border-border bg-bg-card/40 transition-colors hover:bg-bg-card/65">
          <CardContent className="flex flex-col h-full justify-between p-5">
            <div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 mb-3">
                <Globe className="h-5 w-5" />
              </div>
              <h4 className="font-semibold text-text-primary mb-1">
                Santander España (Open Banking)
              </h4>
              <p className="text-xs text-text-secondary mb-4">
                Conecte sua conta do Santander na Espanha via Open Banking europeu para sincronizar saldos.
              </p>
            </div>
            <div className="pt-2">
              <Link to="/configuracoes/conectar-santander">
                <Button size="sm" variant="secondary" className="w-full gap-1.5 border-blue-500/40 text-blue-400 hover:bg-blue-500/10">
                  Configurar Conexão
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Sub Tabs Navigation */}
      <div className="flex overflow-x-auto no-scrollbar border-b border-border bg-bg-elevated/10 px-3 sm:px-6 shrink-0">
        <button
          onClick={() => setActiveSubTab('connections')}
          className={`whitespace-nowrap px-3 sm:px-4 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors cursor-pointer shrink-0 ${
            activeSubTab === 'connections'
              ? 'border-accent-gold text-accent-gold'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          Conexões Automáticas e Saldos
        </button>
        <button
          onClick={() => setActiveSubTab('import')}
          className={`whitespace-nowrap px-3 sm:px-4 py-3 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors cursor-pointer shrink-0 ${
            activeSubTab === 'import'
              ? 'border-accent-gold text-accent-gold'
              : 'border-transparent text-text-muted hover:text-text-primary'
          }`}
        >
          Importar Extrato Manual (IA)
        </button>
      </div>

      {/* Tab Content Wrapper */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 md:p-8">
        {activeSubTab === 'connections' ? (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-base sm:text-lg font-semibold text-text-primary">
                Suas Contas Conectadas e Saldos
              </h2>
              {accounts.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button variant="primary" size="sm" onClick={handleOpenAddManual} className="h-8 gap-1 text-xs font-bold flex-1 sm:flex-initial">
                    <Plus className="h-4 w-4" />
                    <span>Digitar Saldo</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleSync} disabled={syncing} className="h-8 flex-1 sm:flex-initial">
                    <RefreshCw className={syncing ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
                    <span>Sincronizar</span>
                  </Button>
                </div>
              )}
            </div>

            {error ? (
              <ErrorState message={error} onRetry={reload} />
            ) : loading ? (
              <div className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : accounts.length === 0 ? (
              <div className="space-y-6">
                <EmptyState
                  title="Nenhuma conta ou saldo cadastrado ainda"
                  description="Selecione uma das opções abaixo para digitar seu saldo ou conectar sua primeira instituição financeira."
                />
                {connectionOptions}
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {accounts.map((acc) => (
                    <Card key={acc.id}>
                      <CardContent className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-4">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-bg-elevated font-bold text-accent-gold">
                            {acc.institution_logo ? (
                              <img
                                src={acc.institution_logo}
                                alt={acc.institution_name}
                                className="h-full w-full object-contain"
                              />
                            ) : acc.account_type === 'CREDIT' ? (
                              <CreditCard className="h-5 w-5 text-purple-400" />
                            ) : (
                              <Landmark className="h-5 w-5 text-accent-gold" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-text-primary flex items-center gap-2 flex-wrap">
                              <span className="truncate">{acc.account_name || acc.institution_name}</span>
                              <span className="text-xs font-normal text-text-secondary">
                                ({TYPE_LABEL[acc.account_type] ?? acc.account_type})
                              </span>
                              {acc.currency && acc.currency !== 'BRL' && (
                                <span className="rounded bg-accent-gold/15 px-1.5 py-0.5 text-[10px] font-bold text-accent-gold border border-accent-gold/30">
                                  {acc.currency}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-text-secondary mt-0.5">
                              <span className="font-semibold text-text-primary">Saldo: {fmt({ balance: acc.balance, currency: acc.currency })}</span> · Atualizado há {timeAgo(acc.last_synced_at)}
                              {acc.last_synced_at && (
                                <span className="ml-1 text-accent-green">✓</span>
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/40">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleOpenEdit(acc)}
                            className="h-8 gap-1 text-xs border-border hover:border-accent-gold/40 flex-1 sm:flex-initial"
                            title="Editar Saldo"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            <span>Editar Saldo</span>
                          </Button>

                          <Button
                            variant="danger"
                            size="icon"
                            onClick={() => handleRemove(acc.id)}
                            disabled={busyId === acc.id}
                            aria-label="Remover conta"
                            className="h-8 w-8 shrink-0"
                          >
                            {busyId === acc.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {connectionOptions}
              </>
            )}
          </div>
        ) : (
          <div className="max-w-4xl mx-auto bg-bg-card border border-border p-6 rounded-2xl shadow-sm">
            <ImportStatementModal
              open={true}
              onClose={() => setActiveSubTab('connections')}
              onImported={reload}
              accounts={allAccounts}
              embedded={true}
            />
          </div>
        )}
      </div>

      {/* Modal de Saldo / Conta Manual */}
      <AddManualAccountModal
        open={showManualModal}
        accountToEdit={editingAccount}
        onClose={() => setShowManualModal(false)}
        onSuccess={reload}
      />
    </div>
  );
}
