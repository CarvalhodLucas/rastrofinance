import { useEffect, useState, useRef } from 'react';
import { X, Loader2, Save, Search, Zap, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/services/api';
import type { AssetType, Investment } from '@/types/finance';
import rastroAssets from '@/data/assetsDatabase.json';
import { useCurrency } from '@/contexts/CurrencyContext';

export const POPULAR_INSTITUTIONS = [
  'XP Investimentos',
  'NuInvest',
  'Nubank',
  'Santander',
  'BTG Pactual',
  'Inter',
  'Clear Corretora',
  'Rico',
  'Toro Investimentos',
  'Ágora Investimentos',
  'Itaú Corretora',
  'Bradesco',
  'Banco do Brasil',
  'Genial Investimentos',
  'Binance',
  'Wise',
  'Nomad',
  'Avenue',
];

interface Props {
  open: boolean;
  investmentToEdit?: Investment | null;
  initialAssetType?: AssetType;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddInvestmentModal({ open, investmentToEdit, initialAssetType = 'STOCK', onClose, onSuccess }: Props) {
  const { notify } = useToast();
  const { rates } = useCurrency();
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [assetType, setAssetType] = useState<AssetType>(initialAssetType);
  const [institution, setInstitution] = useState(initialAssetType === 'CRYPTO' ? 'Binance' : 'XP Investimentos');
  const [quantity, setQuantity] = useState('');
  const [averagePrice, setAveragePrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [currency, setCurrency] = useState('BRL');
  const [yieldRate, setYieldRate] = useState('');
  const [yieldFrequency, setYieldFrequency] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [loading, setLoading] = useState(false);
  const [fetchingQuote, setFetchingQuote] = useState(false);

  // Contas bancárias conectadas do usuário
  const [connectedBanks, setConnectedBanks] = useState<string[]>([]);

  useEffect(() => {
    api.getAccounts().then((res) => {
      if (res?.accounts?.length) {
        const names = Array.from(new Set(res.accounts.map((a) => a.institution_name).filter(Boolean)));
        setConnectedBanks(names);
      }
    }).catch(() => {});
  }, []);

  const allInstitutionOptions = Array.from(new Set([...connectedBanks, ...POPULAR_INSTITUTIONS]));
  const topQuickInstitutions = Array.from(
    new Set([...connectedBanks, 'XP Investimentos', 'NuInvest', 'Santander', 'BTG Pactual', 'Inter', 'Clear Corretora', 'Binance', 'Wise'])
  ).slice(0, 8);

  const defaultBank = connectedBanks[0] || 'XP Investimentos';

  // Suggestions Autocomplete
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTickerChange = (val: string) => {
    const clean = val.toUpperCase();
    setTicker(clean);

    if (clean.trim().length >= 1) {
      const matches = rastroAssets.filter(
        (a) =>
          a.ticker.toUpperCase().includes(clean) ||
          a.name.toUpperCase().includes(clean)
      ).slice(0, 8);
      setSuggestions(matches);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = async (item: typeof rastroAssets[0]) => {
    setTicker(item.ticker);
    setName(item.name);
    setShowSuggestions(false);

    // Mapear tipo do RASTRO para CRM FINANCIAS mantendo o banco escolhido pelo usuário
    if (item.type === 'FIIs' || item.ticker.endsWith('11')) {
      setAssetType('FII');
      if (!institution || institution === 'B3') setInstitution(defaultBank);
    } else if (item.type === 'Ações') {
      setAssetType('STOCK');
      if (!institution || institution === 'B3') setInstitution(defaultBank);
    } else if (item.type === 'Cripto' || item.exchange === 'Crypto') {
      setAssetType('CRYPTO');
      setInstitution('Binance');
      setCurrency('USD');
    }

    // Buscar cotação atualizada em tempo real via Yahoo Finance API do RASTRO
    setFetchingQuote(true);
    try {
      const q = await api.getQuote(item.ticker, 'compact');
      if (q && q.price && q.price > 0) {
        setCurrentPrice(String(q.price));
        if (!averagePrice) setAveragePrice(String(q.price));
      }
    } catch {
      // ignora erro de cotação se não encontrar
    } finally {
      setFetchingQuote(false);
    }
  };

  const handleLookupOnline = async (symbolToLookup: string) => {
    const clean = symbolToLookup.trim().toUpperCase();
    if (!clean) return;
    setFetchingQuote(true);
    setShowSuggestions(false);
    try {
      const q = await api.getQuote(clean, 'compact');
      if (q && q.price && q.price > 0) {
        setName(q.name || clean);
        setCurrentPrice(String(q.price));
        if (!averagePrice || averagePrice === '0' || averagePrice === '0.00') {
          setAveragePrice(String(q.price));
        }
        if (clean.endsWith('11')) {
          setAssetType('FII');
          if (!institution || institution === 'B3') setInstitution(defaultBank);
        } else if (/[0-9]$/.test(clean)) {
          setAssetType('STOCK');
          if (!institution || institution === 'B3') setInstitution(defaultBank);
        } else {
          setAssetType('CRYPTO');
          setInstitution('Binance');
          setCurrency('USD');
        }
      }
    } catch {
      // ignore
    } finally {
      setFetchingQuote(false);
    }
  };

  const handleTickerBlur = () => {
    if (ticker.trim().length >= 3 && (!currentPrice || currentPrice === '0' || !name)) {
      handleLookupOnline(ticker);
    }
  };

  useEffect(() => {
    if (investmentToEdit) {
      setName(investmentToEdit.name);
      setTicker(investmentToEdit.code_ticker);
      setAssetType(investmentToEdit.asset_type);
      setInstitution(investmentToEdit.institution || defaultBank);
      setQuantity(String(investmentToEdit.quantity));

      const isCrypto =
        investmentToEdit.asset_type === 'CRYPTO' ||
        (investmentToEdit.institution || '').toUpperCase().includes('BINANCE') ||
        ['BTC', 'ETH', 'SOL', 'ONDO', 'SXT', 'LINK', 'RENDER', 'ROSE', 'VIRTUAL'].includes(
          (investmentToEdit.code_ticker || '').toUpperCase()
        );

      let avgP = investmentToEdit.average_price || 0;
      let curP = investmentToEdit.current_price || 0;

      // Se for cripto e os valores salvos no banco estiverem em Reais (BRL), converte para USD.
      if (isCrypto && investmentToEdit.currency === 'BRL') {
        const usdRate = rates['usd'] ?? 0.1818;
        avgP = avgP * usdRate;
        curP = curP * usdRate;
      }

      setAveragePrice(String(avgP));
      setCurrentPrice(String(curP));
      setCurrency(isCrypto ? 'USD' : investmentToEdit.currency || 'BRL');
      setYieldRate(investmentToEdit.yield_rate !== undefined && investmentToEdit.yield_rate > 0 ? String(investmentToEdit.yield_rate) : '');
      setYieldFrequency(investmentToEdit.yield_frequency || 'MONTHLY');
      const initialDate = investmentToEdit.created_at
        ? investmentToEdit.created_at.substring(0, 10)
        : new Date().toISOString().substring(0, 10);
      setTransactionDate(initialDate);
    } else {
      const defaultType = initialAssetType || 'STOCK';
      setName('');
      setTicker('');
      setAssetType(defaultType);
      setInstitution(defaultType === 'CRYPTO' ? 'Binance' : defaultBank);
      setQuantity('');
      setAveragePrice('');
      setCurrentPrice('');
      setCurrency(defaultType === 'CRYPTO' ? 'USD' : 'BRL');
      setYieldRate('');
      setYieldFrequency('MONTHLY');
      setTransactionDate(new Date().toISOString().substring(0, 10));
    }
  }, [investmentToEdit, initialAssetType, open, defaultBank]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim() || !ticker.trim()) {
      notify('Nome e Ticker são obrigatórios.', 'error');
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      notify('Informe uma quantidade maior que zero.', 'error');
      return;
    }

    // "Rendimento Automático Mensal" só deve ser visível para ativos elegíveis
    const isYieldEligible =
      assetType === 'FIXED_INCOME' ||
      assetType === 'OTHER' ||
      institution.toLowerCase().includes('wise') ||
      name.toLowerCase().includes('wise') ||
      name.toLowerCase().includes('rende+') ||
      name.toLowerCase().includes('caixinha') ||
      institution.toLowerCase().includes('caixa') ||
      Boolean(yieldRate && parseFloat(yieldRate) > 0);

    const parsedYield = (isYieldEligible && yieldRate.trim()) ? parseFloat(yieldRate.replace(',', '.')) : 0;

    setLoading(true);
    try {
      if (investmentToEdit?.id) {
        const newAvg = parseFloat(averagePrice) || 0;
        const newCur = parseFloat(currentPrice) || newAvg;
        const srcPrefix = (investmentToEdit.sync_source || 'MANUAL').split('#')[0];
        const updatedSyncSource = `${srcPrefix}#${newAvg}#${newCur}`;

        await api.updateInvestment(investmentToEdit.id, {
          name: name.trim(),
          code_ticker: ticker.trim().toUpperCase(),
          asset_type: assetType,
          institution: institution.trim() || 'Manual',
          quantity: qty,
          average_price: newAvg,
          current_price: newCur,
          currency,
          sync_source: updatedSyncSource as any,
          yield_rate: parsedYield,
          yield_frequency: yieldFrequency,
          date: transactionDate,
        });
        notify('Investimento atualizado com sucesso!', 'success');
      } else {
        await api.createInvestment({
          name: name.trim(),
          code_ticker: ticker.trim().toUpperCase(),
          asset_type: assetType,
          institution: institution.trim() || 'Manual',
          quantity: qty,
          average_price: parseFloat(averagePrice) || 0,
          current_price: parseFloat(currentPrice) || parseFloat(averagePrice) || 0,
          currency,
          yield_rate: parsedYield,
          yield_frequency: yieldFrequency,
          date: transactionDate,
        });
        notify('Novo investimento cadastrado com sucesso!', 'success');
      }

      onSuccess();
      onClose();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha ao salvar investimento.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md rounded-2xl border border-border bg-bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h2 className="text-xl font-bold text-text-primary">
            {investmentToEdit ? 'Editar Ativo' : 'Novo Ativo de Investimento'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="relative" ref={searchRef}>
              <label className="block text-sm font-semibold text-text-primary mb-1.5 flex items-center justify-between">
                <span>Ticker / Código *</span>
                {fetchingQuote && (
                  <span className="text-xs text-accent-gold flex items-center gap-1 font-normal">
                    <Loader2 className="h-3 w-3 animate-spin" /> Buscando preço...
                  </span>
                )}
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={ticker}
                  onChange={(e) => handleTickerChange(e.target.value)}
                  onFocus={() => ticker && handleTickerChange(ticker)}
                  onBlur={handleTickerBlur}
                  placeholder="Ex: POMO4, PETR4, MXRF11"
                  className="w-full rounded-xl border border-border bg-bg-primary px-3.5 py-2.5 text-sm sm:text-base font-medium uppercase text-text-primary placeholder:text-text-secondary/50 focus:border-accent-gold focus:outline-none"
                />
              </div>

              {/* Dropdown de sugestões do banco RASTRO */}
              {showSuggestions && (suggestions.length > 0 || ticker.trim().length >= 2) && (
                <div className="absolute left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-bg-card p-1.5 shadow-2xl z-50 animate-fade-in space-y-1">
                  <div className="px-3 py-1 text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1 border-b border-border/50 pb-1">
                    <Search className="h-3.5 w-3.5 text-accent-gold" />
                    <span>Banco de Ativos (RASTRO)</span>
                  </div>
                  {suggestions.map((item) => (
                    <button
                      key={item.ticker}
                      type="button"
                      onClick={() => handleSelectSuggestion(item)}
                      className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs sm:text-sm text-left hover:bg-bg-elevated transition-colors group"
                    >
                      <div className="flex flex-col truncate">
                        <span className="font-bold font-mono text-accent-gold group-hover:text-amber-300">
                          {item.ticker}
                        </span>
                        <span className="text-xs text-text-secondary truncate">
                          {item.name}
                        </span>
                      </div>
                      <span className="shrink-0 text-xs font-medium px-2 py-0.5 rounded-full bg-bg-primary text-text-secondary border border-border">
                        {item.type || 'B3'}
                      </span>
                    </button>
                  ))}
                  {ticker.trim().length >= 2 && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleLookupOnline(ticker);
                      }}
                      className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs sm:text-sm text-left text-accent-gold hover:bg-bg-elevated transition-colors border-t border-border/50 font-medium"
                    >
                      <Search className="h-3.5 w-3.5" />
                      <span>Buscar cotação online de "{ticker}"</span>
                    </button>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-text-primary mb-1.5">
                Tipo de Ativo *
              </label>
              <select
                value={assetType}
                onChange={(e) => {
                  const val = e.target.value as AssetType;
                  setAssetType(val);
                  if (val === 'CRYPTO') {
                    setCurrency('USD');
                  }
                }}
                className="w-full rounded-xl border border-border bg-bg-primary px-3.5 py-2.5 text-sm sm:text-base text-text-primary focus:border-accent-gold focus:outline-none"
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
            <label className="block text-sm font-semibold text-text-primary mb-1.5">
              Nome do Ativo / Descrição *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Marcopolo S.A., Petrobras PN, Bitcoin"
              className="w-full rounded-xl border border-border bg-bg-primary px-3.5 py-2.5 text-sm sm:text-base text-text-primary placeholder:text-text-secondary/50 focus:border-accent-gold focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm sm:text-base font-semibold text-text-primary mb-1.5 flex items-center justify-between">
                <span>Banco / Corretora *</span>
                <span className="text-xs text-text-secondary font-normal">Onde comprou</span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  list="institution-options"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="Selecione ou digite o banco"
                  className="w-full rounded-xl border border-border bg-bg-primary px-3.5 py-2.5 text-sm sm:text-base text-text-primary placeholder:text-text-secondary/50 focus:border-accent-gold focus:outline-none"
                />
                <datalist id="institution-options">
                  {allInstitutionOptions.map((inst) => (
                    <option key={inst} value={inst} />
                  ))}
                </datalist>
              </div>
              {/* Chips rápidos dos principais bancos do usuário */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {topQuickInstitutions.map((inst) => (
                  <button
                    key={inst}
                    type="button"
                    onClick={() => setInstitution(inst)}
                    className={`px-2.5 py-1 text-xs rounded-lg border transition-all ${
                      institution === inst
                        ? 'border-accent-gold bg-accent-gold/20 text-accent-gold font-bold shadow-xs'
                        : 'border-border/60 bg-bg-elevated/40 text-text-secondary hover:text-text-primary hover:border-border'
                    }`}
                  >
                    {inst}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm sm:text-base font-semibold text-text-primary mb-1.5">
                  Moeda
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full rounded-xl border border-border bg-bg-primary px-3.5 py-2.5 text-sm sm:text-base text-text-primary focus:border-accent-gold focus:outline-none"
                >
                  <option value="BRL">BRL (R$)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="CLP">CLP ($)</option>
                  <option value="USDT">USDT</option>
                </select>
              </div>

              <div>
                <label className="block text-sm sm:text-base font-semibold text-text-primary mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-accent-gold" />
                    Data da Compra *
                  </span>
                  <span className="text-xs text-text-secondary font-normal">Mês no gráfico</span>
                </label>
                <input
                  type="date"
                  value={transactionDate}
                  onChange={(e) => setTransactionDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-bg-primary px-3 py-2 text-sm sm:text-base font-medium text-text-primary focus:border-accent-gold focus:outline-none cursor-pointer"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm sm:text-base font-semibold text-text-primary mb-1.5">
                Quantidade *
              </label>
              <input
                type="number"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-border bg-bg-primary px-3.5 py-2.5 text-sm sm:text-base font-medium text-text-primary placeholder:text-text-secondary/50 focus:border-accent-gold focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm sm:text-base font-semibold text-text-primary mb-1.5">
                Preço Médio ({currency === 'USD' ? '$' : currency === 'EUR' ? '€' : 'R$'})
              </label>
              <input
                type="number"
                step="any"
                value={averagePrice}
                onChange={(e) => setAveragePrice(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-border bg-bg-primary px-3.5 py-2.5 text-sm sm:text-base font-medium text-text-primary placeholder:text-text-secondary/50 focus:border-accent-gold focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm sm:text-base font-semibold text-text-primary mb-1.5">
                Preço Atual ({currency === 'USD' ? '$' : currency === 'EUR' ? '€' : 'R$'})
              </label>
              <input
                type="number"
                step="any"
                value={currentPrice}
                onChange={(e) => setCurrentPrice(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-border bg-bg-primary px-3.5 py-2.5 text-sm sm:text-base font-medium text-text-primary placeholder:text-text-secondary/50 focus:border-accent-gold focus:outline-none"
              />
            </div>
          </div>

          {/* Seção de Taxa de Rendimento Automático (ex: Wise Rende+, Caixa, Renda Fixa) */}
          {(assetType === 'FIXED_INCOME' ||
            assetType === 'OTHER' ||
            institution.toLowerCase().includes('wise') ||
            name.toLowerCase().includes('wise') ||
            name.toLowerCase().includes('rende+') ||
            name.toLowerCase().includes('caixinha') ||
            institution.toLowerCase().includes('caixa') ||
            Boolean(yieldRate && parseFloat(yieldRate) > 0)) && (
            <div className="rounded-xl border border-border/70 bg-bg-primary/40 p-4 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Zap className="h-4.5 w-4.5 text-accent-gold" />
                  <span className="text-sm font-bold text-text-primary">
                    Rendimento Automático Mensal
                  </span>
                </div>
                <span className="text-xs font-semibold text-accent-gold bg-accent-gold/10 border border-accent-gold/20 px-2.5 py-1 rounded-full">
                  Soma todo dia 1º
                </span>
              </div>

              <p className="text-xs sm:text-[13px] text-text-secondary leading-relaxed">
                Ideal para contas remuneradas como <strong>Wise</strong>, Caixa ou Renda Fixa. O percentual configurado será calculado e somado automaticamente à quantidade do ativo todo dia 1º.
              </p>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1.5">
                    Taxa de Rendimento (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="any"
                      value={yieldRate}
                      onChange={(e) => setYieldRate(e.target.value)}
                      placeholder="Ex: 0.35 ou 4.2"
                      className="w-full rounded-xl border border-border bg-bg-card px-3.5 py-2 text-sm sm:text-base text-text-primary placeholder:text-text-secondary/50 focus:border-accent-gold focus:outline-none pr-8 font-mono font-bold"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-bold text-text-secondary">
                      %
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-text-secondary mb-1.5">
                    Frequência da Taxa
                  </label>
                  <select
                    value={yieldFrequency}
                    onChange={(e) => setYieldFrequency(e.target.value as 'MONTHLY' | 'ANNUAL')}
                    className="w-full rounded-xl border border-border bg-bg-card px-3.5 py-2 text-sm sm:text-base text-text-primary focus:border-accent-gold focus:outline-none"
                  >
                    <option value="MONTHLY">% ao mês (a.m.)</option>
                    <option value="ANNUAL">% ao ano (a.a.)</option>
                  </select>
                </div>
              </div>

              {/* Prévia dinâmica do rendimento mensal projetado */}
              {parseFloat(yieldRate) > 0 && parseFloat(quantity) > 0 && (
                <div className="mt-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs sm:text-sm text-emerald-400 space-y-1.5 animate-fade-in">
                  <div className="flex items-center justify-between font-semibold">
                    <span>Rendimento projetado no dia 1º:</span>
                    <span className="font-mono font-bold text-emerald-300">
                      +{((parseFloat(quantity) * (yieldFrequency === 'ANNUAL' ? (parseFloat(yieldRate) / 12) / 100 : parseFloat(yieldRate) / 100))).toFixed(4)} {currency}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs opacity-85">
                    <span>Novo saldo previsto:</span>
                    <span className="font-mono">
                      {(parseFloat(quantity) + (parseFloat(quantity) * (yieldFrequency === 'ANNUAL' ? (parseFloat(yieldRate) / 12) / 100 : parseFloat(yieldRate) / 100))).toFixed(4)} {currency}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-border">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-accent-gold text-black font-semibold">
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Salvar Ativo
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
