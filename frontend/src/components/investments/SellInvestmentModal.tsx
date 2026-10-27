import { useEffect, useState, useMemo } from 'react';
import { X, Loader2, ArrowUpRight, TrendingUp, TrendingDown, Calendar, Wallet, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/services/api';
import type { Investment } from '@/types/finance';
import type { Currency } from '@/contexts/CurrencyContext';

interface Props {
  open: boolean;
  investment?: Investment | null;
  availableInvestments?: Investment[];
  onClose: () => void;
  onSuccess: () => void;
}

export function SellInvestmentModal({
  open,
  investment,
  availableInvestments = [],
  onClose,
  onSuccess,
}: Props) {
  const { notify } = useToast();

  const [selectedId, setSelectedId] = useState<string>('');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [totalGrossInput, setTotalGrossInput] = useState('');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // Lista de ativos elegíveis para venda (quantidade > 0)
  const eligibleInvestments = useMemo(() => {
    const list = availableInvestments.filter(
      (i) => (i.quantity || 0) > 0 && i.sync_source !== 'GORILA_CLOSED',
    );
    if (investment && !list.some((i) => i.id === investment.id)) {
      list.unshift(investment);
    }
    return list;
  }, [availableInvestments, investment]);

  // Ativo atualmente selecionado para a venda
  const activeInvestment = useMemo<Investment | null>(() => {
    if (investment) return investment;
    if (selectedId) {
      return eligibleInvestments.find((i) => i.id === selectedId) || null;
    }
    return eligibleInvestments[0] || null;
  }, [investment, selectedId, eligibleInvestments]);

  const isCashOrStable = activeInvestment
    ? (activeInvestment.code_ticker?.toUpperCase().includes('WISE_') ||
       activeInvestment.name?.toUpperCase().includes('WISE') ||
       activeInvestment.name?.toUpperCase().includes('CAIXINHA') ||
       activeInvestment.name?.toUpperCase().includes('SALDO') ||
       ['EUR', 'USD', 'USDT', 'USDC', 'BRL'].includes(activeInvestment.code_ticker?.toUpperCase()))
    : false;

  useEffect(() => {
    if (open) {
      const invToUse = investment || eligibleInvestments.find((i) => i.id === selectedId) || eligibleInvestments[0];
      if (invToUse) {
        setSelectedId(invToUse.id);
        setQuantity(String(invToUse.quantity));
        const initialPrice = isCashOrStable ? 1 : (invToUse.current_price || invToUse.average_price || 0);
        setUnitPrice(String(initialPrice));
        const total = (invToUse.quantity || 0) * initialPrice;
        setTotalGrossInput(total > 0 ? total.toFixed(2) : '');
      } else {
        setQuantity('');
        setUnitPrice('');
        setTotalGrossInput('');
      }
      setSaleDate(new Date().toISOString().split('T')[0]);
      setNotes('');
    }
  }, [open, investment]);

  const handleSelectAsset = (assetId: string) => {
    setSelectedId(assetId);
    const chosen = eligibleInvestments.find((i) => i.id === assetId);
    if (chosen) {
      const isStable =
        chosen.code_ticker?.toUpperCase().includes('WISE_') ||
        chosen.name?.toUpperCase().includes('WISE') ||
        chosen.name?.toUpperCase().includes('CAIXINHA') ||
        chosen.name?.toUpperCase().includes('SALDO') ||
        ['EUR', 'USD', 'USDT', 'USDC', 'BRL'].includes(chosen.code_ticker?.toUpperCase());
      setQuantity(String(chosen.quantity));
      const price = isStable ? 1 : (chosen.current_price || chosen.average_price || 0);
      setUnitPrice(String(price));
      const total = (chosen.quantity || 0) * price;
      setTotalGrossInput(total > 0 ? total.toFixed(2) : '');
    }
  };

  if (!open) return null;

  // Determinar a moeda do ativo
  const getAssetCurrency = () => {
    if (!activeInvestment) return { code: 'BRL' as Currency, symbol: 'R$' };
    const assetType = activeInvestment.asset_type;
    const inst = (activeInvestment.institution || '').toUpperCase();
    const name = (activeInvestment.name || '').toUpperCase();
    const ticker = (activeInvestment.code_ticker || '').toUpperCase();

    const isCrypto =
      assetType === 'CRYPTO' ||
      inst.includes('BINANCE') ||
      activeInvestment.currency === 'USD' ||
      activeInvestment.currency === 'USDT' ||
      name.includes('WISE_USD') ||
      ['BTC', 'ETH', 'SOL', 'ONDO', 'SXT', 'LINK', 'RENDER', 'ROSE', 'VIRTUAL', 'XRP'].includes(ticker);

    if (isCrypto) {
      return { code: 'USD' as Currency, symbol: '$' };
    } else if (activeInvestment.currency === 'EUR' || name.includes('WISE_EUR')) {
      return { code: 'EUR' as Currency, symbol: '€' };
    } else if (activeInvestment.currency === 'CLP') {
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
    const maxDecimals = activeInvestment?.asset_type === 'CRYPTO' && isUnitPrice ? 4 : 2;

    return new Intl.NumberFormat(localeMap[assetCurrencyCode] || 'pt-BR', {
      style: 'currency',
      currency: assetCurrencyCode,
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: maxDecimals,
    }).format(val);
  };

  const maxQty = activeInvestment?.quantity || 0;
  const numQty = parseFloat(quantity) || 0;
  const numPrice = parseFloat(unitPrice) || 0;
  const avgPrice = activeInvestment?.average_price || activeInvestment?.current_price || 0;

  // Simulações em tempo real
  const grossSale = numQty * numPrice;
  const costBasis = numQty * avgPrice;
  const realizedPnl = grossSale - costBasis;
  const pnlPercent = costBasis > 0 ? (realizedPnl / costBasis) * 100 : 0;
  const remainingQty = Math.max(0, maxQty - numQty);

  const handleSetPercent = (pct: number) => {
    const calculated = (maxQty * pct).toFixed(8);
    const cleaned = parseFloat(calculated);
    setQuantity(String(cleaned));
    if (numPrice > 0) {
      setTotalGrossInput((cleaned * numPrice).toFixed(2));
    }
  };

  const handleUnitPriceChange = (val: string) => {
    setUnitPrice(val);
    const parsed = parseFloat(val) || 0;
    if (numQty > 0 && parsed > 0) {
      setTotalGrossInput((numQty * parsed).toFixed(2));
    }
  };

  const handleTotalGrossChange = (val: string) => {
    setTotalGrossInput(val);
    const parsedTotal = parseFloat(val) || 0;
    if (numQty > 0 && parsedTotal > 0) {
      setUnitPrice((parsedTotal / numQty).toFixed(4));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeInvestment) {
      notify('Selecione um ativo para realizar a venda.', 'error');
      return;
    }
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
      const res = await api.sellInvestment(activeInvestment.id, {
        quantity: numQty,
        unit_price: numPrice,
        date: saleDate,
        notes: notes || undefined,
      });

      const pnlFormatted = formatAssetVal(Math.abs(res.realized_pnl));
      const pnlMsg = res.realized_pnl >= 0 ? `Lucro realizado de +${pnlFormatted}` : `Prejuízo registrado de -${pnlFormatted}`;
      const successMsg = isCashOrStable
        ? `Resgate de ${formatAssetVal(numQty)} realizado com sucesso!`
        : `Venda de ${activeInvestment.code_ticker} registrada com sucesso! ${pnlMsg}.`;

      notify(successMsg, 'success');
      window.dispatchEvent(new CustomEvent('investments-updated'));
      onSuccess();
      onClose();
    } catch (err: any) {
      notify(err.message || (isCashOrStable ? 'Erro ao realizar resgate do saldo.' : 'Erro ao realizar venda do ativo.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-700 bg-[#0F172A] text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400 border border-rose-500/30">
              <ArrowUpRight className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                {isCashOrStable ? 'Resgatar Saldo' : 'Registrar Venda de Ativo'}
                {activeInvestment && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-rose-400 border border-slate-700 font-mono font-bold">
                    {activeInvestment.code_ticker}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400 truncate max-w-xs">
                {activeInvestment?.name || 'Selecione o ativo que foi vendido'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {/* Seletor de Ativo caso aberto sem ativo pré-definido ou se o usuário quiser trocar */}
          {eligibleInvestments.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Ativo em Carteira</span>
                <span className="text-[11px] text-slate-500">
                  {eligibleInvestments.length} ativo(s) com saldo
                </span>
              </label>
              <select
                value={activeInvestment?.id || ''}
                onChange={(e) => handleSelectAsset(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-white focus:border-rose-500 focus:outline-none transition-colors"
              >
                {eligibleInvestments.map((i) => (
                  <option key={i.id} value={i.id} className="bg-slate-900 text-white">
                    {i.code_ticker} - {i.name} ({i.institution || 'Carteira'}) — Saldo: {i.quantity.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Card Resumo do Ativo Selecionado */}
          {activeInvestment && (
            <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs">
              <div>
                <span className="text-slate-400">Instituição:</span>
                <p className="font-semibold text-white mt-0.5 truncate">
                  {activeInvestment.institution || 'Carteira'}
                </p>
              </div>
              <div>
                <span className="text-slate-400">Posição Atual:</span>
                <p className="font-mono font-bold text-white mt-0.5">
                  {maxQty.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}
                </p>
              </div>
              <div>
                <span className="text-slate-400">Preço Médio:</span>
                <p className="font-mono font-bold text-white mt-0.5">
                  {formatAssetVal(avgPrice)}
                </p>
              </div>
            </div>
          )}

          {/* Quantidade a vender */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-300">
                {isCashOrStable ? 'Quantidade a Resgatar' : 'Quantidade Vendida'}
              </label>
              <span className="text-[11px] text-slate-400 font-mono">
                Disponível: {maxQty.toLocaleString('pt-BR', { maximumFractionDigits: 6 })}
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
                onChange={(e) => {
                  setQuantity(e.target.value);
                  const parsed = parseFloat(e.target.value) || 0;
                  if (numPrice > 0 && parsed > 0) {
                    setTotalGrossInput((parsed * numPrice).toFixed(2));
                  }
                }}
                placeholder="Ex: 50 ou 0.05"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none transition-colors"
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
                  className="flex-1 rounded-lg border border-slate-700 bg-slate-800/80 py-1 text-[11px] font-semibold text-slate-300 hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-400 transition-all cursor-pointer"
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Linha dupla: Preço Unitário e Valor Total da Venda */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Preço Unitário ({assetCurrencyCode})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                  {assetCurrencySymbol}
                </span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  disabled={isCashOrStable}
                  value={unitPrice}
                  onChange={(e) => handleUnitPriceChange(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 pl-9 pr-3.5 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                Valor Total da Venda ({assetCurrencyCode})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                  {assetCurrencySymbol}
                </span>
                <input
                  type="number"
                  step="any"
                  min="0"
                  required
                  value={totalGrossInput}
                  onChange={(e) => handleTotalGrossChange(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900 pl-9 pr-3.5 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Data da Venda */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-rose-400" />
              <span>Data da Venda (quando ocorreu a operação)</span>
            </label>
            <input
              type="date"
              required
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-sm font-mono text-white focus:border-rose-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Observações / Notas */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Observações (Opcional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={isCashOrStable ? 'Ex: Resgate para conta corrente...' : 'Ex: Venda parcial realizada na XP...'}
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-rose-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Card de Simulação e Lucro / Prejuízo Realizado */}
          {numQty > 0 && numPrice > 0 && (
            <div className={`rounded-xl border p-4 space-y-2.5 transition-all ${
              isCashOrStable
                ? 'bg-slate-900/70 border-slate-800'
                : realizedPnl >= 0
                ? 'bg-emerald-500/10 border-emerald-500/30'
                : 'bg-rose-500/10 border-rose-500/30'
            }`}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">{isCashOrStable ? 'Total a Resgatar:' : 'Total Bruto Recebido:'}</span>
                <span className="font-mono font-bold text-white">{formatAssetVal(grossSale)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Custo Médio de Compra da Posição:</span>
                <span className="font-mono text-slate-300">{formatAssetVal(costBasis)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Quantidade Restante em Carteira:</span>
                <span className="font-mono text-white font-semibold">
                  {remainingQty.toLocaleString('pt-BR', { maximumFractionDigits: 6 })} {activeInvestment?.code_ticker}
                </span>
              </div>

              {!isCashOrStable && (
                <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold">
                    {realizedPnl >= 0 ? (
                      <>
                        <TrendingUp className="h-4 w-4 text-emerald-400" />
                        <span className="text-emerald-400">Lucro Realizado:</span>
                      </>
                    ) : (
                      <>
                        <TrendingDown className="h-4 w-4 text-rose-400" />
                        <span className="text-rose-400">Prejuízo Realizado:</span>
                      </>
                    )}
                  </div>
                  <div className="text-right">
                    <span className={`font-mono text-sm font-bold ${
                      realizedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {realizedPnl >= 0 ? '+' : ''}{formatAssetVal(realizedPnl)}
                    </span>
                    <span className={`ml-1.5 text-xs font-mono font-semibold ${
                      realizedPnl >= 0 ? 'text-emerald-400/80' : 'text-rose-400/80'
                    }`}>
                      ({realizedPnl >= 0 ? '+' : ''}{pnlPercent.toFixed(2)}%)
                    </span>
                  </div>
                </div>
              )}

              {/* Informação sobre crédito em conta */}
              {activeInvestment?.institution && (
                <div className="text-[11px] text-slate-400 pt-1 flex items-center gap-1">
                  <Wallet className="h-3 w-3 text-slate-400" />
                  <span>
                    O valor de {formatAssetVal(grossSale)} será creditado em <strong>Saldo {activeInvestment.institution}</strong>.
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={loading}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={loading || numQty <= 0 || numPrice <= 0 || numQty > maxQty}
              className="gap-2 bg-rose-600 hover:bg-rose-700 text-white font-bold shadow-lg shadow-rose-950/40 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Registrando Venda...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Confirmar Venda e Atualizar Histórico</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
