import { useState } from 'react';
import { Sparkles, Check, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { useInsights } from '@/hooks/useInsights';
import { api } from '@/services/api';
import { cn } from '@/lib/utils';
import { formatDateShort, formatDateFull } from '@/lib/format';
import type { InsightType } from '@/types/finance';

const TABS: { key: InsightType; label: string }[] = [
  { key: 'DAILY_SUMMARY', label: 'Diário' },
  { key: 'WEEKLY_ANALYSIS', label: 'Semanal' },
  { key: 'MONTHLY_REPORT', label: 'Mensal' },
  { key: 'PATTERN_DETECTED', label: 'Padrões' },
];

export function Insights() {
  const [tab, setTab] = useState<InsightType>('DAILY_SUMMARY');
  const { insights, loading, error, reload } = useInsights(tab);
  const { notify } = useToast();
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    setGenerating(true);
    try {
      await api.generateInsight(tab === 'MONTHLY_REPORT' ? 'MONTHLY' : 'DAILY');
      notify('Geração solicitada. Atualizando…', 'success');
      await reload();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha ao gerar.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4 p-3 sm:p-6 md:p-8">
      {/* Tabs + ação */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex overflow-x-auto no-scrollbar gap-1 rounded-lg border border-border bg-bg-card p-1 w-full sm:w-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'cursor-pointer whitespace-nowrap rounded-md px-3 py-1.5 text-xs sm:text-sm font-medium transition-colors flex-1 sm:flex-initial text-center',
                tab === t.key
                  ? 'bg-accent-gold/15 text-accent-gold'
                  : 'text-text-secondary hover:text-text-primary',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tab !== 'PATTERN_DETECTED' && (
          <Button variant="secondary" size="sm" onClick={generate} disabled={generating} className="w-full sm:w-auto justify-center">
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Gerar agora
          </Button>
        )}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : loading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="space-y-3 pt-5">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-5/6" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : insights.length === 0 ? (
        <EmptyState
          title="Nenhum insight neste período"
          description="Os insights são gerados automaticamente após a sincronização. Você também pode gerar manualmente."
        />
      ) : (
        <div className="space-y-4">
          {insights.map((insight, idx) => (
            <Card key={insight.id} className={idx === 0 ? 'border-accent-gold/30' : ''}>
              <CardContent className="pt-5">
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div>
                    <h3 className="flex items-center gap-2 font-semibold text-text-primary">
                      <Sparkles className="h-4 w-4 text-accent-gold" />
                      {insight.title}
                    </h3>
                    <p className="mt-0.5 text-xs text-text-muted">
                      {insight.period_start && insight.period_end
                        ? `${formatDateShort(insight.period_start)} — ${formatDateShort(insight.period_end)}`
                        : formatDateFull(insight.created_at)}
                    </p>
                  </div>
                  {insight.was_sent_whatsapp && (
                    <span className="flex shrink-0 items-center gap-1 rounded-md bg-accent-green/15 px-2 py-0.5 text-xs font-medium text-accent-green">
                      <Check className="h-3 w-3" /> Enviado no WhatsApp
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-line text-sm leading-[1.7] text-text-secondary">
                  {insight.narrative}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
