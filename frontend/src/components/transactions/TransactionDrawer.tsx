import { useState } from 'react';
import { X, Sparkles, Loader2, Trash2, Edit2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/services/api';
import { CATEGORY_NAMES, categoryMeta } from '@/lib/categories';
import { formatDateFull, getAmountColor } from '@/lib/format';
import { useFmt } from '@/contexts/CurrencyContext';
import { cn } from '@/lib/utils';
import type { Transaction } from '@/types/finance';

interface Props {
  transaction: Transaction | null;
  onClose: () => void;
  onUpdated: (tx: Transaction) => void;
  onEdit: (tx: Transaction) => void;
  onDeleted: () => void;
}

export function TransactionDrawer({ transaction, onClose, onUpdated, onEdit, onDeleted }: Props) {
  const { notify } = useToast();
  const fmt = useFmt();
  const [saving, setSaving] = useState(false);
  const [recategorizing, setRecategorizing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!transaction) return null;
  const tx = transaction;
  const meta = categoryMeta(tx.category);

  const handleCategoryChange = async (category: string) => {
    setSaving(true);
    try {
      const { transaction } = await api.updateCategory(tx.id, category);
      onUpdated(transaction);
      notify('Categoria atualizada.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha ao atualizar.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRecategorize = async () => {
    setRecategorizing(true);
    try {
      const { transaction } = await api.recategorize(tx.id);
      onUpdated(transaction);
      notify('Recategorizado pela IA.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha na IA.', 'error');
    } finally {
      setRecategorizing(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Tem certeza que deseja excluir esta transação?')) return;
    setDeleting(true);
    try {
      await api.deleteTransaction(tx.id);
      notify('Transação excluída.', 'success');
      onDeleted();
      onClose();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha ao excluir.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Drawer */}
      <div className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-bg-card shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between border-b border-border p-4">
          <h2 className="font-semibold text-text-primary">
            Detalhes da transação
          </h2>
          <button
            onClick={onClose}
            className="cursor-pointer text-text-muted hover:text-text-primary"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5 pb-[calc(2rem+env(safe-area-inset-bottom,0px))]">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-bg-elevated text-2xl">
              {meta.icon}
            </span>
            <div>
              <p className="font-medium text-text-primary">
                {tx.merchant_name ?? tx.description}
              </p>
              <p className="text-xs text-text-secondary">
                {formatDateFull(tx.date)}
              </p>
            </div>
          </div>

          <div>
            <p
              className={cn(
                'font-mono text-3xl font-bold tabular-nums tnum',
                getAmountColor(tx.amount),
              )}
            >
              {tx.amount >= 0 ? '+' : '-'}
              {fmt(tx)}
            </p>
            {tx.original_currency && tx.original_currency !== 'BRL' && (
              <p className="mt-1 text-xs text-text-secondary font-mono">
                Valor original: {tx.original_amount !== undefined && tx.original_amount !== null ? Math.abs(tx.original_amount).toFixed(2) : ''} {tx.original_currency}
                {tx.exchange_rate ? ` · Cotação gravada: 1 ${tx.original_currency} = ${Number(tx.exchange_rate).toFixed(4)} BRL` : ''}
              </p>
            )}
          </div>

          <Detail label="Descrição original" value={tx.raw_description ?? '—'} />
          <Detail label="Tipo" value={tx.transaction_type} />
          {tx.subcategory && (
            <Detail label="Subcategoria" value={tx.subcategory} />
          )}
          {tx.ai_confidence !== null && (
            <Detail
              label="Confiança da IA"
              value={`${Math.round(tx.ai_confidence * 100)}%`}
            />
          )}

          {/* Categoria editável */}
          <div>
            <label
              htmlFor="tx-category"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-text-secondary"
            >
              Categoria
            </label>
            <select
              id="tx-category"
              value={tx.category ?? ''}
              disabled={saving}
              onChange={(e) => void handleCategoryChange(e.target.value)}
              className="w-full cursor-pointer rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm text-text-primary focus:border-accent-gold focus:outline-none"
            >
              <option value="" disabled>
                Selecione…
              </option>
              {CATEGORY_NAMES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Notas da IA */}
          {tx.ai_notes && (
            <div className="rounded-lg border border-accent-gold/30 bg-accent-gold/5 p-3">
              <p className="mb-1 flex items-center gap-1.5 text-xs font-medium text-accent-gold">
                <Sparkles className="h-3.5 w-3.5" /> Notas da IA
              </p>
              <p className="text-sm text-text-secondary">{tx.ai_notes}</p>
            </div>
          )}

          {tx.is_anomaly && (
            <Badge color="#EF4444">⚠️ {tx.anomaly_reason ?? 'Anomalia'}</Badge>
          )}
        </div>

        <div className="border-t border-border p-4">
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => void handleRecategorize()}
            disabled={recategorizing}
          >
            {recategorizing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 text-accent-gold" />
            )}
            Recategorizar com IA
          </Button>

          <div className="mt-3 flex gap-2">
            <Button
              variant="secondary"
              className="flex-1 gap-1.5"
              onClick={() => onEdit(tx)}
            >
              <Edit2 className="h-4 w-4" />
              Editar
            </Button>
            <Button
              variant="secondary"
              className="flex-1 gap-1.5 border-accent-red/30 text-accent-red hover:bg-accent-red/10"
              onClick={() => void handleDelete()}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              Excluir
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-text-secondary">
        {label}
      </p>
      <p className="mt-0.5 text-sm text-text-primary">{value}</p>
    </div>
  );
}
