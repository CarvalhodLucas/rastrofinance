import { cn } from '@/lib/utils';

/**
 * Skeleton com o elemento assinatura: a linha dourada (.scan-line) varre
 * o bloco da esquerda para a direita enquanto os dados carregam.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-md bg-bg-elevated/60',
        className,
      )}
      aria-hidden="true"
    >
      <div className="scan-line" />
    </div>
  );
}

/** Skeleton para um summary card. */
export function SummaryCardSkeleton() {
  return (
    <div className="card border-l-2 border-l-border p-5">
      <div className="scan-line" />
      <Skeleton className="mb-3 h-3 w-24" />
      <Skeleton className="mb-2 h-9 w-32" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

/** Skeleton para o gráfico. */
export function ChartSkeleton() {
  return (
    <div className="card p-5">
      <div className="scan-line" />
      <Skeleton className="mb-4 h-4 w-40" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
