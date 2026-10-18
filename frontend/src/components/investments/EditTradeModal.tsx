import { useEffect, useState } from 'react';
import { X, Loader2, Save, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/services/api';
import type { InvestmentTrade, TradeType } from '@/types/finance';

interface Props {
  open: boolean;
  trade: InvestmentTrade | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditTradeModal({ open, trade, onClose, onSuccess }: Props) {
  const { notify } = useToast();

  const [date, setDate] = useState('');
  const [tradeType, setTradeType] = useState<TradeType>('BUY');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [totalValue, setTotalValue] = useState('');
  const [institution, setInstitution] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (trade && open) {
      setDate(trade.date ? trade.date.substring(0, 10) : new Date().toISOString().substring(0, 10));
      setTradeType(trade.trade_type || 'BUY');
      setQuantity(String(trade.quantity || ''));
      setUnitPrice(String(trade.unit_price || ''));
      setTotalValue(String(trade.total_value || ''));
      setInstitution(trade.institution || '');
      setNotes(trade.notes || '');
    }
  }, [trade, open]);

  if (!open || !trade) return null;

  const handleQtyPriceChange = (newQtyStr: string, newPriceStr: string) => {
    setQuantity(newQtyStr);
    setUnitPrice(newPriceStr);
    const q = parseFloat(newQtyStr) || 0;
    const p = parseFloat(newPriceStr) || 0;
    if (q > 0 && p > 0) {
      setTotalValue(String(q * p));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numQty = parseFloat(quantity) || 0;
    const numPrice = parseFloat(unitPrice) || 0;
    const numTotal = parseFloat(totalValue) || (numQty * numPrice);

    if (numQty <= 0) {
      notify('Informe uma quantidade válida.', 'error');
      return;
    }

    setLoading(true);
    try {
      await api.updateTrade(trade.id, {
        trade_type: tradeType,
        quantity: numQty,
        unit_price: numPrice,
        total_value: numTotal,
        institution: institution.trim() || trade.institution,
        date: date ? new Date(date + 'T12:00:00Z').toISOString() : trade.date,
        notes: notes.trim(),
      });

      notify('Transação atualizada com sucesso!', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      notify(err.message || 'Erro ao atualizar transação.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-bg-card shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-bg-elevated/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30">
              <Edit3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                Editar Transação
                <span className="text-xs px-2 py-0.5 rounded-md bg-bg-primary text-text-secondary border border-border font-mono">
                  {trade.ticker}
                </span>
              </h2>
              <p className="text-xs text-text-secondary">{trade.asset_name || trade.ticker}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Tipo de Operação & Data */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Tipo de Operação</label>
              <select
                value={tradeType}
                onChange={(e) => setTradeType(e.target.value as TradeType)}
                className="w-full rounded-xl border border-border bg-bg-primary px-3 py-2 text-xs font-semibold text-text-primary focus:border-accent-gold focus:outline-none transition-colors"
              >
                <option value="BUY">Compra (BUY)</option>
                <option value="SELL">Venda (SELL)</option>
                <option value="SWAP">Troca (SWAP)</option>
                <option value="DEPOSIT">Depósito (DEPOSIT)</option>
                <option value="EARN_SUB">Earn ⇒ Bloqueio</option>
                <option value="EARN_REDEEM">Earn ⇒ Resgate</option>
                <option value="EARN_INTEREST">Rendimentos / Proventos</option>
                <option value="AIRDROP">Airdrop / Bonificação</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Data</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-bg-primary px-3 py-2 text-xs font-mono text-text-primary focus:border-accent-gold focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Quantidade e Preço Unitário */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Quantidade</label>
              <input
                type="number"
                step="any"
                required
                value={quantity}
                onChange={(e) => handleQtyPriceChange(e.target.value, unitPrice)}
                className="w-full rounded-xl border border-border bg-bg-primary px-3.5 py-2 text-sm font-mono text-text-primary focus:border-accent-gold focus:outline-none transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Preço Unitário (R$)</label>
              <input
                type="number"
                step="any"
                value={unitPrice}
                onChange={(e) => handleQtyPriceChange(quantity, e.target.value)}
                className="w-full rounded-xl border border-border bg-bg-primary px-3.5 py-2 text-sm font-mono text-text-primary focus:border-accent-gold focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Valor Total & Instituição */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Valor Total (R$)</label>
              <input
                type="number"
                step="any"
                value={totalValue}
                onChange={(e) => setTotalValue(e.target.value)}
                className="w-full rounded-xl border border-border bg-bg-primary px-3.5 py-2 text-sm font-mono text-text-primary focus:border-accent-gold focus:outline-none transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Instituição / Corretora</label>
              <input
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className="w-full rounded-xl border border-border bg-bg-primary px-3.5 py-2 text-xs text-text-primary focus:border-accent-gold focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Observações / Notas */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">Observações / Detalhes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: Compra fracionada..."
              className="w-full rounded-xl border border-border bg-bg-primary px-3.5 py-2 text-xs text-text-primary focus:border-accent-gold focus:outline-none transition-colors"
            />
          </div>

          {/* Botões de Ação */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading}
              className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
