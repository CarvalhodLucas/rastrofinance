import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFmt } from '@/contexts/CurrencyContext';
import { SummaryCardSkeleton } from '@/components/ui/Skeleton';
import type { TransactionsSummary } from '@/types/finance';

interface CardDef {
  label: string;
  value: number;
  accent: string; // cor da borda esquerda
  delta?: { pct: number; suffix?: string };
}

function SummaryCard({ label, value, accent, delta }: CardDef) {
  const fmt = useFmt();
  const up = (delta?.pct ?? 0) >= 0;
  return (
    <div
      className="card border-l-2 p-4 sm:p-5"
      style={{ borderLeftColor: accent }}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
        {label}
      </p>
      <p className="mt-1.5 font-mono text-2xl sm:text-3xl font-bold tabular-nums text-text-primary tnum truncate">
        {fmt(value)}
      </p>
      {delta && (
        <p
          className={cn(
            'mt-1 flex items-center gap-1 text-xs font-medium',
            up ? 'text-accent-green' : 'text-accent-red',
          )}
        >
          {up ? (
            <ArrowUpRight className="h-3.5 w-3.5" />
          ) : (
            <ArrowDownRight className="h-3.5 w-3.5" />
          )}
          {Math.abs(delta.pct).toFixed(1)}% {delta.suffix ?? ''}
        </p>
      )}
    </div>
  );
}

interface SummaryCardsProps {
  summary: TransactionsSummary | null;
  previousSpent?: number;
  loading: boolean;
}

export function SummaryCards({
  summary,
  previousSpent,
  loading,
}: SummaryCardsProps) {
  if (loading || !summary) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SummaryCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const balance = summary.balance;
  const spent = summary.totalSpent;
  const income = summary.totalIncome;
  const savings = income - spent;

  const spentDelta =
    previousSpent && previousSpent > 0
      ? ((spent - previousSpent) / previousSpent) * 100
      : undefined;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <SummaryCard label="Saldo do mês" value={balance} accent="#F59E0B" />
      <SummaryCard
        label="Gastos do mês"
        value={spent}
        accent="#EF4444"
        delta={
          spentDelta !== undefined
            ? { pct: spentDelta, suffix: 'vs mês ant.' }
            : undefined
        }
      />
      <SummaryCard label="Receita do mês" value={income} accent="#10B981" />
      <SummaryCard label="Economia do mês" value={savings} accent="#3B82F6" />
    </div>
  );
}
