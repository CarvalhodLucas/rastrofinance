import { useEffect, useState } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom';
import { Sidebar, MobileNav } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { ToastProvider, useToast } from '@/components/ui/Toast';
import { Dashboard } from '@/pages/Dashboard';
import { Transactions } from '@/pages/Transactions';
import { Insights } from '@/pages/Insights';
import { Connect } from '@/pages/Connect';
import { Settings } from '@/pages/Settings';
import { SmartSheet } from '@/pages/SmartSheet';
import { Investments } from '@/pages/Investments';
import { ConectarSantander } from '@/pages/Configuracoes/ConectarSantander';
import { CurrencyProvider } from '@/contexts/CurrencyContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Login } from '@/pages/Login';
import { SupportChat } from '@/components/support/SupportChat';
import { api } from '@/services/api';
import { timeAgo } from '@/lib/format';

const TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/transactions': 'Transações',
  '/investments': 'Investimentos',
  '/watchlist': 'Radar & Acompanhamento',
  '/insights': 'Insights IA',
  '/connect': 'Contas',
  '/settings': 'Configurações',
  '/planilha': 'Planilha Inteligente',
};

function Shell() {
  const location = useLocation();
  const { notify } = useToast();
  const [lastSync, setLastSync] = useState('—');
  const [syncing, setSyncing] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const refreshLastSync = async () => {
    try {
      const { accounts } = await api.getAccounts();
      const sorted = accounts
        .map((a) => a.last_synced_at)
        .filter((v): v is string => Boolean(v))
        .sort();
      const latest = sorted.length > 0 ? sorted[sorted.length - 1] : null;
      setLastSync(timeAgo(latest ?? null));
    } catch {
      setLastSync('—');
    }
  };

  useEffect(() => {
    void refreshLastSync();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      // Dispara cotações (Yahoo Finance), Binance e Pluggy em paralelo
      const [qResult, _bResult, sResult] = await Promise.allSettled([
        api.updateQuotes(),
        api.syncBinance().catch(() => null),
        api.sync().catch(() => null),
      ]);

      let updatedQuotesCount = 0;
      if (qResult.status === 'fulfilled' && qResult.value?.updated_count) {
        updatedQuotesCount = qResult.value.updated_count;
      }

      let syncedTxs = 0;
      if (sResult.status === 'fulfilled' && sResult.value?.synced) {
        syncedTxs = sResult.value.synced;
      }

      // Aguarda 300ms para propagação final das escritas no banco de dados
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Notificar páginas ativas para recarregar seus dados dinamicamente
      window.dispatchEvent(new Event('investments-updated'));
      window.dispatchEvent(new Event('transactions-updated'));

      await refreshLastSync();

      const messages: string[] = [];
      if (updatedQuotesCount > 0) messages.push(`${updatedQuotesCount} cotações de ativos`);
      if (syncedTxs > 0) messages.push(`${syncedTxs} transações bancárias`);

      if (messages.length > 0) {
        notify(`Sincronização concluída com sucesso! (${messages.join(', ')})`, 'success');
      } else {
        notify('Sincronização concluída! Valores e cotações de mercado atualizados.', 'success');
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erro durante a sincronização.', 'error');
    } finally {
      setSyncing(false);
    }
  };

  const title = TITLES[location.pathname] ?? 'Rastro Finance';

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] overflow-hidden bg-bg-primary">
      <Sidebar lastSync={lastSync} isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-1 flex-col overflow-hidden w-full">
        <Header
          title={title}
          syncing={syncing}
          onSync={handleSync}
          onToggleSidebar={() => setSidebarOpen((o) => !o)}
          sidebarOpen={sidebarOpen}
        />
        <main className="flex-1 overflow-hidden pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-0">
          <Routes>
            <Route path="/" element={<div className="overflow-y-auto h-full"><Dashboard /></div>} />
            <Route path="/transactions" element={<div className="overflow-y-auto h-full"><Transactions /></div>} />
            <Route path="/investments" element={<div className="overflow-y-auto h-full"><Investments /></div>} />
            <Route path="/watchlist" element={<Navigate to="/investments?tab=WATCHLIST" replace />} />
            <Route path="/radar" element={<Navigate to="/investments?tab=WATCHLIST" replace />} />
            <Route path="/cotacoes" element={<Navigate to="/investments?tab=WATCHLIST" replace />} />
            <Route path="/insights" element={<div className="overflow-y-auto h-full"><Insights /></div>} />
            <Route path="/connect" element={<div className="overflow-y-auto h-full"><Connect /></div>} />
            <Route path="/settings" element={<div className="overflow-y-auto h-full"><Settings /></div>} />
            <Route path="/configuracoes/conectar-santander" element={<div className="overflow-y-auto h-full"><ConectarSantander /></div>} />
            <Route path="/planilha" element={<div className="h-full"><SmartSheet /></div>} />
          </Routes>
        </main>
      </div>
      <MobileNav />
      <SupportChat />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <CurrencyProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <Shell />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </CurrencyProvider>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
