import { useState, useEffect } from 'react';
import { RefreshCw, Menu, Sun, Moon, Bot } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { formatDateFull } from '@/lib/format';
import { useCurrency, type Currency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';

interface HeaderProps {
  title: string;
  syncing?: boolean;
  onSync?: () => void;
  onToggleSidebar?: () => void;
  sidebarOpen?: boolean;
}

const CURRENCIES: Array<{ code: Currency; flag: string; label: string }> = [
  { code: 'BRL', flag: '🇧🇷', label: 'BRL (R$)' },
  { code: 'USD', flag: '🇺🇸', label: 'USD ($)' },
  { code: 'EUR', flag: '🇪🇺', label: 'EUR (€)' },
  { code: 'CLP', flag: '🇨🇱', label: 'CLP ($)' },
];

export function Header({ title, syncing, onSync, onToggleSidebar }: HeaderProps) {
  const { user } = useAuth();
  const today = new Date().toISOString().split('T')[0] ?? '';
  const { currency, setCurrency, isLoadingRate } = useCurrency();

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('investor10_theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    const handleThemeChange = () => {
      setTheme((localStorage.getItem('investor10_theme') as 'light' | 'dark') || 'light');
    };
    window.addEventListener('theme-changed', handleThemeChange);
    return () => window.removeEventListener('theme-changed', handleThemeChange);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('investor10_theme', next);
    window.dispatchEvent(new Event('theme-changed'));
  };

  return (
    <header className="flex items-center justify-between border-b border-border bg-bg-card px-3 py-2 sm:px-6 sm:py-2.5 shadow-sm">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="flex items-center justify-center h-8 w-8 shrink-0 rounded-lg border border-border bg-bg-elevated text-text-primary hover:text-accent-gold hover:border-accent-gold/40 transition-colors cursor-pointer"
            title="Alternar menu de navegação (Hambúrguer ≡)"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-sm sm:text-base font-bold tracking-tight text-text-primary truncate">
            {title}
          </h1>
          <p className="text-[11px] capitalize text-text-muted hidden sm:block">
            {formatDateFull(today)}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {/* Botão de Suporte & Análise IA */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('open-support-chat'))}
          className="flex items-center gap-1.5 h-8 px-2 sm:px-2.5 rounded-lg border border-accent-gold/40 bg-accent-gold/10 text-accent-gold hover:bg-accent-gold hover:text-slate-950 text-xs font-bold transition-all cursor-pointer shadow-xs"
          title="Abrir Chat de Suporte & Análise Financeira"
        >
          <Bot className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">Suporte IA</span>
        </button>

        {/* Alternador de Tema Claro / Escuro */}
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center h-8 w-8 rounded-lg border border-border bg-bg-elevated text-text-primary hover:text-accent-gold transition-colors cursor-pointer"
          title={theme === 'dark' ? 'Mudar para Tema Claro (Light)' : 'Mudar para Tema Escuro (Dark)'}
        >
          {theme === 'dark' ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-300" />}
        </button>

        {/* Currency Switcher Dropdown */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-bg-elevated px-1.5 sm:px-2 py-1 text-xs font-semibold text-text-primary shadow-xs">
          <span className="text-xs">
            {CURRENCIES.find((c) => c.code === currency)?.flag ?? '🌐'}
          </span>
          <select
            value={currency}
            onChange={(e) => void setCurrency(e.target.value as Currency)}
            disabled={isLoadingRate}
            className="bg-transparent text-xs font-bold text-text-primary outline-none cursor-pointer"
            title="Alternar Moeda de Exibição do Site"
          >
            {CURRENCIES.map((c) => (
              <option key={c.code} value={c.code} className="bg-bg-card text-text-primary">
                {c.flag} {c.label}
              </option>
            ))}
          </select>
          {isLoadingRate && <span className="text-[10px] text-accent-gold animate-pulse">…</span>}
        </div>

        {user && (
          <div className="hidden md:flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-lg border border-border bg-bg-elevated/70 text-xs font-semibold text-text-primary shadow-xs">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-accent-gold/20 text-accent-gold text-[10px] font-bold border border-accent-gold/30">
              {user.name ? user.name[0]?.toUpperCase() : user.username[0]?.toUpperCase()}
            </div>
            <span className="text-text-secondary font-mono text-[11px]">@{user.username}</span>
          </div>
        )}

        {onSync && (
          <Button variant="secondary" size="sm" onClick={onSync} disabled={syncing} className="h-8 px-2 sm:px-3 text-xs font-semibold">
            <RefreshCw className={syncing ? 'h-3.5 w-3.5 animate-spin' : 'h-3.5 w-3.5'} />
            <span className="hidden sm:inline">{syncing ? 'Sincronizando…' : 'Sincronizar'}</span>
          </Button>
        )}
      </div>
    </header>
  );
}
