import { Repeat } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { categoryMeta } from '@/lib/categories';
import { formatTime, getAmountColor } from '@/lib/format';
import { useFmt } from '@/contexts/CurrencyContext';
import type { Transaction } from '@/types/finance';

interface RowProps {
  tx: Transaction;
  onClick?: (tx: Transaction) => void;
}

export function TransactionRow({ tx, onClick }: RowProps) {
  const fmt = useFmt();
  const meta = categoryMeta(tx.category);
  return (
    <button
      type="button"
      onClick={() => onClick?.(tx)}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-200',
        onClick && 'cursor-pointer hover:bg-bg-elevated',
      )}
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-elevated text-base">
        {meta.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary">
          {tx.merchant_name ?? tx.description}
        </p>
        <p className="flex items-center gap-1.5 text-xs text-text-secondary">
          {formatTime(tx.created_at)}
          {tx.is_recurring && (
            <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400 border border-amber-500/30">
              <Repeat className="h-3 w-3" />
              Assinatura
            </span>
          )}
        </p>
      </div>
      {tx.category && (
        <Badge color={meta.color} className="hidden sm:inline-flex">
          {tx.category}
        </Badge>
      )}
      <span
        className={cn(
          'w-24 shrink-0 text-right font-mono text-sm font-semibold tabular-nums tnum',
          getAmountColor(tx.amount),
        )}
      >
        {tx.amount >= 0 ? '+' : '-'}
        {fmt(tx)}
      </span>
    </button>
  );
}

interface ListProps {
  transactions: Transaction[];
  onSelect?: (tx: Transaction) => void;
}

/** Lista simples (sem agrupamento) — usada no card "últimas transações". */
export function TransactionList({ transactions, onSelect }: ListProps) {
  return (
    <div className="divide-y divide-border/60">
      {transactions.map((tx) => (
        <TransactionRow key={tx.id} tx={tx} onClick={onSelect} />
      ))}
    </div>
  );
}
