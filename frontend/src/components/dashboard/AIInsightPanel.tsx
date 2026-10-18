import { Sparkles, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatTime } from '@/lib/format';
import type { AiInsight } from '@/types/finance';

interface Props {
  insight: AiInsight | undefined;
  loading: boolean;
}

/** Card especial da IA — gradiente sutil + borda dourada translúcida. */
export function AIInsightPanel({ insight, loading }: Props) {
  return (
    <div
      className="relative flex h-full flex-col overflow-hidden rounded-xl border p-5"
      style={{
        borderColor: 'rgba(245, 158, 11, 0.3)',
        background: 'linear-gradient(160deg, #111827 0%, #1a2235 100%)',
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-accent-gold" />
          <span className="text-sm font-semibold text-text-primary">
            Insight da IA
          </span>
        </div>
        <span className="rounded-md bg-accent-gold/15 px-2 py-0.5 text-xs font-bold text-accent-gold">
          IA
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ) : !insight ? (
        <p className="text-sm leading-relaxed text-text-secondary">
          Ainda não há insights. Eles são gerados automaticamente após a
          sincronização e categorização das suas transações.
        </p>
      ) : (
        <>
          <h4 className="mb-2 font-semibold text-text-primary">
            {insight.title}
          </h4>
          <p className="flex-1 text-sm leading-[1.7] text-text-secondary line-clamp-[10]">
            {insight.narrative}
          </p>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-xs text-text-muted">
              Gerado às {formatTime(insight.created_at)}
            </span>
            <Link
              to="/insights"
              className="flex items-center gap-1 text-xs font-medium text-accent-gold hover:underline"
            >
              Ver análise completa
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
