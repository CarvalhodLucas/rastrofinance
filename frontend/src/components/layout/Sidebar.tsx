import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  CreditCard,
  BrainCircuit,
  Landmark,
  Settings as SettingsIcon,
  Activity,
  Table2,
  Coins,
  ChevronDown,
  BarChart3,
  Building2,
  Layers,
  ShieldCheck,
  History,
  TrendingUp,
  FileSpreadsheet,
  X,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/contexts/AuthContext';

const INVESTMENT_SUBTABS = [
  { tab: 'WATCHLIST',        label: 'Radar de Cotações',      icon: Sparkles,    color: 'text-accent-gold', activeClass: 'text-accent-gold bg-accent-gold/10' },
  { tab: 'OVERVIEW',         label: 'Visão Geral',           icon: BarChart3,   color: 'text-accent-gold', activeClass: 'text-accent-gold bg-accent-gold/10' },
  { tab: 'STOCK',            label: 'Ações (B3)',             icon: Building2,   color: 'text-blue-400',    activeClass: 'text-blue-400 bg-blue-500/10' },
  { tab: 'FII',              label: 'FIIs',                   icon: Layers,      color: 'text-purple-400',  activeClass: 'text-purple-400 bg-purple-500/10' },
  { tab: 'FIXED_INCOME',     label: 'Renda Fixa',             icon: ShieldCheck, color: 'text-emerald-400', activeClass: 'text-emerald-400 bg-emerald-500/10' },
  { tab: 'CRYPTO',           label: 'Criptomoedas',           icon: Coins,       color: 'text-amber-400',   activeClass: 'text-amber-400 bg-amber-500/10' },
  { tab: 'TRADES',           label: 'Histórico de Transações',icon: History,     color: 'text-blue-300',    activeClass: 'text-blue-300 bg-blue-500/10' },
  { tab: 'DIVIDENDS',        label: 'Dividendos & Proventos', icon: TrendingUp,  color: 'text-amber-400',   activeClass: 'text-amber-400 bg-amber-500/10' },
  { tab: 'REALIZED_HISTORY', label: 'Ganhos & Perdas',        icon: History,     color: 'text-emerald-400', activeClass: 'text-emerald-400 bg-emerald-500/10' },
  { tab: 'IMPORT_B3',        label: 'Importar Extrato',       icon: FileSpreadsheet, color: 'text-accent-gold', activeClass: 'text-accent-gold bg-accent-gold/10' },
];

interface NavItem {
  to: string;
  label: string;
  icon: any;
  end: boolean;
  hasSubMenu?: boolean;
  group?: string;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/transactions', label: 'Transações', icon: CreditCard, end: false },
  { to: '/investments', label: 'Investimentos', icon: Coins, end: false, hasSubMenu: true },
  { to: '/planilha', label: 'Planilha', icon: Table2, end: false },
  { to: '/insights', label: 'Insights IA', icon: BrainCircuit, end: false },
  { to: '/connect', label: 'Contas', icon: Landmark, end: false },
  { to: '/settings', label: 'Configurações', icon: SettingsIcon, end: false },
];

function Logo() {
  return (
    <div className="flex items-center gap-2.5 px-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-gold/15">
        <Activity className="h-5 w-5 text-accent-gold" />
      </div>
      <span className="text-base font-bold tracking-tight text-text-primary">
        Rastro<span className="text-accent-gold"> Finance</span>
      </span>
    </div>
  );
}

interface SidebarProps {
  lastSync: string;
  isOpen: boolean;
  onClose: () => void;
}

/** Sidebar Gaveta (Drawer) acionada pelo menu hambúrguer. */
export function Sidebar({ lastSync, isOpen, onClose }: SidebarProps) {
  const { user, logout } = useAuth();
  const { currency, setCurrency } = useCurrency();
  const location = useLocation();
  const navigate = useNavigate();
  const isInvestmentsPage = location.pathname.startsWith('/investments');

  const [investmentsOpen, setInvestmentsOpen] = useState(isInvestmentsPage);

  useEffect(() => {
    if (isInvestmentsPage) setInvestmentsOpen(true);
  }, [isInvestmentsPage]);

  const searchParams = new URLSearchParams(location.search);
  const activeTab = searchParams.get('tab') || 'OVERVIEW';

  const handleSubTabClick = (tab: string) => {
    navigate(`/investments?tab=${tab}`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
      />

      {/* Slide-out Navigation Drawer */}
      <aside className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-bg-card shadow-2xl animate-in slide-in-from-left duration-200">
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <Logo />
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-text-muted hover:bg-bg-elevated hover:text-text-primary transition-colors cursor-pointer"
            title="Fechar menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV.map(({ to, label, icon: Icon, end, hasSubMenu, group }, idx) => {
          const prevItem = idx > 0 ? NAV[idx - 1] : null;
          const showGroupHeader = group && (!prevItem || prevItem.group !== group);

          const renderIcon = () => {
            if (typeof Icon === 'string') {
              return <span className="text-lg w-5 h-5 flex items-center justify-center leading-none">{Icon}</span>;
            }
            return <Icon className="h-5 w-5 shrink-0" />;
          };

          return (
            <div key={to} className="space-y-0.5">
              {showGroupHeader && (
                <div className="px-3 pt-3 pb-1 select-none">
                  <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                    {group}
                  </span>
                </div>
              )}
              {hasSubMenu ? (
                <div>
                  {/* Item pai: Investimentos */}
                  <button
                    onClick={() => {
                      if (!isInvestmentsPage) {
                        navigate(`/investments?tab=OVERVIEW`);
                      } else {
                        setInvestmentsOpen((o) => !o);
                      }
                    }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 cursor-pointer',
                      isInvestmentsPage
                        ? 'bg-accent-gold/10 text-accent-gold'
                        : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary',
                    )}
                  >
                    {renderIcon()}
                    <span className="flex-1 text-left">{label}</span>
                    <ChevronDown
                      className={cn(
                        'h-4 w-4 shrink-0 transition-transform duration-200',
                        investmentsOpen ? 'rotate-180' : '',
                      )}
                    />
                  </button>

                  {/* Submenu: Sub-abas de Investimentos */}
                  {investmentsOpen && (
                    <div className="mt-0.5 ml-2 space-y-0.5 border-l border-border/50 pl-2">
                      {INVESTMENT_SUBTABS.map(({ tab, label: subLabel, icon: SubIcon, color, activeClass }) => {
                        const isActive = isInvestmentsPage && activeTab === tab;
                        return (
                          <button
                            key={tab}
                            onClick={() => handleSubTabClick(tab)}
                            className={cn(
                              'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium transition-colors duration-150 cursor-pointer',
                              isActive
                                ? activeClass
                                : `text-text-secondary hover:bg-bg-elevated hover:${color}`,
                            )}
                          >
                            <SubIcon className={cn('h-3.5 w-3.5 shrink-0', isActive ? color : '')} />
                            <span className="text-left leading-tight">{subLabel}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <NavLink
                  to={to}
                  end={end}
                  onClick={onClose}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200 cursor-pointer',
                      isActive
                        ? 'bg-accent-gold/10 text-accent-gold'
                        : 'text-text-secondary hover:bg-bg-elevated hover:text-text-primary',
                    )
                  }
                >
                  {renderIcon()}
                  {label}
                </NavLink>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-border p-4 space-y-3">
        <div>
          <label className="block text-[10px] font-bold text-text-muted mb-1.5 uppercase tracking-wider">
            Moeda Principal
          </label>
          <div className="grid grid-cols-2 gap-1 bg-bg-elevated p-1 rounded-lg border border-border">
            {[
              { code: 'BRL', label: '🇧🇷 BRL' },
              { code: 'USD', label: '🇺🇸 USD' },
              { code: 'EUR', label: '🇪🇺 EUR' },
              { code: 'CLP', label: '🇨🇱 CLP' },
            ].map((c) => (
              <button
                key={c.code}
                onClick={() => void setCurrency(c.code as any)}
                className={cn(
                  'py-1 px-2 rounded text-xs font-bold transition-all text-center cursor-pointer',
                  currency === c.code
                    ? 'bg-accent-gold text-bg-primary shadow-xs'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Informações do Usuário e Logout */}
        {user && (
          <div className="pt-3 border-t border-border/60">
            <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-bg-elevated/70 border border-border/70">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent-gold/20 text-accent-gold font-bold text-xs uppercase border border-accent-gold/30">
                  {user.name ? user.name.slice(0, 2).toUpperCase() : user.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-text-primary leading-tight">
                    {user.name || user.username}
                  </p>
                  <p className="truncate text-[10px] text-text-muted font-mono leading-tight">
                    @{user.username}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  logout();
                  onClose();
                }}
                title="Sair da conta"
                className="rounded-lg p-1.5 text-text-muted hover:bg-red-500/15 hover:text-red-400 transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-text-secondary pt-1 border-t border-border/50">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-pulse-soft rounded-full bg-accent-green/60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-accent-green" />
          </span>
          Última sync: {lastSync}
        </div>
      </div>
    </aside>
    </>
  );
}

// 5 abas principais para navegação inferior fluida no celular (Mobile First)
const MOBILE_NAV = [
  { to: '/', label: 'Início', icon: LayoutDashboard, end: true },
  { to: '/transactions', label: 'Transações', icon: CreditCard, end: false },
  { to: '/investments', label: 'Investir', icon: Coins, end: false },
  { to: '/planilha', label: 'Planilha', icon: Table2, end: false },
  { to: '/connect', label: 'Contas', icon: Landmark, end: false },
];

/** Bottom navigation no mobile com suporte a Safe Area e toque confortável. */
export function MobileNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center border-t border-border/80 bg-bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom,0px)] md:hidden shadow-lg shadow-black/40">
      {MOBILE_NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center justify-center gap-1 py-2 min-h-[50px] text-[10px] font-medium transition-all duration-150 cursor-pointer select-none active:scale-95',
              isActive
                ? 'text-accent-gold font-bold'
                : 'text-text-muted hover:text-text-secondary',
            )
          }
        >
          {({ isActive }) => (
            <>
              <div className={cn(
                'relative flex items-center justify-center p-1 rounded-lg transition-colors',
                isActive && 'bg-accent-gold/15 text-accent-gold shadow-xs'
              )}>
                {typeof Icon === 'string' ? (
                  <span className="text-base h-4.5 w-4.5 flex items-center justify-center leading-none">{Icon}</span>
                ) : (
                  <Icon className="h-4.5 w-4.5" />
                )}
              </div>
              <span className="leading-tight truncate max-w-[64px]">{label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}
