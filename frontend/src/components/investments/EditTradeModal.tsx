import { useEffect, useState } from 'react';
import { X, Loader2, Save, Edit3, Calculator } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/services/api';
import { getBankLogo } from '@/utils/assetLogos';
import type { InvestmentTrade, TradeType } from '@/types/finance';

interface Props {
  open: boolean;
  trade: InvestmentTrade | null;
  onClose: () => void;
  onSuccess: () => void;
}

const QUICK_INSTITUTIONS = ['Revolut X', 'Binance', 'Revolut', 'Wise', 'NuInvest', 'XP Investimentos', 'BTG Pactual', 'Inter', 'Itaú'];

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
      setQuantity(String(trade.quantity ?? ''));
      setUnitPrice(String(trade.unit_price ? Number(trade.unit_price.toFixed(6)) : ''));
      setTotalValue(String(trade.total_value ? Number(trade.total_value.toFixed(2)) : ''));
      setInstitution(trade.institution || '');
      setNotes(trade.notes || '');
    }
  }, [trade, open]);

  if (!open || !trade) return null;

  const isCrypto =
    trade.asset_type === 'CRYPTO' ||
    (trade.institution || '').toLowerCase().includes('binance') ||
    (trade.institution || '').toLowerCase().includes('revolut x');

  const currSymbol = isCrypto ? 'US$' : 'R$';
  const currLabel = isCrypto ? 'USD ($)' : 'BRL (R$)';

  const handleQtyChange = (newQtyStr: string) => {
    setQuantity(newQtyStr);
    const q = parseFloat(newQtyStr) || 0;
    const p = parseFloat(unitPrice) || 0;
    if (q > 0 && p > 0) {
      setTotalValue((q * p).toFixed(2));
    }
  };

  const handleUnitPriceChange = (newPriceStr: string) => {
    setUnitPrice(newPriceStr);
    const q = parseFloat(quantity) || 0;
    const p = parseFloat(newPriceStr) || 0;
    if (q > 0 && p > 0) {
      setTotalValue((q * p).toFixed(2));
    }
  };

  const handleTotalValueChange = (newTotalStr: string) => {
    setTotalValue(newTotalStr);
    const tot = parseFloat(newTotalStr) || 0;
    const p = parseFloat(unitPrice) || 0;
    if (tot > 0 && p > 0) {
      const calcQty = tot / p;
      setQuantity(isCrypto ? calcQty.toFixed(8).replace(/\.?0+$/, '') : calcQty.toFixed(4).replace(/\.?0+$/, ''));
    }
  };

  const handleCalcQtyFromTotal = () => {
    const tot = parseFloat(totalValue) || 0;
    const p = parseFloat(unitPrice) || 0;
    if (tot > 0 && p > 0) {
      const calcQty = tot / p;
      setQuantity(isCrypto ? calcQty.toFixed(8).replace(/\.?0+$/, '') : calcQty.toFixed(4).replace(/\.?0+$/, ''));
      notify(`Quantidade recalculada: ${(tot / p).toFixed(isCrypto ? 8 : 4)} ${trade.ticker}`, 'info');
    } else {
      notify('Preencha o Preço Unitário e o Valor Total para calcular a quantidade.', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numQty = parseFloat(quantity) || 0;
    const numPrice = parseFloat(unitPrice) || 0;
    const numTotal = parseFloat(totalValue) || numQty * numPrice;

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

      notify(`Lançamento de ${trade.ticker} atualizado e saldo/PM recalculados!`, 'success');
      window.dispatchEvent(new Event('investments-updated'));
      onSuccess();
      onClose();
    } catch (err: any) {
      notify(err.message || 'Erro ao atualizar lançamento.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-bg-card shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4 bg-bg-elevated/40">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-gold/15 text-accent-gold border border-accent-gold/30">
              <Edit3 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                Editar Lançamento
                <span className="text-xs px-2 py-0.5 rounded-md bg-accent-gold/15 text-accent-gold border border-accent-gold/30 font-mono font-bold">
                  {trade.ticker}
                </span>
              </h2>
              <p className="text-xs text-text-secondary">
                Ao salvar, a quantidade total e o Preço Médio do ativo são recalculados automaticamente
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors cursor-pointer"
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
                className="w-full rounded-xl border border-border bg-bg-primary px-3 py-2 text-xs font-semibold text-text-primary focus:border-accent-gold focus:outline-none transition-colors cursor-pointer"
              >
                <option value="BUY">Compra (BUY)</option>
                <option value="SELL">Venda (SELL)</option>
                <option value="SWAP">Troca / Conversão (SWAP)</option>
                <option value="DEPOSIT">Depósito (DEPOSIT)</option>
                <option value="EARN_SUB">Earn ⇒ Bloqueio</option>
                <option value="EARN_REDEEM">Earn ⇒ Resgate</option>
                <option value="EARN_INTEREST">Rendimentos / Proventos</option>
                <option value="AIRDROP">Airdrop / Bonificação</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Data do Lançamento</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-border bg-bg-primary px-3 py-2 text-xs font-mono text-text-primary focus:border-accent-gold focus:outline-none transition-colors cursor-pointer"
              />
            </div>
          </div>

          {/* Preço Unitário & Valor Total Investido */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">
                Preço Unitário do {trade.ticker} ({currLabel})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-text-muted">
                  {currSymbol}
                </span>
                <input
                  type="number"
                  step="any"
                  value={unitPrice}
                  onChange={(e) => handleUnitPriceChange(e.target.value)}
                  placeholder="Ex: 73500"
                  className="w-full rounded-xl border border-border bg-bg-primary pl-10 pr-3.5 py-2 text-sm font-mono font-bold text-text-primary focus:border-accent-gold focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">
                Valor Total da Operação ({currLabel})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-text-muted">
                  {currSymbol}
                </span>
                <input
                  type="number"
                  step="any"
                  value={totalValue}
                  onChange={(e) => handleTotalValueChange(e.target.value)}
                  placeholder="Ex: 165.00"
                  className="w-full rounded-xl border border-border bg-bg-primary pl-10 pr-3.5 py-2 text-sm font-mono font-bold text-emerald-400 focus:border-accent-gold focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Quantidade do Ativo */}
          <div className="space-y-1.5 rounded-xl border border-accent-gold/30 bg-accent-gold/5 p-3.5">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-bold text-accent-gold">
                Quantidade de {trade.ticker}
              </label>
              <button
                type="button"
                onClick={handleCalcQtyFromTotal}
                className="inline-flex items-center gap-1 rounded-lg bg-accent-gold/15 hover:bg-accent-gold/25 border border-accent-gold/30 px-2 py-0.5 text-[11px] font-semibold text-accent-gold transition-colors cursor-pointer"
                title="Divide o Valor Total pelo Preço Unitário para obter a quantidade exata"
              >
                <Calculator className="h-3 w-3" />
                <span>Calcular Quant. (Total ÷ Preço)</span>
              </button>
            </div>
            <input
              type="number"
              step="any"
              required
              value={quantity}
              onChange={(e) => handleQtyChange(e.target.value)}
              className="w-full rounded-xl border border-accent-gold/40 bg-bg-primary px-3.5 py-2 text-sm font-mono font-bold text-text-primary focus:border-accent-gold focus:outline-none transition-colors"
            />
            <p className="text-[11px] text-text-secondary">
              Dica: Se você alterar o <strong>Valor Total</strong> e o <strong>Preço Unitário</strong> acima, a quantidade de {trade.ticker} é calculada automaticamente.
            </p>
          </div>

          {/* Instituição / Corretora */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">Instituição / Corretora</label>
            <div className="flex flex-wrap gap-1.5 pb-1">
              {QUICK_INSTITUTIONS.map((inst) => {
                const logo = getBankLogo(inst);
                const isSel = institution.trim().toLowerCase() === inst.toLowerCase();
                return (
                  <button
                    key={inst}
                    type="button"
                    onClick={() => setInstitution(inst)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] transition-all cursor-pointer ${
                      isSel
                        ? 'border-accent-gold bg-accent-gold/20 text-accent-gold font-bold'
                        : 'border-border bg-bg-elevated/50 text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {logo && <img src={logo} alt={inst} className="h-3.5 w-3.5 rounded-full object-contain bg-white/90 p-0.2" />}
                    <span>{inst}</span>
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg-primary px-3.5 py-2 text-xs text-text-primary focus:border-accent-gold focus:outline-none transition-colors"
            />
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
              variant="primary"
              size="sm"
              disabled={loading}
              className="gap-2 font-bold"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Salvar e Recalcular Ativo
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
