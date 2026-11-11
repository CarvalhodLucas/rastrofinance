import { useState, useMemo, useEffect } from 'react';
import {
  X,
  History,
  Edit2,
  Trash2,
  Plus,
  Loader2,
  SlidersHorizontal,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Save,
  Calculator,
  Sparkles,
} from 'lucide-react';
import { AssetLogo } from '@/components/investments/AssetLogo';
import { getBankLogo } from '@/utils/assetLogos';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/services/api';
import type { Investment, InvestmentTrade, TradeType } from '@/types/finance';

interface Props {
  open: boolean;
  investment: Investment | null;
  trades: InvestmentTrade[];
  onClose: () => void;
  onEditTrade?: (trade: InvestmentTrade) => void;
  onAddBuy: (investment: Investment) => void;
  onEditPositionDirect: (investment: Investment) => void;
  onRefresh: () => Promise<void> | void;
}

const TRADE_TYPE_BADGE: Record<string, { label: string; color: string }> = {
  BUY: { label: 'Compra', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  SELL: { label: 'Venda', color: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
  SWAP: { label: 'Conversão', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  DEPOSIT: { label: 'Depósito', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  EARN_SUB: { label: 'Earn Bloqueio', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  EARN_REDEEM: { label: 'Earn Resgate', color: 'bg-teal-500/15 text-teal-400 border-teal-500/30' },
  EARN_INTEREST: { label: 'Rendimento', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  AIRDROP: { label: 'Bonificação', color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' },
};

const QUICK_INSTITUTIONS = ['Revolut X', 'Binance', 'Revolut', 'Wise', 'NuInvest', 'XP Investimentos', 'BTG Pactual', 'Inter', 'Itaú'];

export function AssetTradesModal({
  open,
  investment,
  trades = [],
  onClose,
  onAddBuy,
  onEditPositionDirect,
  onRefresh,
}: Props) {
  const { notify } = useToast();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [institutionFilter, setInstitutionFilter] = useState<string>('ALL');
  const [hideEarnMicro, setHideEarnMicro] = useState<boolean>(true);
  const [internalTrades, setInternalTrades] = useState<InvestmentTrade[]>([]);
  const [loadingInternalTrades, setLoadingInternalTrades] = useState(false);

  // Estado de edição embutida (inline) de um lançamento selecionado
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editType, setEditType] = useState<TradeType>('BUY');
  const [editInstitution, setEditInstitution] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editUnitPrice, setEditUnitPrice] = useState('');
  const [editTotalValue, setEditTotalValue] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [calcMode, setCalcMode] = useState<'AUTO' | 'PRICE' | 'TOTAL'>('TOTAL');

  // Busca lançamentos frescos do banco sempre que o modal abre
  useEffect(() => {
    if (open) {
      setLoadingInternalTrades(true);
      api
        .getTrades()
        .then((res) => {
          if (res?.trades && Array.isArray(res.trades)) {
            setInternalTrades(res.trades);
          }
        })
        .catch(() => {})
        .finally(() => setLoadingInternalTrades(false));
    }
  }, [open]);

  const ticker = (investment?.code_ticker || investment?.name || '').trim().toUpperCase();

  const isCrypto = useMemo(() => {
    if (!investment) return false;
    const instUpper = (investment.institution || '').toUpperCase();
    return (
      investment.asset_type === 'CRYPTO' ||
      instUpper.includes('BINANCE') ||
      instUpper.includes('REVOLUT X') ||
      ['BTC', 'ETH', 'SOL', 'ONDO', 'SXT', 'LINK', 'RENDER', 'ROSE', 'VIRTUAL', 'XRP', 'ADA', 'DOGE', 'PEPE', 'TAO', 'XLM', 'BNB', 'AVAX'].includes(ticker)
    );
  }, [investment, ticker]);

  useEffect(() => {
    if (!open) {
      setEditingTradeId(null);
      setInstitutionFilter('ALL');
    }
  }, [open]);

  // Combina lista de trades do prop e busca interna
  const allTradesList = useMemo(() => {
    if (internalTrades && internalTrades.length > 0) return internalTrades;
    return Array.isArray(trades) ? trades : [];
  }, [internalTrades, trades]);

  const assetTrades = useMemo(() => {
    if (!ticker) return [];
    return allTradesList
      .filter((t) => {
        if (!t) return false;
        const tTicker = (t.ticker || '').trim().toUpperCase();
        const toTicker = (t.to_ticker || '').trim().toUpperCase();
        return tTicker === ticker || toTicker === ticker;
      })
      .sort((a, b) => {
        const timeA = a?.date ? new Date(a.date).getTime() : 0;
        const timeB = b?.date ? new Date(b.date).getTime() : 0;
        return (isNaN(timeB) ? 0 : timeB) - (isNaN(timeA) ? 0 : timeA);
      });
  }, [allTradesList, ticker]);

  const institutions = useMemo(() => {
    const set = new Set<string>();
    for (const t of assetTrades) {
      if (t?.institution) set.add(t.institution.trim());
    }
    return Array.from(set);
  }, [assetTrades]);

  const filteredTrades = useMemo(() => {
    return assetTrades.filter((t) => {
      if (!t) return false;
      if (institutionFilter !== 'ALL' && (t.institution || '').trim() !== institutionFilter) {
        return false;
      }
      if (
        hideEarnMicro &&
        (t.trade_type === 'EARN_INTEREST' || t.trade_type === 'EARN_SUB' || t.trade_type === 'EARN_REDEEM')
      ) {
        return false;
      }
      return true;
    });
  }, [assetTrades, institutionFilter, hideEarnMicro]);

  const earnTradesCount = useMemo(
    () =>
      assetTrades.filter(
        (t) => t && (t.trade_type === 'EARN_INTEREST' || t.trade_type === 'EARN_SUB' || t.trade_type === 'EARN_REDEEM'),
      ).length,
    [assetTrades],
  );

  if (!open || !investment) return null;

  const curPrice = Number(investment.current_price ?? investment.average_price ?? 0);
  const avgPrice = Number(investment.average_price ?? curPrice);
  const safeQty = Number(investment.quantity ?? 0);
  const totalVal = safeQty > 0 ? safeQty * curPrice : Number(investment.total_value ?? 0);
  const currSymbol = isCrypto ? '$' : investment.currency === 'EUR' ? '€' : 'R$';

  const formatMoney = (val: number, isUnit = false) => {
    const num = Number(val) || 0;
    let curr = isCrypto ? 'USD' : (investment.currency || 'BRL').toUpperCase();
    if (!['USD', 'EUR', 'BRL', 'CLP'].includes(curr)) {
      curr = 'USD';
    }
    const locale = curr === 'USD' ? 'en-US' : curr === 'EUR' ? 'pt-PT' : 'pt-BR';
    try {
      return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: curr,
        minimumFractionDigits: 2,
        maximumFractionDigits: isUnit && num > 0 && num < 1 ? 6 : 2,
      }).format(num);
    } catch {
      return `${curr} ${num.toFixed(2)}`;
    }
  };

  const formatDate = (iso: any) => {
    if (!iso) return '-';
    const str = String(iso);
    const clean = str.substring(0, 10);
    const parts = clean.split('-');
    if (parts.length === 3 && parts[0] && parts[1] && parts[2]) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return clean;
  };

  const startEditingTrade = (t: InvestmentTrade) => {
    setEditingTradeId(t.id);
    setEditDate(t.date ? t.date.substring(0, 10) : new Date().toISOString().substring(0, 10));
    setEditType(t.trade_type || 'BUY');
    setEditInstitution(t.institution || '');
    setEditQuantity(String(t.quantity ?? ''));
    setEditUnitPrice(String(t.unit_price ? Number(t.unit_price.toFixed(6)) : ''));
    setEditTotalValue(String(t.total_value ? Number(t.total_value.toFixed(2)) : ''));
    setEditNotes(t.notes || '');
  };

  const handleEditQtyChange = (val: string) => {
    setEditQuantity(val);
    const q = parseFloat(val) || 0;
    const p = parseFloat(editUnitPrice) || 0;
    const tot = parseFloat(editTotalValue) || 0;

    if (q > 0) {
      if (calcMode === 'TOTAL' && tot > 0) {
        // Usuário fixou o Total que gastou: calcula o Preço Unitário = Total ÷ Quantidade
        const calcP = tot / q;
        const decimals = isCrypto ? (calcP < 1 ? 6 : 2) : 2;
        setEditUnitPrice(calcP.toFixed(decimals));
      } else if (p > 0) {
        // Calcula o Total = Quantidade × Preço
        setEditTotalValue((q * p).toFixed(2));
      } else if (tot > 0) {
        const calcP = tot / q;
        const decimals = isCrypto ? (calcP < 1 ? 6 : 2) : 2;
        setEditUnitPrice(calcP.toFixed(decimals));
      }
    }
  };

  const handleEditPriceChange = (val: string) => {
    setEditUnitPrice(val);
    setCalcMode('PRICE');
    const p = parseFloat(val) || 0;
    const tot = parseFloat(editTotalValue) || 0;
    const q = parseFloat(editQuantity) || 0;

    if (p > 0) {
      if (tot > 0 && q === 0) {
        // Se temos Total e não temos Quantidade: Quantidade = Total ÷ Preço
        const calcQty = tot / p;
        setEditQuantity(isCrypto ? calcQty.toFixed(8).replace(/\.?0+$/, '') : calcQty.toFixed(4).replace(/\.?0+$/, ''));
      } else if (q > 0) {
        // Se temos Quantidade: Total = Quantidade × Preço
        setEditTotalValue((q * p).toFixed(2));
      }
    }
  };

  const handleEditTotalChange = (val: string) => {
    setEditTotalValue(val);
    setCalcMode('TOTAL');
    const tot = parseFloat(val) || 0;
    const p = parseFloat(editUnitPrice) || 0;
    const q = parseFloat(editQuantity) || 0;

    if (tot > 0) {
      if (q > 0) {
        // Temos a Quantidade de BTC comprada e o usuário digitou quanto gastou: calcula o Preço Unitário = Total ÷ Quantidade!
        const calcP = tot / q;
        const decimals = isCrypto ? (calcP < 1 ? 6 : 2) : 2;
        setEditUnitPrice(calcP.toFixed(decimals));
      } else if (p > 0) {
        // Temos o Preço Unitário: Quantidade = Total ÷ Preço
        const calcQty = tot / p;
        setEditQuantity(isCrypto ? calcQty.toFixed(8).replace(/\.?0+$/, '') : calcQty.toFixed(4).replace(/\.?0+$/, ''));
      }
    }
  };

  const handleCalculatePriceFromTotalAndQty = () => {
    const tot = parseFloat(editTotalValue) || 0;
    const q = parseFloat(editQuantity) || 0;
    if (tot > 0 && q > 0) {
      const calcP = tot / q;
      const decimals = isCrypto ? (calcP < 1 ? 6 : 2) : 2;
      setEditUnitPrice(calcP.toFixed(decimals));
      setCalcMode('TOTAL');
    }
  };

  const handleCalculateQtyFromTotalAndPrice = () => {
    const tot = parseFloat(editTotalValue) || 0;
    const p = parseFloat(editUnitPrice) || 0;
    if (tot > 0 && p > 0) {
      const calc = tot / p;
      setEditQuantity(isCrypto ? calc.toFixed(8).replace(/\.?0+$/, '') : calc.toFixed(4).replace(/\.?0+$/, ''));
      setCalcMode('PRICE');
    }
  };

  const handleUseCurrentMarketPrice = () => {
    if (curPrice <= 0) return;
    const priceStr = String(Number(curPrice.toFixed(2)));
    setEditUnitPrice(priceStr);
    setCalcMode('PRICE');
    const tot = parseFloat(editTotalValue) || 0;
    const q = parseFloat(editQuantity) || 0;
    if (tot > 0) {
      const calcQty = tot / curPrice;
      setEditQuantity(isCrypto ? calcQty.toFixed(8).replace(/\.?0+$/, '') : calcQty.toFixed(4).replace(/\.?0+$/, ''));
    } else if (q > 0) {
      setEditTotalValue((q * curPrice).toFixed(2));
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTradeId) return;

    let numQty = parseFloat(editQuantity) || 0;
    let numPrice = parseFloat(editUnitPrice) || 0;
    let numTotal = parseFloat(editTotalValue) || 0;

    // Se tiver 2 valores preenchidos, autocompleta o terceiro com precisão matemática antes de salvar
    if (numTotal > 0 && numQty > 0) {
      numPrice = numTotal / numQty;
      setEditUnitPrice(numPrice.toFixed(isCrypto ? (numPrice < 1 ? 6 : 2) : 2));
    } else if (numTotal > 0 && numPrice > 0 && numQty <= 0) {
      numQty = numTotal / numPrice;
      setEditQuantity(numQty.toFixed(isCrypto ? 8 : 4));
    } else if (numQty > 0 && numPrice > 0 && numTotal <= 0) {
      numTotal = numQty * numPrice;
      setEditTotalValue(numTotal.toFixed(2));
    }

    if (numQty <= 0) {
      notify('Informe uma quantidade válida.', 'error');
      return;
    }
    if (numPrice <= 0) {
      notify('Informe o preço unitário ou o valor total para calcular o preço.', 'error');
      return;
    }

    setSavingEdit(true);
    try {
      await api.updateTrade(editingTradeId, {
        trade_type: editType,
        quantity: numQty,
        unit_price: numPrice,
        total_value: numTotal,
        institution: editInstitution.trim() || 'Manual',
        date: editDate ? new Date(editDate + 'T12:00:00Z').toISOString() : new Date().toISOString(),
        notes: editNotes.trim(),
      });

      notify(`Lançamento de ${investment.code_ticker} corrigido! Saldo e Preço Médio atualizados.`, 'success');
      setEditingTradeId(null);
      window.dispatchEvent(new Event('investments-updated'));
      api.getTrades().then((res) => {
        if (res?.trades && Array.isArray(res.trades)) setInternalTrades(res.trades);
      }).catch(() => {});
      await onRefresh();
    } catch (err: any) {
      notify(err?.message || 'Erro ao salvar alterações.', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (trade: InvestmentTrade, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (
      !confirm(
        `Deseja excluir este lançamento de ${trade.quantity} ${trade.ticker} (${trade.institution || 'Manual'})?\n\nO saldo e o preço médio do ativo serão recalculados automaticamente.`,
      )
    ) {
      return;
    }

    setDeletingId(trade.id);
    try {
      await api.deleteTrade(trade.id);
      if (editingTradeId === trade.id) setEditingTradeId(null);
      notify(`Lançamento excluído e saldo de ${trade.ticker} recalculado!`, 'success');
      window.dispatchEvent(new Event('investments-updated'));
      api.getTrades().then((res) => {
        if (res?.trades && Array.isArray(res.trades)) setInternalTrades(res.trades);
      }).catch(() => {});
      await onRefresh();
    } catch (err: any) {
      notify(err?.message || 'Erro ao excluir lançamento.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-5xl rounded-2xl border border-slate-700 bg-[#111827] text-white shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Cabeçalho do Ativo — alinhado em linha única */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 px-5 py-4 bg-[#161f30] shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <AssetLogo
              ticker={investment.code_ticker}
              name={investment.name}
              institution={investment.institution}
              assetType={investment.asset_type}
              sizeClassName="h-10 w-10 shrink-0"
            />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-white whitespace-nowrap">
                  Lançamentos de {investment.code_ticker}
                </h2>
                <span className="text-xs px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold whitespace-nowrap inline-flex items-center gap-1.5">
                  {loadingInternalTrades && <Loader2 className="h-3 w-3 animate-spin text-amber-400" />}
                  <span>{investment.institution || 'Carteira'}</span>
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                Clique em qualquer lançamento abaixo para editar ou corrigir valores.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onEditPositionDirect(investment)}
              className="h-9 px-3 gap-1.5 text-xs border-slate-700 hover:border-amber-500/40 text-slate-200 hover:text-white whitespace-nowrap shrink-0"
              title="Ajustar manualmente a quantidade total ou preço médio consolidado"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <span>Ajustar Saldo / PM</span>
            </Button>

            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={() => onAddBuy(investment)}
              className="h-9 px-3.5 gap-1.5 text-xs font-bold whitespace-nowrap shrink-0 bg-amber-500 hover:bg-amber-400 text-slate-950"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span>Novo Lançamento</span>
            </Button>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer shrink-0"
              title="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Resumo Atual da Posição */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 py-3 bg-[#0d131f] border-b border-slate-800 text-xs shrink-0">
          <div className="rounded-xl border border-slate-800 bg-[#161f30] px-3.5 py-2.5">
            <span className="text-[11px] text-slate-400 block">Quantidade Atual</span>
            <span className="font-mono font-bold text-sm sm:text-base text-white tabular-nums">
              {safeQty.toLocaleString('pt-BR', {
                minimumFractionDigits: 0,
                maximumFractionDigits: isCrypto ? 8 : 4,
              })}{' '}
              {investment.code_ticker}
            </span>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#161f30] px-3.5 py-2.5">
            <span className="text-[11px] text-slate-400 block">Preço Médio</span>
            <span className="font-mono font-bold text-sm sm:text-base text-amber-400 tabular-nums">
              {formatMoney(avgPrice, true)}
            </span>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#161f30] px-3.5 py-2.5">
            <span className="text-[11px] text-slate-400 block">Preço Atual</span>
            <span className="font-mono font-bold text-sm sm:text-base text-white tabular-nums">
              {formatMoney(curPrice, true)}
            </span>
          </div>
          <div className="rounded-xl border border-slate-800 bg-[#161f30] px-3.5 py-2.5">
            <span className="text-[11px] text-slate-400 block">Saldo Atual</span>
            <span className="font-mono font-bold text-sm sm:text-base text-emerald-400 tabular-nums">
              {formatMoney(totalVal, false)}
            </span>
          </div>
        </div>

        {/* Painel de Edição Rápida Embutido (aparece ao clicar em qualquer lançamento) */}
        {editingTradeId && (
          <form
            onSubmit={handleSaveEdit}
            className="border-b border-accent-gold/40 bg-accent-gold/10 px-5 py-4 space-y-3 shrink-0 animate-in fade-in duration-150"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-gold text-black">
                  <Edit2 className="h-3.5 w-3.5" />
                </span>
                <span className="text-xs sm:text-sm font-bold text-text-primary">
                  Editando Lançamento de {investment.code_ticker}
                </span>
                <span className="text-[11px] text-text-secondary hidden sm:inline">
                  — Altere o Preço Unitário, Valor Total ou Quantidade abaixo e clique em Salvar
                </span>
              </div>

              <div className="flex items-center gap-2">
                {curPrice > 0 && (
                  <button
                    type="button"
                    onClick={handleUseCurrentMarketPrice}
                    className="inline-flex items-center gap-1 rounded-lg bg-bg-card hover:bg-bg-elevated border border-accent-gold/40 px-2.5 py-1 text-[11px] font-semibold text-accent-gold transition-colors cursor-pointer"
                    title="Preencher o Preço Unitário com a cotação atual do ativo e recalcular a quantidade pelo Valor Total"
                  >
                    <Sparkles className="h-3 w-3" />
                    <span>Usar preço atual ({formatMoney(curPrice, true)})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setEditingTradeId(null)}
                  className="text-xs text-text-secondary hover:text-text-primary px-2 py-1 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* 1. Data */}
              <div>
                <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                  Data
                </label>
                <input
                  type="date"
                  required
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full h-9 rounded-lg border border-border bg-bg-card px-2.5 text-xs font-mono text-text-primary focus:border-accent-gold focus:outline-none"
                />
              </div>

              {/* 2. Corretora */}
              <div>
                <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                  Corretora / Banco
                </label>
                <select
                  value={QUICK_INSTITUTIONS.includes(editInstitution) ? editInstitution : 'CUSTOM'}
                  onChange={(e) => {
                    if (e.target.value !== 'CUSTOM') setEditInstitution(e.target.value);
                  }}
                  style={{ colorScheme: 'dark' }}
                  className="w-full h-9 rounded-lg border border-border bg-bg-card px-2.5 text-xs font-semibold text-text-primary focus:border-accent-gold focus:outline-none cursor-pointer"
                >
                  {QUICK_INSTITUTIONS.map((inst) => (
                    <option key={inst} value={inst} className="bg-[#111827] text-white">
                      {inst}
                    </option>
                  ))}
                  {!QUICK_INSTITUTIONS.includes(editInstitution) && (
                    <option value="CUSTOM" className="bg-[#111827] text-white">
                      {editInstitution || 'Outra'}
                    </option>
                  )}
                </select>
              </div>

              {/* 3. Preço Unitário do Ativo na Compra */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-text-secondary">
                    Preço Unit. ({currSymbol})
                  </label>
                  <button
                    type="button"
                    onClick={handleCalculatePriceFromTotalAndQty}
                    className="text-[10px] font-semibold text-accent-gold hover:underline flex items-center gap-0.5 cursor-pointer"
                    title="Calcular Preço Unitário = Valor Total ÷ Quantidade"
                  >
                    <Calculator className="h-2.5 w-2.5" />
                    <span>Total÷Quant.</span>
                  </button>
                </div>
                <input
                  type="number"
                  step="any"
                  value={editUnitPrice}
                  onChange={(e) => handleEditPriceChange(e.target.value)}
                  placeholder="Ex: 73537.69"
                  className="w-full h-9 rounded-lg border border-border bg-bg-card px-2.5 text-xs font-mono font-bold text-text-primary focus:border-accent-gold focus:outline-none"
                />
              </div>

              {/* 4. Valor Total Investido */}
              <div>
                <label className="block text-[11px] font-semibold text-text-secondary mb-1">
                  Valor Total Gasto ({currSymbol})
                </label>
                <input
                  type="number"
                  step="any"
                  value={editTotalValue}
                  onChange={(e) => handleEditTotalChange(e.target.value)}
                  placeholder="Ex: 165.00"
                  className="w-full h-9 rounded-lg border border-border bg-bg-card px-2.5 text-xs font-mono font-bold text-emerald-400 focus:border-accent-gold focus:outline-none"
                />
              </div>

              {/* 5. Quantidade Comprada */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-accent-gold">
                    Quantidade ({investment.code_ticker})
                  </label>
                  <button
                    type="button"
                    onClick={handleCalculateQtyFromTotalAndPrice}
                    className="text-[10px] font-semibold text-accent-gold hover:underline flex items-center gap-0.5 cursor-pointer"
                    title="Recalcular Quantidade = Valor Total ÷ Preço Unitário"
                  >
                    <Calculator className="h-2.5 w-2.5" />
                    <span>Total÷Preço</span>
                  </button>
                </div>
                <input
                  type="number"
                  step="any"
                  value={editQuantity}
                  onChange={(e) => handleEditQtyChange(e.target.value)}
                  className="w-full h-9 rounded-lg border border-accent-gold/60 bg-bg-card px-2.5 text-xs font-mono font-bold text-text-primary focus:border-accent-gold focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <p className="text-[11px] text-text-secondary">
                💡 Dica: Digite o <strong>Preço Unit. do {investment.code_ticker}</strong> (ex: {formatMoney(curPrice, true)}) e o <strong>Valor Total Gasto</strong> (ex: $165.00) que a quantidade fracionada é calculada na hora!
              </p>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={savingEdit}
                  className="h-8 px-4 gap-1.5 text-xs font-bold whitespace-nowrap"
                >
                  {savingEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  <span>Salvar Correção</span>
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* Barra de Filtros por Corretora / Earn */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 border-b border-border/60 bg-bg-card text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-text-secondary font-medium mr-1">Corretora:</span>
            <button
              type="button"
              onClick={() => setInstitutionFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                institutionFilter === 'ALL'
                  ? 'border-accent-gold bg-accent-gold/20 text-accent-gold'
                  : 'border-border bg-bg-elevated/50 text-text-secondary hover:text-text-primary'
              }`}
            >
              Todas ({assetTrades.length - (hideEarnMicro ? earnTradesCount : 0)})
            </button>
            {institutions.map((inst) => {
              const logo = getBankLogo(inst);
              const isSel = institutionFilter === inst;
              return (
                <button
                  key={inst}
                  type="button"
                  onClick={() => setInstitutionFilter(inst)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                    isSel
                      ? 'border-accent-gold bg-accent-gold/20 text-accent-gold'
                      : 'border-border bg-bg-elevated/50 text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {logo && <img src={logo} alt={inst} className="h-3.5 w-3.5 rounded-full object-contain bg-white/90 p-0.2" />}
                  <span>{inst}</span>
                </button>
              );
            })}
          </div>

          {earnTradesCount > 0 && (
            <label className="inline-flex items-center gap-1.5 text-[11px] text-text-secondary cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!hideEarnMicro}
                onChange={(e) => setHideEarnMicro(!e.target.checked)}
                className="rounded border-border text-accent-gold focus:ring-accent-gold cursor-pointer"
              />
              <span>Mostrar movimentações de Earn ({earnTradesCount})</span>
            </label>
          )}
        </div>

        {/* Tabela de Lançamentos — 100% alinhada e sem cortar a coluna de Ações */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {filteredTrades.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <History className="h-10 w-10 text-text-muted mb-2 opacity-50" />
              <p className="text-sm font-semibold text-text-primary">
                Nenhum lançamento encontrado para {investment.code_ticker}
              </p>
              <p className="text-xs text-text-secondary mt-1 max-w-md">
                Você pode registrar um novo lançamento clicando em "+ Novo Lançamento" ou editar diretamente o Saldo e Preço Médio em "Ajustar Saldo / PM".
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-bg-elevated/60 border-b border-border text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                  <tr>
                    <th className="px-3 py-2.5 whitespace-nowrap w-[105px]">Data</th>
                    <th className="px-3 py-2.5 whitespace-nowrap w-[100px]">Operação</th>
                    <th className="px-3 py-2.5 whitespace-nowrap">Corretora / Banco</th>
                    <th className="px-3 py-2.5 text-right whitespace-nowrap w-[150px]">Quantidade</th>
                    <th className="px-3 py-2.5 text-right whitespace-nowrap w-[125px]">Preço Unit.</th>
                    <th className="px-3 py-2.5 text-right whitespace-nowrap w-[115px]">Valor Total</th>
                    <th className="px-3 py-2.5 text-right whitespace-nowrap w-[135px]">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredTrades.map((t) => {
                    const badge = TRADE_TYPE_BADGE[t.trade_type] || {
                      label: t.trade_type,
                      color: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
                    };
                    const bankLogo = getBankLogo(t.institution);
                    const isManual = t.source === 'MANUAL';
                    const isEditingThis = editingTradeId === t.id;

                    return (
                      <tr
                        key={t.id}
                        onClick={() => startEditingTrade(t)}
                        title="Clique para editar este lançamento"
                        className={`transition-colors cursor-pointer ${
                          isEditingThis
                            ? 'bg-accent-gold/15 ring-1 ring-inset ring-accent-gold/50'
                            : 'hover:bg-bg-elevated/50'
                        }`}
                      >
                        {/* 1. Data (alinhamento uniforme) */}
                        <td className="px-3 py-2.5 font-mono text-xs text-text-primary whitespace-nowrap tabular-nums">
                          {formatDate(t.date)}
                        </td>

                        {/* 2. Operação */}
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold ${badge.color}`}
                          >
                            {t.trade_type === 'BUY' ? (
                              <ArrowDownLeft className="h-3 w-3 shrink-0" />
                            ) : t.trade_type === 'SELL' ? (
                              <ArrowUpRight className="h-3 w-3 shrink-0" />
                            ) : (
                              <RefreshCw className="h-3 w-3 shrink-0" />
                            )}
                            <span>{badge.label}</span>
                          </span>
                        </td>

                        {/* 3. Corretora / Banco + Tag Manual */}
                        <td className="px-3 py-2.5 max-w-[210px]">
                          <div className="flex items-center gap-1.5 font-medium text-text-primary">
                            {bankLogo && (
                              <img
                                src={bankLogo}
                                alt={t.institution}
                                className="h-4 w-4 rounded-full object-contain bg-white/90 p-0.5 shrink-0"
                              />
                            )}
                            <span className="truncate">{t.institution || 'Manual'}</span>
                            {isManual && (
                              <span className="rounded bg-accent-gold/20 border border-accent-gold/40 px-1.5 py-0.2 text-[9px] font-sans font-bold text-accent-gold shrink-0">
                                Manual
                              </span>
                            )}
                          </div>
                          {t.notes && (
                            <p className="text-[10px] text-text-muted truncate max-w-[195px]" title={t.notes}>
                              {t.notes}
                            </p>
                          )}
                        </td>

                        {/* 4. Quantidade */}
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-text-primary whitespace-nowrap tabular-nums">
                          {Number(t.quantity || 0).toLocaleString('pt-BR', {
                            minimumFractionDigits: isCrypto ? 8 : 0,
                            maximumFractionDigits: isCrypto ? 8 : 4,
                          })}{' '}
                          <span className="text-[10px] font-normal text-text-secondary">{t.ticker}</span>
                        </td>

                        {/* 5. Preço Unitário */}
                        <td className="px-3 py-2.5 text-right font-mono text-text-secondary whitespace-nowrap tabular-nums">
                          {t.unit_price > 0 ? formatMoney(t.unit_price, true) : '-'}
                        </td>

                        {/* 6. Valor Total */}
                        <td className="px-3 py-2.5 text-right font-mono font-bold text-text-primary whitespace-nowrap tabular-nums">
                          {t.total_value > 0 ? formatMoney(t.total_value, false) : '-'}
                        </td>

                        {/* 7. Ações (Sempre visível à direita) */}
                        <td
                          className="px-3 py-2.5 text-right whitespace-nowrap"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => startEditingTrade(t)}
                              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                                isEditingThis
                                  ? 'border-accent-gold bg-accent-gold text-black font-bold'
                                  : 'border-accent-gold/40 bg-accent-gold/10 hover:bg-accent-gold/25 text-accent-gold'
                              }`}
                              title="Editar este lançamento"
                            >
                              <Edit2 className="h-3 w-3 shrink-0" />
                              <span>Editar</span>
                            </button>

                            <button
                              type="button"
                              disabled={deletingId === t.id}
                              onClick={(e) => handleDelete(t, e)}
                              className="inline-flex items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 hover:bg-rose-500/25 p-1.5 text-xs font-semibold text-rose-400 transition-colors cursor-pointer disabled:opacity-50"
                              title="Excluir este lançamento e recalcular o ativo"
                            >
                              {deletingId === t.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between border-t border-border px-5 py-3 bg-bg-elevated/30 text-xs text-text-secondary shrink-0">
          <span>
            Exibindo <strong>{filteredTrades.length}</strong> lançamento(s) de <strong>{investment.code_ticker}</strong> · Clique em qualquer linha para editar
          </span>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}
