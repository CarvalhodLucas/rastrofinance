import { useEffect, useState, useMemo } from 'react';
import {
  X,
  Loader2,
  ArrowUpRight,
  TrendingUp,
  TrendingDown,
  Calendar,
  CheckCircle2,
  Pencil,
  Trash2,
  Save,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/services/api';
import type { Investment, AssetType } from '@/types/finance';
import type { Currency } from '@/contexts/CurrencyContext';

interface Props {
  open: boolean;
  investment?: Investment | null;
  availableInvestments?: Investment[];
  initialTab?: 'SELL' | 'EDIT';
  onClose: () => void;
  onSuccess: () => void;
}

export function SellInvestmentModal({
  open,
  investment,
  availableInvestments = [],
  initialTab = 'SELL',
  onClose,
  onSuccess,
}: Props) {
  const { notify } = useToast();

  const [activeTab, setActiveTab] = useState<'SELL' | 'EDIT'>(initialTab);
  const [selectedId, setSelectedId] = useState<string>('');

  // Estados da Aba de Venda / Resgate
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [totalGrossInput, setTotalGrossInput] = useState('');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // Estados da Aba de Edição do Ativo
  const [editName, setEditName] = useState('');
  const [editTicker, setEditTicker] = useState('');
  const [editAssetType, setEditAssetType] = useState<AssetType>('STOCK');
  const [editInstitution, setEditInstitution] = useState('');
  const [editQuantity, setEditQuantity] = useState('');
  const [editAveragePrice, setEditAveragePrice] = useState('');
  const [editCurrentPrice, setEditCurrentPrice] = useState('');
  const [editCurrency, setEditCurrency] = useState('BRL');
  const [editYieldRate, setEditYieldRate] = useState('');
  const [editYieldFrequency, setEditYieldFrequency] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [editDate, setEditDate] = useState(new Date().toISOString().split('T')[0]);
  const [savingEdit, setSavingEdit] = useState(false);

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

  // Ativo atualmente selecionado para ação
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

  const populateEditFields = (inv: Investment) => {
    setEditName(inv.name || '');
    setEditTicker(inv.code_ticker || '');
    setEditAssetType(inv.asset_type || 'STOCK');
    setEditInstitution(inv.institution || '');
    setEditQuantity(String(inv.quantity || 0));
    setEditAveragePrice(String(inv.average_price || 0));
    setEditCurrentPrice(String(inv.current_price || inv.average_price || 0));
    setEditCurrency(inv.currency || 'BRL');
    setEditYieldRate(inv.yield_rate !== undefined && inv.yield_rate > 0 ? String(inv.yield_rate) : '');
    setEditYieldFrequency(inv.yield_frequency || 'MONTHLY');
    setEditDate(inv.created_at ? inv.created_at.substring(0, 10) : new Date().toISOString().split('T')[0]);
  };

  useEffect(() => {
    if (open) {
      setActiveTab(initialTab);
      const invToUse = investment || eligibleInvestments.find((i) => i.id === selectedId) || eligibleInvestments[0];
      if (invToUse) {
        setSelectedId(invToUse.id);
        setQuantity(String(invToUse.quantity));
        const initialPrice = isCashOrStable ? 1 : (invToUse.current_price || invToUse.average_price || 0);
        setUnitPrice(String(initialPrice));
        const total = (invToUse.quantity || 0) * initialPrice;
        setTotalGrossInput(total > 0 ? total.toFixed(2) : '');

        populateEditFields(invToUse);
      } else {
        setQuantity('');
        setUnitPrice('');
        setTotalGrossInput('');
      }
      setSaleDate(new Date().toISOString().split('T')[0]);
      setNotes('');
    }
  }, [open, investment, initialTab]);

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

      populateEditFields(chosen);
    }
  };

  if (!open) return null;

  // Determinar a moeda do ativo
  const getAssetCurrency = () => {
    if (!activeInvestment) return { code: 'BRL' as Currency, symbol: 'R$' };
    const inst = (activeInvestment.institution || '').toUpperCase();
    const name = (activeInvestment.name || '').toUpperCase();
    const ticker = (activeInvestment.code_ticker || '').toUpperCase();

    if (
      activeInvestment.currency === 'USD' ||
      activeInvestment.currency === 'USDT' ||
      ticker.includes('WISE_USD') ||
      name.includes('WISE DÓLAR') ||
      name.includes('WISE DOLAR')
    ) {
      return { code: 'USD' as Currency, symbol: '$' };
    } else if (
      activeInvestment.currency === 'EUR' ||
      ticker.includes('WISE_EUR') ||
      name.includes('WISE EURO')
    ) {
      return { code: 'EUR' as Currency, symbol: '€' };
    } else if (activeInvestment.currency === 'CLP' || ticker.includes('WISE_CLP')) {
      return { code: 'CLP' as Currency, symbol: '$' };
    }

    const isCrypto =
      activeInvestment.asset_type === 'CRYPTO' ||
      inst.includes('BINANCE') ||
      ['BTC', 'ETH', 'SOL', 'ONDO', 'SXT', 'LINK', 'RENDER', 'ROSE', 'VIRTUAL', 'XRP'].includes(ticker);

    if (isCrypto) {
      return { code: 'USD' as Currency, symbol: '$' };
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

    let minDec = 2;
    let maxDec = 2;
    if (assetCurrencyCode === 'USD' && isUnitPrice) {
      if (val < 0.001) maxDec = 8;
      else if (val < 0.1) maxDec = 6;
      else if (val < 1.0) maxDec = 4;
    }

    return new Intl.NumberFormat(localeMap[assetCurrencyCode] || 'pt-BR', {
      style: 'currency',
      currency: assetCurrencyCode,
      minimumFractionDigits: minDec,
      maximumFractionDigits: maxDec,
    }).format(val);
  };

  const maxQty = activeInvestment?.quantity || 0;
  const numQty = parseFloat(quantity) || 0;
  const numPrice = parseFloat(unitPrice) || 0;
  const avgPrice = activeInvestment?.average_price || activeInvestment?.current_price || 0;

  // Simulações em tempo real da venda
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

  // 1. Submit de Venda / Resgate
  const handleSubmitSale = async (e: React.FormEvent) => {
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

      notify(
        isCashOrStable
          ? `Resgate de ${formatAssetVal(grossSale)} registrado com sucesso!`
          : `Venda de ${numQty} ${activeInvestment.code_ticker} registrada com sucesso!`,
        'success'
      );

      if ((res as any).is_closed || res.remaining_qty <= 0) {
        notify(`Posição em ${activeInvestment.code_ticker} totalmente liquidada e encerrada.`, 'info');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      notify(err.message || (isCashOrStable ? 'Erro ao realizar resgate do saldo.' : 'Erro ao realizar venda do ativo.'), 'error');
    } finally {
      setLoading(false);
    }
  };

  // 2. Submit de Edição do Ativo
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeInvestment) return;

    if (!editName.trim()) {
      notify('O nome do ativo é obrigatório.', 'error');
      return;
    }

    const qty = parseFloat(editQuantity);
    if (isNaN(qty) || qty < 0) {
      notify('Informe uma quantidade/saldo válido.', 'error');
      return;
    }

    setSavingEdit(true);
    try {
      const avgP = isCashOrStable ? 1 : (parseFloat(editAveragePrice) || 0);
      const curP = isCashOrStable ? 1 : (parseFloat(editCurrentPrice) || avgP);
      const parsedYield = editYieldRate.trim() ? parseFloat(editYieldRate.replace(',', '.')) : 0;
      const srcPrefix = (activeInvestment.sync_source || 'MANUAL').split('#')[0];

      await api.updateInvestment(activeInvestment.id, {
        name: editName.trim(),
        code_ticker: editTicker.trim().toUpperCase() || activeInvestment.code_ticker,
        asset_type: editAssetType,
        institution: editInstitution.trim() || 'Manual',
        quantity: qty,
        average_price: avgP,
        current_price: curP,
        currency: editCurrency,
        sync_source: `${srcPrefix}#${avgP}#${curP}` as any,
        yield_rate: parsedYield,
        yield_frequency: editYieldFrequency,
        date: editDate,
      });

      notify('Ativo atualizado com sucesso!', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      notify(err.message || 'Falha ao atualizar o ativo.', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  // 3. Exclusão direta do Ativo
  const handleDeleteAsset = async () => {
    if (!activeInvestment) return;
    const confirmName = activeInvestment.name || activeInvestment.code_ticker;
    if (!window.confirm(`Tem certeza que deseja remover ${confirmName} da carteira? Esta ação é definitiva.`)) {
      return;
    }

    setSavingEdit(true);
    try {
      await api.deleteInvestment(activeInvestment.id);
      notify(`${confirmName} excluído com sucesso.`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      notify(err.message || 'Erro ao excluir ativo.', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-700 bg-[#0F172A] text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl border ${
              activeTab === 'SELL'
                ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                : 'bg-accent-gold/15 text-accent-gold border-accent-gold/30'
            }`}>
              {activeTab === 'SELL' ? <ArrowUpRight className="h-5 w-5" /> : <Pencil className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                {activeTab === 'SELL'
                  ? (isCashOrStable ? 'Resgatar Saldo' : 'Registrar Venda')
                  : 'Editar Ativo da Carteira'}
                {activeInvestment && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-mono font-bold">
                    {activeInvestment.code_ticker}
                  </span>
                )}
              </h2>
              <p className="text-xs text-slate-400 truncate max-w-xs">
                {activeInvestment?.name || 'Selecione o ativo'}
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

        {/* Sub-abas de Navegação: Venda/Resgate vs Edição */}
        <div className="flex border-b border-slate-800 bg-slate-900/40 px-6">
          <button
            type="button"
            onClick={() => setActiveTab('SELL')}
            className={`py-3 px-4 text-xs sm:text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'SELL'
                ? 'border-rose-500 text-rose-400 font-bold bg-rose-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowUpRight className="h-4 w-4" />
            <span>{isCashOrStable ? 'Resgate / Saque' : 'Venda do Ativo'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('EDIT')}
            className={`py-3 px-4 text-xs sm:text-sm font-semibold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'EDIT'
                ? 'border-accent-gold text-accent-gold font-bold bg-accent-gold/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Pencil className="h-4 w-4" />
            <span>Editar Ativo</span>
          </button>
        </div>

        {activeTab === 'SELL' ? (
          /* ======================================================== */
          /* ABA 1: REGISTRAR VENDA OU RESGATE                        */
          /* ======================================================== */
          <form onSubmit={handleSubmitSale} className="p-6 space-y-4 overflow-y-auto">
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
                    {formatAssetVal(avgPrice, true)}
                  </p>
                </div>
              </div>
            )}

            {/* Quantidade a Vender e Botões Rápidos */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>{isCashOrStable ? 'Valor / Saldo a Resgatar *' : 'Quantidade a Vender *'}</span>
                <span className="text-[11px] text-slate-500">Máx: {maxQty}</span>
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  value={quantity}
                  onChange={(e) => {
                    setQuantity(e.target.value);
                    const parsed = parseFloat(e.target.value) || 0;
                    if (numPrice > 0 && parsed > 0) {
                      setTotalGrossInput((parsed * numPrice).toFixed(2));
                    }
                  }}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-sm font-mono font-bold text-white placeholder-slate-600 focus:border-rose-500 focus:outline-none pr-16"
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400">
                  {isCashOrStable ? assetCurrencyCode : 'unid.'}
                </span>
              </div>

              {/* Botões Rápidos: 25%, 50%, 75%, 100% */}
              <div className="grid grid-cols-4 gap-2 pt-1">
                {[0.25, 0.5, 0.75, 1].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => handleSetPercent(pct)}
                    className="py-1.5 rounded-lg border border-slate-800 bg-slate-900 text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white hover:border-slate-700 transition-all cursor-pointer"
                  >
                    {pct === 1 ? '100% (Tudo)' : `${pct * 100}%`}
                  </button>
                ))}
              </div>
            </div>

            {/* Preço de Venda Unitário e Total Bruto */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Preço Unitário ({assetCurrencySymbol}) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    value={unitPrice}
                    onChange={(e) => handleUnitPriceChange(e.target.value)}
                    disabled={isCashOrStable}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2 text-sm font-mono font-bold text-white placeholder-slate-600 focus:border-rose-500 focus:outline-none disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
                    {assetCurrencyCode}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Total da Operação ({assetCurrencySymbol})
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    value={totalGrossInput}
                    onChange={(e) => handleTotalGrossChange(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2 text-sm font-mono font-bold text-emerald-400 placeholder-slate-600 focus:border-rose-500 focus:outline-none"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-500">
                    {assetCurrencyCode}
                  </span>
                </div>
              </div>
            </div>

            {/* Data da Venda */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                Data da Operação *
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2 text-xs sm:text-sm font-medium text-white focus:border-rose-500 focus:outline-none"
                />
              </div>
            </div>

            {/* Simulação do Resultado em Tempo Real */}
            {numQty > 0 && numPrice > 0 && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Total a ser creditado:</span>
                  <span className="font-mono font-bold text-white text-sm">
                    {formatAssetVal(grossSale)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">Posição restante:</span>
                  <span className="font-mono text-slate-300">
                    {remainingQty.toLocaleString('pt-BR', { maximumFractionDigits: 6 })} {isCashOrStable ? assetCurrencyCode : 'unid.'}
                  </span>
                </div>

                {!isCashOrStable && (
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-800">
                    <div className="flex items-center gap-1.5">
                      {realizedPnl >= 0 ? (
                        <>
                          <TrendingUp className="h-4 w-4 text-emerald-400" />
                          <span className="font-semibold text-emerald-400">Lucro Estimado:</span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className="h-4 w-4 text-rose-400" />
                          <span className="font-semibold text-rose-400">Prejuízo Estimado:</span>
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
                    <span>Confirmando...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{isCashOrStable ? 'Confirmar Resgate' : 'Confirmar Venda'}</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        ) : (
          /* ======================================================== */
          /* ABA 2: EDIÇÃO DIRETA DOS DADOS DO ATIVO                  */
          /* ======================================================== */
          <form onSubmit={handleSaveEdit} className="p-6 space-y-4 overflow-y-auto">
            {/* Se for Caixinha (ex: Wise, Caixinha Nubank, etc.) */}
            {isCashOrStable ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nome da Caixinha / Reserva *
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Ex: Wise Dólar, Wise Euro, Caixinha Nubank"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-white focus:border-accent-gold focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Instituição / Banco *
                    </label>
                    <input
                      type="text"
                      value={editInstitution}
                      onChange={(e) => setEditInstitution(e.target.value)}
                      placeholder="Wise, Nubank, etc."
                      className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs sm:text-sm text-white focus:border-accent-gold focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Moeda da Caixinha *
                    </label>
                    <select
                      value={editCurrency}
                      onChange={(e) => setEditCurrency(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs sm:text-sm text-white focus:border-accent-gold focus:outline-none"
                    >
                      <option value="USD">🇺🇸 Dólar (USD $)</option>
                      <option value="EUR">🇪🇺 Euro (EUR €)</option>
                      <option value="BRL">🇧🇷 Real (BRL R$)</option>
                      <option value="CLP">🇨🇱 Peso Chileno (CLP $)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Saldo Atual *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="any"
                        value={editQuantity}
                        onChange={(e) => setEditQuantity(e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs sm:text-sm font-bold text-white focus:border-accent-gold focus:outline-none pr-12 font-mono"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        {editCurrency}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Preço fixado em 1,00 (saldo puro).
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-accent-gold" />
                      Data de Início
                    </label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs sm:text-sm text-white focus:border-accent-gold focus:outline-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            ) : (
              /* Se for Ativo de Investimento Tradicional (Ação, FII, Cripto) */
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Ticker / Código *
                    </label>
                    <input
                      type="text"
                      value={editTicker}
                      onChange={(e) => setEditTicker(e.target.value.toUpperCase())}
                      placeholder="Ex: BBAS3, BTC, MXRF11"
                      className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs sm:text-sm font-bold uppercase text-white focus:border-accent-gold focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Tipo de Ativo *
                    </label>
                    <select
                      value={editAssetType}
                      onChange={(e) => setEditAssetType(e.target.value as AssetType)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs sm:text-sm text-white focus:border-accent-gold focus:outline-none"
                    >
                      <option value="STOCK">Ação Brasil (B3)</option>
                      <option value="FII">Fundo Imobiliário (FII)</option>
                      <option value="CRYPTO">Criptomoeda</option>
                      <option value="FIXED_INCOME">Renda Fixa (Tesouro/CDB)</option>
                      <option value="OTHER">Outros / Internacional</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Nome do Ativo / Descrição *
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Ex: Banco do Brasil, Petrobras, Bitcoin"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs sm:text-sm text-white focus:border-accent-gold focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Banco / Corretora *
                    </label>
                    <input
                      type="text"
                      value={editInstitution}
                      onChange={(e) => setEditInstitution(e.target.value)}
                      placeholder="XP, NuInvest, Binance..."
                      className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs sm:text-sm text-white focus:border-accent-gold focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Moeda *
                    </label>
                    <select
                      value={editCurrency}
                      onChange={(e) => setEditCurrency(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3.5 py-2.5 text-xs sm:text-sm text-white focus:border-accent-gold focus:outline-none"
                    >
                      <option value="BRL">🇧🇷 Real (BRL R$)</option>
                      <option value="USD">🇺🇸 Dólar (USD $)</option>
                      <option value="EUR">🇪🇺 Euro (EUR €)</option>
                      <option value="CLP">🇨🇱 Peso Chileno (CLP $)</option>
                      <option value="USDT">USDT</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Quantidade *
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={editQuantity}
                      onChange={(e) => setEditQuantity(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs sm:text-sm text-white focus:border-accent-gold focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Preço Médio ({editCurrency === 'USD' ? '$' : editCurrency === 'EUR' ? '€' : 'R$'})
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={editAveragePrice}
                      onChange={(e) => setEditAveragePrice(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs sm:text-sm text-white focus:border-accent-gold focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Preço Atual ({editCurrency === 'USD' ? '$' : editCurrency === 'EUR' ? '€' : 'R$'})
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={editCurrentPrice}
                      onChange={(e) => setEditCurrentPrice(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900/90 px-3 py-2 text-xs sm:text-sm text-white focus:border-accent-gold focus:outline-none font-mono"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Seção de Rendimento Automático se elegível */}
            {(isCashOrStable || editAssetType === 'FIXED_INCOME' || editAssetType === 'OTHER' || (editYieldRate && parseFloat(editYieldRate) > 0)) && (
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-accent-gold" />
                    Rendimento Automático Mensal
                  </span>
                  <span className="text-[10px] font-semibold text-accent-gold bg-accent-gold/10 px-2 py-0.5 rounded-full border border-accent-gold/20">
                    Soma todo dia 1º
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Taxa (%)
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={editYieldRate}
                      onChange={(e) => setEditYieldRate(e.target.value)}
                      placeholder="Ex: 0.25 ou 2.2"
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-accent-gold focus:outline-none font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">
                      Frequência
                    </label>
                    <select
                      value={editYieldFrequency}
                      onChange={(e) => setEditYieldFrequency(e.target.value as 'MONTHLY' | 'ANNUAL')}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-white focus:border-accent-gold focus:outline-none"
                    >
                      <option value="MONTHLY">% ao mês (a.m.)</option>
                      <option value="ANNUAL">% ao ano (a.a.)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* Botões do Modo Edição */}
            <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={handleDeleteAsset}
                disabled={savingEdit}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-3 py-1.5 rounded-lg transition-colors border border-rose-500/20 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Excluir Ativo</span>
              </button>

              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onClose}
                  disabled={savingEdit}
                  className="border-slate-700 text-slate-300 hover:bg-slate-800 cursor-pointer"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={savingEdit}
                  className="gap-2 bg-accent-gold hover:bg-amber-400 text-black font-bold shadow-lg shadow-amber-950/40 cursor-pointer"
                >
                  {savingEdit ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Salvando...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>Salvar Alterações</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
