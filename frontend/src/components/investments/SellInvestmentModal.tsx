import { useEffect, useState } from 'react';
import { X, Loader2, ArrowUpRight, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/services/api';
import type { Investment } from '@/types/finance';
import type { Currency } from '@/contexts/CurrencyContext';

interface Props {
  open: boolean;
  investment: Investment | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function SellInvestmentModal({ open, investment, onClose, onSuccess }: Props) {
  const { notify } = useToast();

  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const isCashOrStable = investment
    ? (investment.code_ticker?.toUpperCase().includes('WISE_') ||
       investment.name?.toUpperCase().includes('WISE') ||
       investment.name?.toUpperCase().includes('CAIXINHA') ||
       investment.name?.toUpperCase().includes('SALDO') ||
       ['EUR', 'USD', 'USDT', 'USDC', 'BRL'].includes(investment.code_ticker?.toUpperCase()))
    : false;

  useEffect(() => {
    if (investment && open) {
      setQuantity(String(investment.quantity));
      setUnitPrice(isCashOrStable ? '1' : String(investment.current_price || investment.average_price || ''));
      setSaleDate(new Date().toISOString().split('T')[0]);
      setNotes('');
    }
  }, [investment, open, isCashOrStable]);

  if (!open || !investment) return null;

  // Determinar a moeda do ativo para exibição correta de símbolos e valores
  const getAssetCurrency = () => {
    const assetType = investment.asset_type;
    const inst = (investment.institution || '').toUpperCase();
    const name = (investment.name || '').toUpperCase();
    const ticker = (investment.code_ticker || '').toUpperCase();

    const isCrypto =
      assetType === 'CRYPTO' ||
      inst.includes('BINANCE') ||
      investment.currency === 'USD' ||
      investment.currency === 'USDT' ||
      name.includes('WISE_USD') ||
      ['BTC', 'ETH', 'SOL', 'ONDO', 'SXT', 'LINK', 'RENDER', 'ROSE', 'VIRTUAL'].includes(ticker);

    if (isCrypto) {
      return { code: 'USD' as Currency, symbol: '$' };
    } else if (investment.currency === 'EUR' || name.includes('WISE_EUR')) {
      return { code: 'EUR' as Currency, symbol: '€' };
    } else if (investment.currency === 'CLP') {
      return { code: 'CLP' as Currency, symbol: '$' };
    }
    
    return { code: 'BRL' as Currency, symbol: 'R$' };
  };

  const { code: assetCurrencyCode, symbol: assetCurrencySymbol } = getAssetCurrency();

  const formatAssetVal = (val: number, isUnitPrice: boolean = false) => {
    if (val === undefined || val === null || isNaN(val)) return `${assetCurrencySymbol}0.00`;
    
    const localeMap: Record<Currency, string> = {
      BRL: 'pt-BR',
      USD: 'en-US',
      EUR: 'pt-PT',
      CLP: 'es-CL',
    };

    const minDecimals = 2;
    const maxDecimals = investment.asset_type === 'CRYPTO' && isUnitPrice ? 4 : 2;

    return new Intl.NumberFormat(localeMap[assetCurrencyCode] || 'pt-BR', {
      style: 'currency',
      currency: assetCurrencyCode,
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: maxDecimals,
    }).format(val);
  };

  const maxQty = investment.quantity || 0;
  const numQty = parseFloat(quantity) || 0;
  const numPrice = parseFloat(unitPrice) || 0;
  const avgPrice = investment.average_price || investment.current_price || 0;

  // Simulações em tempo real
  const grossSale = numQty * numPrice;
  const costBasis = numQty * avgPrice;
  const realizedPnl = grossSale - costBasis;
  const pnlPercent = costBasis > 0 ? (realizedPnl / costBasis) * 100 : 0;
  const remainingQty = Math.max(0, maxQty - numQty);

  const handleSetPercent = (pct: number) => {
    const calculated = (maxQty * pct).toFixed(8);
    // Remove trailing zeros
    setQuantity(String(parseFloat(calculated)));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numQty <= 0) {
      notify(isCashOrStable ? 'Informe uma quantidade válida para resgate.' : 'Informe uma quantidade válida para venda.', 'error');
      return;
    }
    if (numQty > maxQty) {
      notify(
        isCashOrStable
          ? `Quantidade a resgatar não pode ser maior que o saldo em carteira (${maxQty}).`
          : `Quantidade a vender não pode ser maior que o saldo em carteira (${maxQty}).`,
        'error'
      );
      return;
    }
    if (numPrice <= 0) {
      notify(isCashOrStable ? 'Informe o preço unitário de resgate.' : 'Informe o preço unitário de venda.', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await api.sellInvestment(investment.id, {
        quantity: numQty,
        unit_price: numPrice,
        date: saleDate,
        notes: notes || undefined,
      });

      const pnlFormatted = formatAssetVal(Math.abs(res.realized_pnl));
      const pnlMsg = res.realized_pnl >= 0 ? `Lucro realizado de +${pnlFormatted}` : `Prejuízo registrado de -${pnlFormatted}`;
      const successMsg = isCashOrStable
        ? `Resgate de ${formatAssetVal(numQty)} realizado com sucesso!`
        : `Venda realizada com sucesso! ${pnlMsg}.`;
      notify(successMsg, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      notify(err.message || (isCashOrStable ? 'Erro ao realizar resgate do saldo.' : 'Erro ao realizar venda do ativo.'), 'error');
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 text-red-400 border border-red-500/30">
              <ArrowUpRight className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-primary flex items-center gap-2">
                {isCashOrStable ? 'Resgatar Saldo' : 'Vender Ativo'}
                <span className="text-xs px-2 py-0.5 rounded-md bg-bg-primary text-text-secondary border border-border font-mono">
                  {investment.code_ticker}
                </span>
              </h2>
              <p className="text-xs text-text-secondary truncate max-w-xs">{investment.name}</p>
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
          {/* Card Resumo do Ativo */}
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-border/80 bg-bg-primary/80 p-3 text-xs">
            <div>
              <span className="text-text-secondary">Posição Atual em Carteira:</span>
              <p className="font-mono font-bold text-text-primary mt-0.5">
                {maxQty.toLocaleString('pt-BR', { maximumFractionDigits: 8 })} {investment.code_ticker}
              </p>
            </div>
            <div>
              <span className="text-text-secondary">Preço Médio de Compra:</span>
              <p className="font-mono font-bold text-text-primary mt-0.5">
                {formatAssetVal(avgPrice)}
              </p>
            </div>
          </div>

          {/* Quantidade a vender */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-text-secondary">
                {isCashOrStable ? 'Quantidade a Resgatar' : 'Quantidade a Vender'}
              </label>
              <span className="text-[11px] text-text-secondary font-mono">
                Disponível: {maxQty.toLocaleString('pt-BR', { maximumFractionDigits: 8 })}
              </span>
            </div>
            <div className="relative">
              <input
                type="number"
                step="any"
                min="0.00000001"
                max={maxQty}
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Ex: 50 ou 0.05"
                className="w-full rounded-xl border border-border bg-bg-primary px-3.5 py-2 text-sm font-mono text-text-primary placeholder-text-secondary focus:border-red-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Botões de porcentagem rápida */}
            <div className="flex items-center gap-1.5 pt-1">
              {[
                { label: '25%', value: 0.25 },
                { label: '50%', value: 0.5 },
                { label: '75%', value: 0.75 },
                { label: '100% (Tudo)', value: 1.0 },
              ].map((btn) => (
                <button
                  type="button"
                  key={btn.label}
                  onClick={() => handleSetPercent(btn.value)}
                  className="flex-1 rounded-lg border border-border bg-bg-elevated/60 py-1 text-[11px] font-semibold text-text-secondary hover:border-red-500/50 hover:bg-red-500/10 hover:text-red-400 transition-all"
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Preço Unitário de Venda */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">
              Preço Unitário de Venda ({assetCurrencyCode})
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text-secondary font-mono">
                {assetCurrencySymbol}
              </span>
              <input
                type="number"
                step="any"
                min="0"
                required
                disabled={isCashOrStable}
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-border bg-bg-primary pl-9 pr-3.5 py-2 text-sm font-mono text-text-primary placeholder-text-secondary focus:border-red-500 focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              />
            </div>
            {isCashOrStable && (
              <p className="text-[10px] text-text-secondary mt-1">
                Saldos de caixa/moeda possuem valor unitário fixo de 1:1.
              </p>
            )}
          </div>

          {/* Data da Venda */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              Data da Venda
            </label>
            <input
              type="date"
              required
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              className="w-full rounded-xl border border-border bg-bg-primary px-3.5 py-2 text-sm font-mono text-text-primary focus:border-red-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Observações / Notas */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary">
              Observações (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isCashOrStable ? 'Ex: Resgate para conta corrente...' : 'Ex: Realização de lucro parcial...'}
              className="w-full rounded-xl border border-border bg-bg-primary px-3.5 py-2 text-xs text-text-primary placeholder-text-secondary focus:border-red-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Card de Simulação e Lucro / Prejuízo Realizado */}
          {numQty > 0 && numPrice > 0 && (
            <div className={`rounded-xl border p-4 space-y-2.5 transition-all ${
              isCashOrStable
                ? 'bg-bg-primary/50 border-border/80'
                : realizedPnl >= 0
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-red-500/10 border-red-500/30'
            }`}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">{isCashOrStable ? 'Total a Resgatar:' : 'Total Bruto da Venda:'}</span>
                <span className="font-mono font-bold text-text-primary">{formatAssetVal(grossSale)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">Custo Original da Posição:</span>
                <span className="font-mono text-text-secondary">{formatAssetVal(costBasis)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">Posição Restante:</span>
                <span className="font-mono text-text-primary">
                  {remainingQty.toLocaleString('pt-BR', { maximumFractionDigits: 8 })} {investment.code_ticker}
                </span>
              </div>

              {!isCashOrStable && (
                <div className="pt-2 border-t border-border/40 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    {realizedPnl >= 0 ? (
                      <>
                        <TrendingUp className="h-4 w-4 text-emerald-400" />
                        <span className="text-emerald-400">Lucro Realizado:</span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="h-4 w-4 text-red-400" />
                        <span className="text-red-400">Prejuízo Realizado:</span>
                      </>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`font-mono text-sm font-bold ${
                      realizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                    }`}>
                      {realizedPnl >= 0 ? '+' : ''}{formatAssetVal(realizedPnl)}
                    </span>
                    <span className={`ml-1.5 text-xs font-mono font-semibold ${
                      realizedPnl >= 0 ? 'text-emerald-400/80' : 'text-red-400/80'
                    }`}>
                      ({realizedPnl >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
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
              disabled={loading || numQty <= 0 || numPrice <= 0 || numQty > maxQty}
              className="gap-2 bg-red-600 hover:bg-red-700 text-white font-semibold shadow-lg shadow-red-900/30"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isCashOrStable ? 'Processando Resgate...' : 'Processando Venda...'}
                </>
              ) : (
                <>
                  <ArrowUpRight className="h-4 w-4" />
                  {isCashOrStable ? 'Confirmar Resgate' : 'Confirmar Venda'}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
