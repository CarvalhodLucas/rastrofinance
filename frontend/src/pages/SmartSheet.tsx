import { useState, useEffect } from 'react';
import { RefreshCw, Sparkles, Maximize2, Minimize2, X } from 'lucide-react';
import { SmartSheetProvider, useSmartSheet } from '@/contexts/SmartSheetContext';
import { ViewSelector } from '@/components/smartsheet/ViewSelector';
import { CommandBar } from '@/components/smartsheet/CommandBar';
import { SheetGrid } from '@/components/smartsheet/SheetGrid';
import { AISuggestionBanner } from '@/components/smartsheet/AISuggestionBanner';
import { InsightFooter } from '@/components/smartsheet/InsightFooter';
import { ProjectionChart } from '@/components/smartsheet/ProjectionChart';
import { ExportMenu } from '@/components/smartsheet/ExportMenu';
import { useFmt } from '@/contexts/CurrencyContext';
import { PERIOD_OPTIONS } from '@/types/smartsheet';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

// --- Compact Summary Pills (Header Inline) ---
function CompactSummaryPills() {
  const fmt = useFmt();
  const { state } = useSmartSheet();
  const { summaryPills, isLoading } = state;

  const colorClass: Record<string, string> = {
    green: 'text-accent-green',
    red:   'text-accent-red',
    gold:  'text-accent-gold',
  };

  return (
    <div className="hidden lg:flex items-center gap-3 border-l border-border/60 pl-3">
      {summaryPills.map((pill, i) => (
        <div key={i} className={cn('flex items-center gap-1 text-xs', isLoading && 'animate-pulse opacity-50')}>
          <span className="text-[11px] text-text-muted">{pill.label}:</span>
          <span className={cn('font-mono text-xs font-semibold tabular-nums', colorClass[pill.color ?? ''] ?? 'text-text-primary')}>
            {pill.color && (pill.color === 'red' || pill.color === 'green' || pill.color === 'gold')
              ? (() => {
                  const n = Number(pill.value);
                  return isNaN(n) ? pill.value : fmt(n);
                })()
              : pill.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// --- Period Selector & Active Date Indicator Bar ---
function PeriodSelector() {
  const { state, dispatch, loadView } = useSmartSheet();
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [startDate, setStartDate] = useState('2026-08-01');
  const [endDate, setEndDate] = useState('2026-08-15');

  // Load default saved period preference from localStorage on mount
  useEffect(() => {
    const savedDefault = localStorage.getItem('smartsheet_default_period');
    if (savedDefault && savedDefault !== state.period) {
      dispatch({ type: 'SET_PERIOD', payload: savedDefault });
      void loadView(state.activeView, savedDefault);
    }
  }, []);

  const handlePeriodChange = (newPeriod: string) => {
    if (newPeriod === 'custom') {
      setShowCustomModal(true);
      return;
    }
    dispatch({ type: 'SET_PERIOD', payload: newPeriod });
    void loadView(state.activeView, newPeriod);
  };

  const handleApplyCustomDates = () => {
    if (!startDate || !endDate) return;
    const customKey = `${startDate}:${endDate}`;
    dispatch({ type: 'SET_PERIOD', payload: customKey });
    void loadView(state.activeView, customKey);
    setShowCustomModal(false);
  };

  const setAsDefaultPeriod = () => {
    localStorage.setItem('smartsheet_default_period', state.period);
    alert(`Período '${getPeriodLabel(state.period)}' definido como padrão inicial!`);
  };

  // Helper label resolver
  const getPeriodLabel = (pStr: string) => {
    if (pStr.includes(':')) {
      const [s, e] = pStr.split(':');
      return `${s} a ${e}`;
    }
    const found = PERIOD_OPTIONS.find((o) => o.value === pStr);
    return found ? found.label : pStr;
  };

  const activeLabel = getPeriodLabel(state.period);

  return (
    <div className="flex items-center gap-2 relative">
      {/* Active Period Badge Indicator */}
      <div className="hidden xl:flex items-center gap-1.5 rounded-lg border border-accent-gold/40 bg-accent-gold/10 px-2.5 py-1 text-xs font-semibold text-accent-gold shadow-sm">
        <span className="text-sm">📅</span>
        <span className="text-text-primary text-[11px] font-medium">Exibindo:</span>
        <span className="font-bold">{activeLabel}</span>
      </div>

      {/* Select Dropdown */}
      <select
        value={state.period.includes(':') ? 'custom' : state.period}
        onChange={(e) => handlePeriodChange(e.target.value)}
        className="h-8 rounded-lg border border-border bg-bg-elevated px-2 text-xs font-semibold text-text-primary outline-none focus:border-accent-gold cursor-pointer"
      >
        {PERIOD_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>

      {/* Custom Date Range Popover Modal */}
      {showCustomModal && (
        <div className="absolute top-10 right-0 z-50 w-72 rounded-xl border border-accent-gold/40 bg-bg-card p-3 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between pb-2 border-b border-border mb-3">
            <span className="text-xs font-bold text-accent-gold flex items-center gap-1">
              📅 Intervalo Personalizado
            </span>
            <button onClick={() => setShowCustomModal(false)} className="text-text-muted hover:text-text-primary text-xs">
              ✕
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <label className="block text-[11px] text-text-muted mb-1 font-medium">Data Inicial:</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full h-8 rounded-md border border-border bg-bg-elevated px-2 text-xs text-text-primary outline-none focus:border-accent-gold"
              />
            </div>
            <div>
              <label className="block text-[11px] text-text-muted mb-1 font-medium">Data Final:</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full h-8 rounded-md border border-border bg-bg-elevated px-2 text-xs text-text-primary outline-none focus:border-accent-gold"
              />
            </div>

            <div className="pt-2 flex items-center justify-between">
              <button
                type="button"
                onClick={setAsDefaultPeriod}
                className="text-[10px] text-accent-gold hover:underline font-semibold flex items-center gap-1"
                title="Salva este filtro como o padrão ao abrir a planilha"
              >
                ⭐ Definir como Padrão
              </button>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setShowCustomModal(false)} className="h-7 text-xs">
                  Cancelar
                </Button>
                <Button size="sm" variant="primary" onClick={handleApplyCustomDates} className="h-7 text-xs font-bold">
                  Aplicar Filtro
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Origin sub-tabs (only for origin view) ---
function OriginSubTabs() {
  const { state } = useSmartSheet();
  const [tab, setTab] = useState<'income' | 'expense'>('income');
  const { viewType, columns, rows, extraRows = [], extraColumns = [], isLoading } = state;

  if (viewType !== 'origin') return null;

  const activeColumns = tab === 'income' ? columns : extraColumns;
  const activeRows    = tab === 'income' ? rows : extraRows;

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b border-border bg-bg-card">
        {(['income', 'expense'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-xs font-semibold transition-colors',
              tab === t ? 'border-b-2 border-accent-gold text-text-primary bg-bg-elevated' : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {t === 'income' ? '💰 De onde vem' : '💸 Para onde vai'}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto">
        <SheetGrid columns={activeColumns} rows={activeRows} isLoading={isLoading} showTotalsRow={false} />
      </div>
    </div>
  );
}

// --- Main grid router ---
function MainGrid() {
  const { state } = useSmartSheet();
  const { viewType, columns, rows, isLoading } = state;

  if (viewType === 'origin') return <OriginSubTabs />;

  return (
    <SheetGrid
      columns={columns}
      rows={rows}
      isLoading={isLoading}
      showTotalsRow={viewType !== 'cashflow'}
      expandable={viewType === 'categories' || viewType === 'dre' || viewType === 'comparison' || viewType === 'grid'}
    />
  );
}

// --- Page shell (inside provider) ---
function SmartSheetShell() {
  const { loadView, state } = useSmartSheet();
  const [showAIPrompt, setShowAIPrompt] = useState(false);
  const [isZenMode, setIsZenMode] = useState(false);

  // Pressing 'Esc' or 'F' key toggles Zen mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'f' || e.key === 'F') && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        setIsZenMode((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden bg-bg-primary relative">
      {/* Header */}
      {!isZenMode && (
        <div className="flex flex-wrap items-center justify-between border-b border-border bg-bg-card px-3 py-2 sm:px-4 md:px-6 gap-2">
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="text-base sm:text-lg">📋</span>
            <div>
              <h1 className="text-xs sm:text-sm font-bold text-text-primary">Planilha Inteligente</h1>
            </div>
            <CompactSummaryPills />
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button
              variant={showAIPrompt ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setShowAIPrompt(!showAIPrompt)}
              className="h-7 sm:h-8 gap-1 sm:gap-1.5 text-xs font-semibold px-2 sm:px-3"
            >
              <Sparkles className="h-3.5 w-3.5 text-accent-gold" />
              <span className="hidden xs:inline">Perguntar à IA</span>
              <span className="xs:hidden">IA</span>
            </Button>

            <PeriodSelector />

            <Button
              variant="ghost"
              size="icon"
              onClick={() => void loadView(state.activeView, state.period)}
              disabled={state.isLoading}
              title="Recarregar dados"
              className="h-7 w-7 sm:h-8 sm:w-8"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', state.isLoading && 'animate-spin')} />
            </Button>

            <div className="hidden sm:block">
              <ExportMenu />
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsZenMode(true)}
              title="Expandir planilha (Modo Foco)"
              className="hidden sm:flex h-8 gap-1 text-xs text-text-muted hover:text-accent-gold"
            >
              <Maximize2 className="h-3.5 w-3.5" />
              <span>Modo Foco (F)</span>
            </Button>
          </div>
        </div>
      )}

      {/* Floating AI Command Drawer / Modal */}
      {showAIPrompt && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 z-50 w-11/12 max-w-2xl rounded-2xl border border-accent-gold/40 bg-bg-card/95 backdrop-blur-xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between px-3 py-1 border-b border-border">
            <span className="text-xs font-bold text-accent-gold flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Assistente IA da Planilha
            </span>
            <button onClick={() => setShowAIPrompt(false)} className="text-text-muted hover:text-text-primary">
              <X className="h-4 w-4" />
            </button>
          </div>
          <CommandBar />
        </div>
      )}

      {/* Zen Mode Header Bar */}
      {isZenMode && (
        <div className="flex items-center justify-between border-b border-border bg-[#13141f] px-4 py-1.5 text-xs text-text-muted">
          <span className="font-semibold text-accent-gold flex items-center gap-1.5">
            📋 Planilha Inteligente <span className="text-[10px] text-text-muted font-normal">(Modo Foco Ativo)</span>
          </span>
          <button
            onClick={() => setIsZenMode(false)}
            className="flex items-center gap-1 rounded bg-bg-elevated px-2 py-0.5 text-xs text-text-primary hover:text-accent-gold border border-border"
          >
            <Minimize2 className="h-3 w-3" />
            <span>Sair do Modo Foco (F)</span>
          </button>
        </div>
      )}

      {/* View tabs */}
      <ViewSelector />

      {/* AI suggestion banner */}
      <AISuggestionBanner />

      {/* Main Grid — takes 100% remaining space */}
      <div className="flex-1 overflow-auto bg-bg-primary h-full">
        <MainGrid />
      </div>

      {/* Projection chart (only for projection view) */}
      <ProjectionChart />

      {/* Floating AI insight widget */}
      <InsightFooter />
    </div>
  );
}

export function SmartSheet() {
  return (
    <SmartSheetProvider>
      <SmartSheetShell />
    </SmartSheetProvider>
  );
}

