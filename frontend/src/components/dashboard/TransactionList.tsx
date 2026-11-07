import { useState } from 'react';
import { Repeat, CreditCard, ChevronDown, ChevronUp } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import { categoryMeta } from '@/lib/categories';
import { formatTime, getAmountColor } from '@/lib/format';
import { useCurrency, useFmt, useFmtRaw } from '@/contexts/CurrencyContext';
import type { Transaction } from '@/types/finance';

interface RowProps {
  tx: Transaction;
  onClick?: (tx: Transaction) => void;
}

export function TransactionRow({ tx, onClick }: RowProps) {
  const fmt = useFmt();
  const fmtRaw = useFmtRaw();
  const { currency } = useCurrency();
  const [subExpanded, setSubExpanded] = useState(false);

  const isCreditCard =
    tx.transaction_type === 'CREDIT_CARD' ||
    tx.subcategory === 'CREDIT_CARD_BILL' ||
    (tx.pluggy_transaction_id || '').startsWith('credit_card_') ||
    Boolean(tx.sub_transactions && tx.sub_transactions.length > 0);

  const subTxs = tx.sub_transactions ?? [];
  const meta = isCreditCard && !tx.category ? categoryMeta('Cartão de Crédito') : categoryMeta(tx.category);
  const txCurr = (tx.original_currency || 'BRL').toUpperCase();
  const hasDiffCurrency = Boolean(tx.original_currency && txCurr !== currency);
  const origVal = Math.abs(tx.original_amount ?? tx.amount);

  return (
    <div className="flex flex-col">
      <div
        role="button"
        tabIndex={0}
        onClick={() => onClick?.(tx)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onClick?.(tx);
          }
        }}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-200',
          onClick && 'cursor-pointer hover:bg-bg-elevated',
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-elevated text-base">
          {isCreditCard ? '💳' : meta.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-text-primary">
            {tx.merchant_name ?? tx.description}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-text-secondary mt-0.5">
            <span>{formatTime(tx.created_at)}</span>
            {hasDiffCurrency && (
              <span className="inline-flex items-center rounded bg-accent-gold/10 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-accent-gold border border-accent-gold/25">
                {tx.amount >= 0 ? '+' : '-'}{fmtRaw(origVal, txCurr)}
              </span>
            )}
            {isCreditCard && (
              <button
                type="button"
                onClick={(e) => {
                  if (subTxs.length > 0) {
                    e.stopPropagation();
                    setSubExpanded((prev) => !prev);
                  }
                }}
                className={cn(
                  'inline-flex items-center gap-1 rounded bg-purple-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-purple-300 border border-purple-500/30',
                  subTxs.length > 0 && 'cursor-pointer hover:bg-purple-500/25',
                )}
                title={subTxs.length > 0 ? 'Clique para expandir/recolher as sub-transações do cartão' : 'Cartão de Crédito'}
              >
                <CreditCard className="h-3 w-3" />
                <span>
                  Cartão{subTxs.length > 0 ? ` · ${subTxs.length} sub-transaç${subTxs.length === 1 ? 'ão' : 'ões'}` : ''}
                </span>
                {subTxs.length > 0 && (
                  subExpanded ? <ChevronUp className="h-2.5 w-2.5" /> : <ChevronDown className="h-2.5 w-2.5" />
                )}
              </button>
            )}
            {tx.is_recurring && (
              <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-amber-400 border border-amber-500/30">
                <Repeat className="h-3 w-3" />
                Assinatura
              </span>
            )}
          </div>
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
      </div>

      {isCreditCard && subExpanded && subTxs.length > 0 && (
        <div className="ml-12 mr-3 mb-2.5 rounded-xl border border-purple-500/25 bg-purple-500/5 p-2.5 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-purple-300 px-1">
            <span>Sub-transações do Cartão ({subTxs.length})</span>
            <button
              type="button"
              onClick={() => onClick?.(tx)}
              className="text-accent-gold hover:underline cursor-pointer"
            >
              Ver / Editar todas →
            </button>
          </div>
          <div className="divide-y divide-border/40">
            {subTxs.map((st) => {
              const stMeta = categoryMeta(st.category || null);
              return (
                <div
                  key={st.id}
                  onClick={() => onClick?.(tx)}
                  className="flex items-center justify-between gap-2 py-1.5 px-1 text-xs cursor-pointer hover:bg-bg-elevated/50 rounded-md"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm shrink-0">{stMeta.icon}</span>
                    <span className="truncate text-text-primary font-medium">{st.description}</span>
                    {st.category && (
                      <span className="text-[10px] text-text-muted hidden sm:inline">· {st.category}</span>
                    )}
                  </div>
                  <span className="font-mono text-xs font-semibold text-accent-red shrink-0">
                    -{fmtRaw(Math.abs(Number(st.amount) || 0), txCurr)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
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
