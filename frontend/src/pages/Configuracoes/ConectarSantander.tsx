import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ConnectionStatusCard } from '@/components/conectarSantander/ConnectionStatusCard';
import { AuthorizeButton } from '@/components/conectarSantander/AuthorizeButton';
import { api } from '@/services/api';
import { useToast } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { RefreshCw, Unplug, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ConectarSantander() {
  const { notify } = useToast();
  const location = useLocation();
  const [status, setStatus] = useState<'disconnected' | 'active' | 'expiring' | 'expired'>('disconnected');
  const [daysLeft, setDaysLeft] = useState<number>(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // No projeto real, talvez você já tenha o accountId vindo do contexto ou da lista de contas
  // Para simplificar, vamos buscar a primeira conta Enable Banking
  const [accountId, setAccountId] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const cbStatus = params.get('status');

    if (cbStatus === 'success') {
      notify('Conexão autorizada com sucesso!', 'success');
      // Limpa a URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (cbStatus === 'error') {
      notify('Falha na autorização ou o usuário cancelou.', 'error');
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    fetchStatus();
  }, [location, notify]);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      // Aqui idealmente buscaríamos as contas via api.getAccounts e filtraríamos a do Enable Banking
      const { accounts } = await api.getAccounts();
      const enableBankingAccount = (accounts as any[]).find(a => a.provider === 'ENABLE_BANKING');

      if (enableBankingAccount) {
        setAccountId(enableBankingAccount.id);
        const st = await api.getEnableBankingStatus(enableBankingAccount.id);
        setStatus(st.status);
        setDaysLeft(st.daysLeft);
        setLastSync(st.lastSync);
      } else {
        setStatus('disconnected');
      }
    } catch (err) {
      // Falha silenciosa se não houver conexão
      setStatus('disconnected');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncNow = async () => {
    if (!accountId) return;
    
    try {
      setSyncing(true);
      const res = await api.syncEnableBanking(accountId);
      notify(`Sincronização concluída! ${res.newTransactions} novas transações importadas.`, 'success');
      setLastSync(res.lastSync);
    } catch (err: any) {
      notify(err.message || 'Erro ao sincronizar', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!accountId) return;
    
    if (confirm('Tem certeza que deseja desconectar o banco? Isso não apagará as transações já importadas.')) {
      try {
        await api.removeAccount(accountId);
        notify('Conta desconectada com sucesso.', 'success');
        setStatus('disconnected');
        setAccountId(null);
      } catch (err: any) {
        notify(err.message || 'Erro ao desconectar', 'error');
      }
    }
  };

  return (
    <div className="flex h-full flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-text-primary">
            🏦 Conexão Automática — Santander España
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Conecte sua conta via Open Banking europeu para sincronizar saldos e transações automaticamente.
          </p>
        </div>
      </div>



      {loading ? (
        <div className="flex h-32 items-center justify-center rounded-xl border border-border bg-bg-card">
          <Loader2 className="h-8 w-8 animate-spin text-text-secondary" />
        </div>
      ) : (
        <div className="flex flex-col gap-6 rounded-xl border border-border bg-bg-card p-6">
          <ConnectionStatusCard status={status} daysLeft={daysLeft} lastSync={lastSync} />

          <div className="flex gap-4">
            {status === 'disconnected' && (
              <AuthorizeButton />
            )}

            {(status === 'active' || status === 'expiring' || status === 'expired') && (
              <>
                <Button 
                  onClick={handleSyncNow} 
                  disabled={syncing || status === 'expired'} 
                  className="gap-2 bg-accent-gold text-bg-primary hover:bg-accent-gold/90 border-0"
                >
                  <RefreshCw className={cn('h-4 w-4', syncing && 'animate-spin')} />
                  Sincronizar agora
                </Button>

                {(status === 'expiring' || status === 'expired') && (
                  <AuthorizeButton label="Reautorizar agora" />
                )}

                <Button 
                  variant="outline" 
                  onClick={handleDisconnect}
                  className="gap-2 border-red-500/20 text-red-500 hover:bg-red-500/10"
                >
                  <Unplug className="h-4 w-4" />
                  Desconectar
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
