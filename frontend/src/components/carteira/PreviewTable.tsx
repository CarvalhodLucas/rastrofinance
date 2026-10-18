import { useState } from 'react';
import { AlertTriangle, Edit2, Check, X, Trash2, Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useCurrency } from '@/contexts/CurrencyContext';
import { api } from '@/services/api';

interface PreviewTableProps {
  batchId: string;
  initialParsed: any[];
  initialNeedsReview: any[];
  onConfirm: (summary: { imported: number; newHoldings: number; totalInvested: number }) => void;
  onCancel: () => void;
}

export function PreviewTable({
  batchId,
  initialParsed,
  initialNeedsReview,
  onConfirm,
  onCancel,
}: PreviewTableProps) {
  const { notify } = useToast();
  const { fmt } = useCurrency();
  const [items, setItems] = useState<any[]>(() => {
    // Garante que todas as linhas tenham um identificador único de index local
    return [...initialParsed, ...initialNeedsReview].map((item, idx) => ({
      ...item,
      localId: idx,
    }));
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const needsReviewCount = items.filter((item) => item.needs_review).length;

  const handleStartEdit = (item: any) => {
    setEditingId(item.localId);
    setEditForm({ ...item });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const handleSaveEdit = (localId: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.localId === localId
          ? {
              ...editForm,
              // Marca como revisado após edição manual
              needs_review: false,
              confidence: 1.0,
            }
          : item
      )
    );
    setEditingId(null);
    setEditForm(null);
    notify('Linha atualizada localmente.', 'success');
  };

  const handleRemoveRow = (localId: number) => {
    setItems((prev) => prev.filter((item) => item.localId !== localId));
    notify('Transação removida da importação.', 'success');
  };

  const handleFieldChange = (field: string, value: any) => {
    const updated = { ...editForm, [field]: value };
    
    // Recalcula valor total automaticamente se quantidade ou preço unitário mudar
    if (field === 'quantity' || field === 'unit_price') {
      const q = field === 'quantity' ? Number(value) : Number(updated.quantity);
      const p = field === 'unit_price' ? Number(value) : Number(updated.unit_price);
      updated.total_value = q * p;
    }
    setEditForm(updated);
  };

  const handleCancelImport = async () => {
    setIsCancelling(true);
    try {
      await api.cancelB3Import(batchId);
      notify('Importação cancelada com sucesso.', 'success');
      onCancel();
    } catch (err: any) {
      notify(err.message || 'Erro ao cancelar importação.', 'error');
    } finally {
      setIsCancelling(false);
    }
  };

  const handleConfirmImport = async () => {
    if (items.length === 0) {
      notify('Nenhuma transação disponível para importar.', 'error');
      return;
    }

    if (needsReviewCount > 0) {
      notify(`Existem ${needsReviewCount} transações pendentes de revisão. Revise ou remova-as antes de confirmar.`, 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await api.confirmB3Import(batchId, items);
      notify('Transações importadas com sucesso!', 'success');
      onConfirm(result);
    } catch (err: any) {
      notify(err.message || 'Erro ao salvar transações no banco.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '—';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Resumo no topo */}
      <div className="flex flex-col sm:flex-row items-center justify-between p-4 rounded-xl border border-border bg-bg-card gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent-gold/10 text-accent-gold">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-semibold text-text-primary">
              {items.length} {items.length === 1 ? 'transação encontrada' : 'transações encontradas'}
            </h3>
            <p className="text-xs text-text-secondary">
              {needsReviewCount > 0
                ? `${needsReviewCount} transação(ões) precisam de revisão manual`
                : 'Todas as transações foram revisadas e validadas'}
            </p>
          </div>
        </div>
        {needsReviewCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-accent-gold/25 bg-accent-gold/5 text-xs font-medium text-accent-gold">
            <AlertTriangle className="h-4 w-4" />
            <span>Atenção: Revise as linhas destacadas em amarelo.</span>
          </div>
        )}
      </div>

      {/* Grid responsivo com scroll lateral */}
      <div className="overflow-x-auto rounded-xl border border-border bg-bg-card">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-border bg-bg-elevated text-xs font-semibold uppercase tracking-wider text-text-secondary">
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Ativo</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Classe</th>
              <th className="px-4 py-3 text-right">Qtd</th>
              <th className="px-4 py-3 text-right">Preço</th>
              <th className="px-4 py-3 text-right">Valor Total</th>
              <th className="px-4 py-3">Corretora</th>
              <th className="px-4 py-3 text-center">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border text-sm text-text-primary">
            {items.map((item) => {
              const isEditing = editingId === item.localId;
              const hasWarning = item.needs_review || item.confidence < 0.5;

              return (
                <tr
                  key={item.localId}
                  className={`transition-colors duration-150 ${
                    isEditing
                      ? 'bg-bg-elevated/40'
                      : hasWarning
                      ? 'bg-accent-gold/5 hover:bg-accent-gold/10'
                      : 'hover:bg-bg-elevated/20'
                  }`}
                >
                  {isEditing ? (
                    // LINHA DE EDIÇÃO
                    <>
                      <td className="px-3 py-2 min-w-[130px]">
                        <input
                          type="date"
                          value={editForm.operation_date}
                          onChange={(e) => handleFieldChange('operation_date', e.target.value)}
                          className="w-full rounded-md border border-border bg-bg-primary px-2.5 py-1 text-sm text-text-primary focus:border-accent-gold focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2 min-w-[100px]">
                        <input
                          type="text"
                          value={editForm.asset_ticker}
                          onChange={(e) => handleFieldChange('asset_ticker', e.target.value)}
                          className="w-full rounded-md border border-border bg-bg-primary px-2.5 py-1 text-sm uppercase text-text-primary focus:border-accent-gold focus:outline-none font-mono"
                        />
                      </td>
                      <td className="px-3 py-2 min-w-[125px]">
                        <select
                          value={editForm.operation_type}
                          onChange={(e) => handleFieldChange('operation_type', e.target.value)}
                          className="w-full rounded-md border border-border bg-bg-primary px-2 py-1 text-sm text-text-primary focus:border-accent-gold focus:outline-none"
                        >
                          <option value="COMPRA">COMPRA</option>
                          <option value="VENDA">VENDA</option>
                          <option value="PROVENTO">PROVENTO</option>
                          <option value="JCP">JCP</option>
                          <option value="DESDOBRAMENTO">DESDOBRAMENTO</option>
                          <option value="BONIFICACAO">BONIFICAÇÃO</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 min-w-[140px]">
                        <select
                          value={editForm.asset_type}
                          onChange={(e) => handleFieldChange('asset_type', e.target.value)}
                          className="w-full rounded-md border border-border bg-bg-primary px-2 py-1 text-sm text-text-primary focus:border-accent-gold focus:outline-none"
                        >
                          <option value="ACAO">AÇÃO</option>
                          <option value="FII">FII</option>
                          <option value="ETF">ETF</option>
                          <option value="BDR">BDR</option>
                          <option value="RENDA_FIXA">RENDA FIXA</option>
                          <option value="OUTRO">OUTRO</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 min-w-[90px]">
                        <input
                          type="number"
                          step="any"
                          value={editForm.quantity}
                          onChange={(e) => handleFieldChange('quantity', e.target.value)}
                          className="w-full rounded-md border border-border bg-bg-primary px-2 py-1 text-sm text-right text-text-primary focus:border-accent-gold focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2 min-w-[100px]">
                        <input
                          type="number"
                          step="any"
                          value={editForm.unit_price ?? ''}
                          onChange={(e) => handleFieldChange('unit_price', e.target.value)}
                          className="w-full rounded-md border border-border bg-bg-primary px-2 py-1 text-sm text-right text-text-primary focus:border-accent-gold focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2 min-w-[120px]">
                        <input
                          type="number"
                          step="any"
                          value={editForm.total_value}
                          onChange={(e) => handleFieldChange('total_value', e.target.value)}
                          className="w-full rounded-md border border-border bg-bg-primary px-2 py-1 text-sm text-right text-text-primary focus:border-accent-gold focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2 min-w-[120px]">
                        <input
                          type="text"
                          value={editForm.broker || ''}
                          onChange={(e) => handleFieldChange('broker', e.target.value)}
                          className="w-full rounded-md border border-border bg-bg-primary px-2.5 py-1 text-sm text-text-primary focus:border-accent-gold focus:outline-none"
                        />
                      </td>
                      <td className="px-3 py-2 text-center whitespace-nowrap min-w-[100px]">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleSaveEdit(item.localId)}
                            className="p-1 rounded bg-accent-green/20 text-accent-green hover:bg-accent-green/30 transition-colors cursor-pointer"
                            title="Salvar"
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            className="p-1 rounded bg-bg-elevated text-text-secondary hover:text-text-primary transition-colors cursor-pointer border border-border"
                            title="Cancelar"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  ) : (
                    // LINHA DE LEITURA
                    <>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {hasWarning && (
                            <span title={`IA com confiança baixa (${Math.round((item.confidence || 0) * 100)}%)`}>
                              <AlertTriangle className="h-4 w-4 text-accent-gold shrink-0" />
                            </span>
                          )}
                          <span>{formatDate(item.operation_date)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono font-bold tracking-wide uppercase">
                        {item.asset_ticker}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                            item.operation_type === 'COMPRA'
                              ? 'bg-accent-green/10 text-accent-green'
                              : item.operation_type === 'VENDA'
                              ? 'bg-accent-red/10 text-accent-red'
                              : 'bg-blue-500/10 text-blue-400'
                          }`}
                        >
                          {item.operation_type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-xs text-text-secondary">
                        {item.asset_type}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-medium">
                        {Number(item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 6 })}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-text-secondary">
                        {item.unit_price !== null ? fmt(item.unit_price) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold">
                        {fmt(item.total_value)}
                      </td>
                      <td className="px-4 py-3 text-text-secondary truncate max-w-[150px]" title={item.broker || '—'}>
                        {item.broker || '—'}
                      </td>
                      <td className="px-4 py-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleStartEdit(item)}
                            className="p-1 text-text-secondary hover:text-accent-gold transition-colors cursor-pointer"
                            title="Editar"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleRemoveRow(item.localId)}
                            className="p-1 text-text-secondary hover:text-accent-red transition-colors cursor-pointer"
                            title="Remover"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Botões de Ação */}
      <div className="flex items-center justify-between gap-4 pt-4 border-t border-border">
        <Button
          onClick={handleCancelImport}
          variant="ghost"
          disabled={isCancelling || isSubmitting}
          className="cursor-pointer"
        >
          {isCancelling ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Cancelando...</span>
            </>
          ) : (
            <span>Cancelar importação</span>
          )}
        </Button>

        <Button
          onClick={handleConfirmImport}
          variant="primary"
          disabled={isCancelling || isSubmitting || needsReviewCount > 0}
          className="px-8 shadow-[0_0_15px_rgba(245,158,11,0.2)] cursor-pointer"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Confirmando...</span>
            </>
          ) : (
            <span>Confirmar e Importar</span>
          )}
        </Button>
      </div>
    </div>
  );
}
