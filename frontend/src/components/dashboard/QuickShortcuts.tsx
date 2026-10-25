import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Sparkles,
  TrendingUp,
  BarChart3,
  Building2,
  Coins,
  FileSpreadsheet,
  Table2,
  CreditCard,
  BrainCircuit,
  Settings2,
  Check,
  X,
  ExternalLink,
  Smartphone,
  Copy,
  CheckCheck,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';

export interface ShortcutItem {
  id: string;
  title: string;
  subtitle: string;
  to: string;
  icon: any;
  badge?: string;
  color: string;
  bgColor: string;
  borderColor: string;
  highlight?: boolean;
}

const ALL_SHORTCUTS: ShortcutItem[] = [
  {
    id: 'radar',
    title: 'Radar de Cotações',
    subtitle: 'Bolsa B3 & Criptomoedas ao vivo',
    to: '/investments?tab=WATCHLIST',
    icon: Sparkles,
    badge: 'Ao Vivo',
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
    borderColor: 'border-amber-400/30 hover:border-amber-400/60',
    highlight: true,
  },
  {
    id: 'overview',
    title: 'Minha Carteira',
    subtitle: 'Posição patrimonial consolidada',
    to: '/investments?tab=OVERVIEW',
    icon: BarChart3,
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    borderColor: 'border-blue-400/30 hover:border-blue-400/60',
  },
  {
    id: 'stock',
    title: 'Ações (B3)',
    subtitle: 'Carteira de ações nacionais',
    to: '/investments?tab=STOCK',
    icon: Building2,
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
    borderColor: 'border-purple-400/30 hover:border-purple-400/60',
  },
  {
    id: 'crypto',
    title: 'Criptomoedas',
    subtitle: 'Saldo Binance & Criptoativos',
    to: '/investments?tab=CRYPTO',
    icon: Coins,
    color: 'text-orange-400',
    bgColor: 'bg-orange-400/10',
    borderColor: 'border-orange-400/30 hover:border-orange-400/60',
  },
  {
    id: 'import_b3',
    title: 'Importar Extrato',
    subtitle: 'Sincronizar notas da B3 / CEI',
    to: '/investments?tab=IMPORT_B3',
    icon: FileSpreadsheet,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-400/10',
    borderColor: 'border-emerald-400/30 hover:border-emerald-400/60',
  },
  {
    id: 'transactions',
    title: 'Transações',
    subtitle: 'Controle de despesas e receitas',
    to: '/transactions',
    icon: CreditCard,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-400/10',
    borderColor: 'border-cyan-400/30 hover:border-cyan-400/60',
  },
  {
    id: 'sheet',
    title: 'Planilha',
    subtitle: 'Visão tabulada inteligente',
    to: '/planilha',
    icon: Table2,
    color: 'text-teal-400',
    bgColor: 'bg-teal-400/10',
    borderColor: 'border-teal-400/30 hover:border-teal-400/60',
  },
  {
    id: 'insights',
    title: 'Insights IA',
    subtitle: 'Recomendações e diagnósticos',
    to: '/insights',
    icon: BrainCircuit,
    color: 'text-pink-400',
    bgColor: 'bg-pink-400/10',
    borderColor: 'border-pink-400/30 hover:border-pink-400/60',
  },
];

const DEFAULT_ACTIVE_IDS = ['radar', 'overview', 'crypto', 'import_b3'];
const STORAGE_KEY = 'rastro_home_shortcuts_v1';

export function QuickShortcuts() {
  const { notify } = useToast();
  const [activeIds, setActiveIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_ACTIVE_IDS;
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(activeIds));
    } catch {}
  }, [activeIds]);

  const toggleShortcut = (id: string) => {
    setActiveIds((prev) => {
      if (prev.includes(id)) {
        if (prev.length <= 1) {
          notify('Mantenha pelo menos 1 atalho na tela inicial.', 'info');
          return prev;
        }
        return prev.filter((item) => item !== id);
      } else {
        return [...prev, id];
      }
    });
  };

  const handleCopyRadarLink = async () => {
    const radarUrl = `${window.location.origin}/investments?tab=WATCHLIST`;
    try {
      await navigator.clipboard.writeText(radarUrl);
      setCopied(true);
      notify('Link direto do Radar copiado para a área de transferência!', 'success');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      notify(`Copie o link: ${radarUrl}`, 'info');
    }
  };

  const visibleShortcuts = ALL_SHORTCUTS.filter((s) => activeIds.includes(s.id));

  return (
    <div className="space-y-2.5">
      {/* Header dos Atalhos */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-accent-gold/20 text-accent-gold">
            <TrendingUp className="h-3.5 w-3.5" />
          </div>
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-text-secondary">
            Atalhos Rápidos
          </h2>
        </div>

        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-accent-gold transition-colors cursor-pointer py-1 px-2 rounded-lg hover:bg-bg-elevated/80"
          title="Adicionar ou personalizar atalhos na tela inicial"
        >
          <Settings2 className="h-3.5 w-3.5" />
          <span>Personalizar</span>
        </button>
      </div>

      {/* Grid de Atalhos da Tela Inicial */}
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3">
        {visibleShortcuts.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.id}
              to={s.to}
              className={`group relative flex flex-col justify-between p-3 sm:p-3.5 rounded-xl border bg-bg-surface/90 hover:bg-bg-elevated backdrop-blur-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg shadow-black/40 ${
                s.highlight
                  ? 'border-accent-gold/40 shadow-xs shadow-accent-gold/10 hover:border-accent-gold'
                  : s.borderColor
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.bgColor} ${s.color} transition-transform group-hover:scale-105`}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>

                {s.badge && (
                  <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {s.badge}
                  </span>
                )}
              </div>

              <div className="mt-2.5">
                <h3 className="font-bold text-xs sm:text-sm text-text-primary group-hover:text-accent-gold transition-colors truncate">
                  {s.title}
                </h3>
                <p className="text-[11px] text-text-muted truncate mt-0.5">
                  {s.subtitle}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Modal de Personalização dos Atalhos */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl border border-border/80 bg-bg-card p-5 sm:p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Header Modal */}
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-gold/15 text-accent-gold">
                  <Settings2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-text-primary">
                    Atalhos da Tela Inicial
                  </h3>
                  <p className="text-xs text-text-muted">
                    Escolha quais atalhos diretos você quer ver no Dashboard.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1 rounded-lg text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Lista para marcar/desmarcar */}
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Atalhos Disponíveis
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {ALL_SHORTCUTS.map((s) => {
                  const Icon = s.icon;
                  const isActive = activeIds.includes(s.id);
                  return (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => toggleShortcut(s.id)}
                      className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isActive
                          ? 'bg-accent-gold/10 border-accent-gold/50 shadow-xs'
                          : 'bg-bg-elevated/40 border-border/60 hover:bg-bg-elevated'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-lg ${s.bgColor} ${s.color} shrink-0`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-text-primary truncate">
                            {s.title}
                          </p>
                          <p className="text-[10px] text-text-muted truncate">
                            {s.subtitle}
                          </p>
                        </div>
                      </div>

                      <div
                        className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 ml-2 transition-colors ${
                          isActive
                            ? 'bg-accent-gold border-accent-gold text-gray-950 font-bold'
                            : 'border-border bg-bg-surface'
                        }`}
                      >
                        {isActive && <Check className="h-3 w-3 stroke-[3]" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dica para colocar na tela inicial do Celular / Navegador (PWA) */}
            <div className="p-3.5 rounded-xl border border-border/70 bg-bg-elevated/50 space-y-2.5">
              <div className="flex items-center gap-2 text-text-primary">
                <Smartphone className="h-4 w-4 text-accent-gold" />
                <span className="text-xs font-bold">
                  Quer um ícone direto na tela inicial do celular/computador?
                </span>
              </div>
              <p className="text-[11px] text-text-muted leading-relaxed">
                Você pode adicionar um atalho permanente no seu celular ou PC: no navegador, clique em <strong>Compartilhar</strong> ou no menu de 3 pontinhos e selecione <strong>"Adicionar à Tela de Início"</strong>.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleCopyRadarLink}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-bg-surface border border-border hover:border-accent-gold text-text-primary transition-colors cursor-pointer"
                >
                  {copied ? <CheckCheck className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? 'Link Copiado!' : 'Copiar Link Direto do Radar'}</span>
                </button>

                <Link
                  to="/investments?tab=WATCHLIST"
                  onClick={() => setModalOpen(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-accent-gold text-gray-950 hover:bg-amber-400 transition-colors ml-auto"
                >
                  <span>Ir para o Radar</span>
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* Botão de Fechar */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-accent-gold text-gray-950 hover:bg-amber-400 transition-colors cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
