import { useEffect, useState, useRef, useMemo } from 'react';
import { X, Loader2, Save, Search, Zap, Calendar, Wallet, TrendingUp, PlusCircle, RefreshCw, Calculator, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/services/api';
import type { AssetType, Investment } from '@/types/finance';
import rastroAssets from '@/data/assetsDatabase.json';
import { useCurrency, convertAmount, type Currency } from '@/contexts/CurrencyContext';

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

const POPULAR_CRYPTOS = [
  { ticker: 'BTC', name: 'Bitcoin', type: 'Cripto', sector: 'Criptomoedas', exchange: 'Crypto' },
  { ticker: 'ETH', name: 'Ethereum', type: 'Cripto', sector: 'Criptomoedas', exchange: 'Crypto' },
  { ticker: 'SOL', name: 'Solana', type: 'Cripto', sector: 'Criptomoedas', exchange: 'Crypto' },
  { ticker: 'ONDO', name: 'Ondo Finance', type: 'Cripto', sector: 'Criptomoedas', exchange: 'Crypto' },
  { ticker: 'BNB', name: 'BNB (Binance Coin)', type: 'Cripto', sector: 'Criptomoedas', exchange: 'Crypto' },
  { ticker: 'XRP', name: 'XRP (Ripple)', type: 'Cripto', sector: 'Criptomoedas', exchange: 'Crypto' },
  { ticker: 'LINK', name: 'Chainlink', type: 'Cripto', sector: 'Criptomoedas', exchange: 'Crypto' },
  { ticker: 'RENDER', name: 'Render', type: 'Cripto', sector: 'Criptomoedas', exchange: 'Crypto' },
  { ticker: 'VIRTUAL', name: 'Virtuals Protocol', type: 'Cripto', sector: 'Criptomoedas', exchange: 'Crypto' },
  { ticker: 'ROSE', name: 'Oasis Network', type: 'Cripto', sector: 'Criptomoedas', exchange: 'Crypto' },
  { ticker: 'SXT', name: 'Space and Time', type: 'Cripto', sector: 'Criptomoedas', exchange: 'Crypto' },
  { ticker: 'ADA', name: 'Cardano', type: 'Cripto', sector: 'Criptomoedas', exchange: 'Crypto' },
  { ticker: 'DOGE', name: 'Dogecoin', type: 'Cripto', sector: 'Criptomoedas', exchange: 'Crypto' },
  { ticker: 'AVAX', name: 'Avalanche', type: 'Cripto', sector: 'Criptomoedas', exchange: 'Crypto' },
  { ticker: 'SUI', name: 'Sui', type: 'Cripto', sector: 'Criptomoedas', exchange: 'Crypto' },
  { ticker: 'TAO', name: 'Bittensor', type: 'Cripto', sector: 'Criptomoedas', exchange: 'Crypto' },
  { ticker: 'PEPE', name: 'Pepe', type: 'Cripto', sector: 'Criptomoedas', exchange: 'Crypto' },
  { ticker: 'XLM', name: 'Stellar', type: 'Cripto', sector: 'Criptomoedas', exchange: 'Crypto' },
  { ticker: 'USDT', name: 'Tether USD', type: 'Cripto', sector: 'Stablecoin', exchange: 'Crypto' },
];

const KNOWN_CRYPTO_TICKERS = new Set(POPULAR_CRYPTOS.map((c) => c.ticker));

const ALL_SEARCHABLE_ASSETS = [
  ...POPULAR_CRYPTOS,
  ...rastroAssets.filter((a) => !KNOWN_CRYPTO_TICKERS.has(a.ticker.toUpperCase())),
];

interface Props {
  open: boolean;
  investmentToEdit?: Investment | null;
  prefillAssetForBuy?: Investment | null;
  existingInvestments?: Investment[];
  initialAssetType?: AssetType;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddInvestmentModal({
  open,
  investmentToEdit,
  prefillAssetForBuy,
  existingInvestments = [],
  initialAssetType = 'STOCK',
  onClose,
  onSuccess,
}: Props) {
  const { notify } = useToast();
  const { rates } = useCurrency();
  const [name, setName] = useState('');
  const [ticker, setTicker] = useState('');
  const [assetType, setAssetType] = useState<AssetType>(initialAssetType);
  const [institution, setInstitution] = useState(initialAssetType === 'CRYPTO' ? 'Binance' : 'XP Investimentos');
  const [quantity, setQuantity] = useState('');
  const [investedAmount, setInvestedAmount] = useState('');
  const [averagePrice, setAveragePrice] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [currency, setCurrency] = useState('BRL');
  const [yieldRate, setYieldRate] = useState('');
  const [yieldFrequency, setYieldFrequency] = useState<'MONTHLY' | 'ANNUAL'>('MONTHLY');
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().substring(0, 10));
  const [loading, setLoading] = useState(false);
  const [fetchingQuote, setFetchingQuote] = useState(false);
  const [isCaixinha, setIsCaixinha] = useState(false);

  // Quando o usuário já possui o ativo na carteira, permite escolher entre SOMAR nova compra (padrão) ou SUBSTITUIR saldo total
  const [existingPositionMode, setExistingPositionMode] = useState<'ADD' | 'REPLACE'>('ADD');

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
    new Set([...connectedBanks, 'Binance', 'XP Investimentos', 'NuInvest', 'Nubank', 'Santander', 'BTG Pactual', 'Inter', 'Wise'])
  ).slice(0, 8);

  const defaultBank = connectedBanks[0] || 'XP Investimentos';

  // Detecta se o ticker digitado já existe na carteira ativa do usuário (quando não está no modo de edição direta)
  const matchedExistingAsset = useMemo(() => {
    if (investmentToEdit || isCaixinha) return null;
    const clean = ticker.trim().toUpperCase();
    if (!clean) return null;
    return (
      existingInvestments.find(
        (inv) =>
          (inv.code_ticker || '').trim().toUpperCase() === clean &&
          inv.quantity > 0 &&
          String(inv.sync_source || '') !== 'GORILA_CLOSED' &&
          String(inv.sync_source || '') !== 'MANUAL_CLOSED',
      ) || null
    );
  }, [ticker, existingInvestments, investmentToEdit, isCaixinha]);

  // Suggestions Autocomplete
  const [suggestions, setSuggestions] = useState<typeof ALL_SEARCHABLE_ASSETS>([]);
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

  const getCurrencySymbol = (curr: string) => {
    if (curr === 'USD' || curr === 'USDT') return 'US$';
    if (curr === 'EUR') return '€';
    if (curr === 'CLP') return 'CLP$';
    return 'R$';
  };

  const toRateCurrency = (curr: string): Currency => {
    if (curr === 'USD' || curr === 'USDT') return 'USD';
    if (curr === 'EUR') return 'EUR';
    if (curr === 'CLP') return 'CLP';
    return 'BRL';
  };

  // Modo de cálculo ativo pelo usuário: 'INVESTED_AMOUNT' (usuário digitou quanto gastou) | 'PRICE' (usuário digitou a cotação)
  const [calcDriver, setCalcDriver] = useState<'INVESTED_AMOUNT' | 'PRICE'>('INVESTED_AMOUNT');

  // Troca a moeda do formulário convertendo automaticamente os preços já preenchidos para não misturar USD com R$
  const handleCurrencyChange = (newCurr: string) => {
    const oldRateCurr = toRateCurrency(currency);
    const newRateCurr = toRateCurrency(newCurr);

    if (oldRateCurr !== newRateCurr) {
      const curP = parseFloat(currentPrice);
      if (!isNaN(curP) && curP > 0) {
        const convertedCur = convertAmount(curP, oldRateCurr, newRateCurr, rates);
        setCurrentPrice(String(Number(convertedCur.toFixed(curP < 1 ? 6 : 2))));
      }
      const avgP = parseFloat(averagePrice);
      if (!isNaN(avgP) && avgP > 0) {
        const convertedAvg = convertAmount(avgP, oldRateCurr, newRateCurr, rates);
        setAveragePrice(String(Number(convertedAvg.toFixed(avgP < 1 ? 6 : 2))));
      }
      const invAmt = parseFloat(investedAmount);
      if (!isNaN(invAmt) && invAmt > 0) {
        const convertedInv = convertAmount(invAmt, oldRateCurr, newRateCurr, rates);
        setInvestedAmount(String(Number(convertedInv.toFixed(2))));
      }
    }
    setCurrency(newCurr);
  };

  // Quando o usuário altera a Quantidade:
  // Se ele já digitou o quanto investiu (ou se o valor investido estiver ativo), calcula a Cotação paga = Valor Investido / Quantidade!
  const handleQuantityChange = (val: string) => {
    setQuantity(val);
    const q = parseFloat(val);
    const invAmt = parseFloat(investedAmount);
    const price = parseFloat(averagePrice) || parseFloat(currentPrice) || 0;

    if (!isNaN(q) && q > 0) {
      if (calcDriver === 'INVESTED_AMOUNT' && !isNaN(invAmt) && invAmt > 0) {
        // Ex: R$ 613.31 e 0.00145423 BTC -> Cotação Paga = 613.31 / 0.00145423 = 421742.09 R$
        const isCryptoAsset = assetType === 'CRYPTO' || KNOWN_CRYPTO_TICKERS.has(ticker.trim().toUpperCase());
        const decimals = isCryptoAsset ? (invAmt / q < 1 ? 6 : 2) : 2;
        const calculatedPrice = Number((invAmt / q).toFixed(decimals));
        setAveragePrice(String(calculatedPrice));
      } else if (price > 0) {
        setInvestedAmount(String(Number((q * price).toFixed(2))));
      }
    } else if (!val) {
      if (calcDriver !== 'INVESTED_AMOUNT') {
        setInvestedAmount('');
      }
    }
  };

  // Quando o usuário altera o Valor Investido ("Comprei 613.31 reais hoje"):
  // Se ele já digitou a quantidade de BTC, calcula a Cotação paga = Valor Investido / Quantidade!
  // Se ainda não digitou a quantidade, calcula a Quantidade = Valor Investido / Preço Atual de mercado.
  const handleInvestedAmountChange = (val: string) => {
    setInvestedAmount(val);
    setCalcDriver('INVESTED_AMOUNT');
    const total = parseFloat(val);
    const q = parseFloat(quantity);
    const price = parseFloat(averagePrice) || parseFloat(currentPrice) || 0;

    if (!isNaN(total) && total > 0) {
      if (!isNaN(q) && q > 0) {
        // Usuário tem a quantidade e acabou de digitar ou ajustar o valor investido: calcula a cotação paga!
        const isCryptoAsset = assetType === 'CRYPTO' || KNOWN_CRYPTO_TICKERS.has(ticker.trim().toUpperCase());
        const decimals = isCryptoAsset ? (total / q < 1 ? 6 : 2) : 2;
        const calculatedPrice = Number((total / q).toFixed(decimals));
        setAveragePrice(String(calculatedPrice));
      } else if (price > 0) {
        const isCryptoAsset = assetType === 'CRYPTO' || KNOWN_CRYPTO_TICKERS.has(ticker.trim().toUpperCase());
        const decimals = isCryptoAsset ? 8 : 4;
        const calcQty = Number((total / price).toFixed(decimals));
        setQuantity(String(calcQty));
      }
    }
  };

  // Quando o usuário altera a Cotação unitária manualmente:
  const handleAveragePriceChange = (val: string) => {
    setAveragePrice(val);
    setCalcDriver('PRICE');
    const price = parseFloat(val);
    const q = parseFloat(quantity);
    const total = parseFloat(investedAmount);

    if (!isNaN(price) && price > 0) {
      if (!isNaN(q) && q > 0) {
        setInvestedAmount(String(Number((q * price).toFixed(2))));
      } else if (!isNaN(total) && total > 0) {
        const isCryptoAsset = assetType === 'CRYPTO' || KNOWN_CRYPTO_TICKERS.has(ticker.trim().toUpperCase());
        const decimals = isCryptoAsset ? 8 : 4;
        setQuantity(String(Number((total / price).toFixed(decimals))));
      }
    }
  };

  const applyQuotePrice = (rawUsdOrBrlPrice: number, isCryptoAsset: boolean, targetCurr: string) => {
    // Cotações de cripto vêm em USD da API; ações da B3 vêm em BRL
    const sourceCurr: Currency = isCryptoAsset ? 'USD' : 'BRL';
    const destCurr: Currency = toRateCurrency(targetCurr);
    const converted = convertAmount(rawUsdOrBrlPrice, sourceCurr, destCurr, rates);
    const formatted = String(Number(converted.toFixed(converted < 1 ? 6 : 2)));
    setCurrentPrice(formatted);
    setAveragePrice(formatted);

    // Se o usuário já digitou o Valor Investido ou Quantidade, sincroniza o par
    const invAmt = parseFloat(investedAmount);
    const q = parseFloat(quantity);
    if (!isNaN(invAmt) && invAmt > 0 && converted > 0 && (!q || q <= 0)) {
      const decimals = isCryptoAsset ? 8 : 4;
      setQuantity(String(Number((invAmt / converted).toFixed(decimals))));
    } else if (!isNaN(q) && q > 0 && converted > 0) {
      setInvestedAmount(String(Number((q * converted).toFixed(2))));
    }
  };

  const handleTickerChange = (val: string) => {
    const clean = val.toUpperCase();
    setTicker(clean);

    if (clean.trim().length >= 1) {
      const matches = ALL_SEARCHABLE_ASSETS.filter(
        (a) =>
          a.ticker.toUpperCase().includes(clean.trim()) ||
          a.name.toUpperCase().includes(clean.trim())
      ).slice(0, 8);
      setSuggestions(matches);
      setShowSuggestions(true);

      const exact = ALL_SEARCHABLE_ASSETS.find((a) => a.ticker.toUpperCase() === clean.trim());
      if (exact) {
        setName(exact.name);
        if (exact.type === 'FIIs' || exact.ticker.endsWith('11')) {
          setAssetType('FII');
          setCurrency('BRL');
          if (!institution || institution === 'B3' || institution === 'Binance') setInstitution(defaultBank);
        } else if (exact.type === 'Ações') {
          setAssetType('STOCK');
          setCurrency('BRL');
          if (!institution || institution === 'B3' || institution === 'Binance') setInstitution(defaultBank);
        } else if (exact.type === 'Cripto' || exact.exchange === 'Crypto' || KNOWN_CRYPTO_TICKERS.has(clean.trim())) {
          setAssetType('CRYPTO');
          setInstitution('Binance');
          setCurrency('USD');
        }
      }
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelectSuggestion = async (item: typeof ALL_SEARCHABLE_ASSETS[0]) => {
    const cleanTicker = item.ticker.toUpperCase();
    setTicker(cleanTicker);
    setName(item.name);
    setShowSuggestions(false);

    let isCryptoAsset = false;
    let nextCurr = currency;

    if (item.type === 'FIIs' || cleanTicker.endsWith('11')) {
      setAssetType('FII');
      nextCurr = 'BRL';
      setCurrency('BRL');
      if (!institution || institution === 'B3' || institution === 'Binance') setInstitution(defaultBank);
    } else if (item.type === 'Ações') {
      setAssetType('STOCK');
      nextCurr = 'BRL';
      setCurrency('BRL');
      if (!institution || institution === 'B3' || institution === 'Binance') setInstitution(defaultBank);
    } else if (item.type === 'Cripto' || item.exchange === 'Crypto' || KNOWN_CRYPTO_TICKERS.has(cleanTicker)) {
      isCryptoAsset = true;
      setAssetType('CRYPTO');
      setInstitution('Binance');
      nextCurr = 'USD';
      setCurrency('USD');
    }

    setFetchingQuote(true);
    try {
      const q = await api.getQuote(cleanTicker, 'compact');
      if (q && q.price && q.price > 0) {
        applyQuotePrice(q.price, isCryptoAsset, nextCurr);
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

    const localMatch = ALL_SEARCHABLE_ASSETS.find((a) => a.ticker.toUpperCase() === clean);
    let isCryptoAsset = assetType === 'CRYPTO' || KNOWN_CRYPTO_TICKERS.has(clean);
    let nextCurr = currency;

    if (localMatch) {
      setName(localMatch.name);
      if (localMatch.type === 'FIIs' || clean.endsWith('11')) {
        isCryptoAsset = false;
        setAssetType('FII');
        nextCurr = 'BRL';
        setCurrency('BRL');
        if (!institution || institution === 'B3' || institution === 'Binance') setInstitution(defaultBank);
      } else if (localMatch.type === 'Ações') {
        isCryptoAsset = false;
        setAssetType('STOCK');
        nextCurr = 'BRL';
        setCurrency('BRL');
        if (!institution || institution === 'B3' || institution === 'Binance') setInstitution(defaultBank);
      } else if (localMatch.type === 'Cripto' || localMatch.exchange === 'Crypto' || KNOWN_CRYPTO_TICKERS.has(clean)) {
        isCryptoAsset = true;
        setAssetType('CRYPTO');
        setInstitution('Binance');
        nextCurr = 'USD';
        setCurrency('USD');
      }
    } else if (!clean.endsWith('11') && !/[0-9]$/.test(clean)) {
      isCryptoAsset = true;
      setAssetType('CRYPTO');
      setInstitution('Binance');
      nextCurr = 'USD';
      setCurrency('USD');
    }

    setFetchingQuote(true);
    setShowSuggestions(false);
    try {
      const q = await api.getQuote(clean, 'compact');
      if (q && q.price && q.price > 0) {
        if (!name && q.name) setName(q.name);
        applyQuotePrice(q.price, isCryptoAsset, nextCurr);
      }
    } catch {
      // ignore
    } finally {
      setFetchingQuote(false);
    }
  };

  const handleTickerBlur = (e: React.FocusEvent) => {
    if (searchRef.current && searchRef.current.contains(e.relatedTarget as Node)) {
      return;
    }
    setTimeout(() => {
      setShowSuggestions(false);
    }, 150);

    const clean = ticker.trim().toUpperCase();
    if (clean.length >= 2 && (!currentPrice || currentPrice === '0' || !name)) {
      const exact = ALL_SEARCHABLE_ASSETS.find((a) => a.ticker.toUpperCase() === clean);
      if (exact) {
        handleSelectSuggestion(exact);
      } else {
        handleLookupOnline(clean);
      }
    }
  };

  // Inicializa o modal apenas quando ele abre ou quando muda o ativo em edição
  useEffect(() => {
    if (!open) return;

    if (investmentToEdit) {
      setName(investmentToEdit.name);
      setTicker(investmentToEdit.code_ticker);
      setAssetType(investmentToEdit.asset_type);
      setInstitution(investmentToEdit.institution || defaultBank);
      setQuantity(String(investmentToEdit.quantity));

      const isCaixinhaAsset =
        (investmentToEdit.code_ticker || '').toUpperCase().includes('WISE') ||
        (investmentToEdit.institution || '').toUpperCase().includes('WISE') ||
        (investmentToEdit.name || '').toUpperCase().includes('CAIXINHA') ||
        (investmentToEdit.name || '').toUpperCase().includes('WISE') ||
        (investmentToEdit.name || '').toUpperCase().includes('RESERVA');

      setIsCaixinha(isCaixinhaAsset);

      const isCrypto =
        !isCaixinhaAsset &&
        (investmentToEdit.asset_type === 'CRYPTO' ||
          (investmentToEdit.institution || '').toUpperCase().includes('BINANCE') ||
          KNOWN_CRYPTO_TICKERS.has((investmentToEdit.code_ticker || '').toUpperCase()));

      let avgP = investmentToEdit.average_price || 0;
      let curP = investmentToEdit.current_price || 0;

      if (isCrypto && investmentToEdit.currency === 'BRL' && avgP > 200000) {
        const usdRate = rates['usd'] ?? 0.1818;
        avgP = avgP * usdRate;
        curP = curP * usdRate;
      }

      setAveragePrice(isCaixinhaAsset ? '1' : String(avgP));
      setCurrentPrice(isCaixinhaAsset ? '1' : String(curP));
      setInvestedAmount(
        !isCaixinhaAsset && investmentToEdit.quantity > 0 && avgP > 0
          ? String(Number((investmentToEdit.quantity * avgP).toFixed(2)))
          : ''
      );
      setCurrency(isCrypto ? 'USD' : investmentToEdit.currency || 'BRL');
      setYieldRate(investmentToEdit.yield_rate !== undefined && investmentToEdit.yield_rate > 0 ? String(investmentToEdit.yield_rate) : '');
      setYieldFrequency(investmentToEdit.yield_frequency || 'MONTHLY');
      const initialDate = investmentToEdit.created_at
        ? investmentToEdit.created_at.substring(0, 10)
        : new Date().toISOString().substring(0, 10);
      setTransactionDate(initialDate);
      setExistingPositionMode('REPLACE');
    } else if (prefillAssetForBuy) {
      const isCrypto =
        prefillAssetForBuy.asset_type === 'CRYPTO' ||
        (prefillAssetForBuy.institution || '').toUpperCase().includes('BINANCE') ||
        KNOWN_CRYPTO_TICKERS.has((prefillAssetForBuy.code_ticker || '').toUpperCase());

      setName(prefillAssetForBuy.name);
      setTicker(prefillAssetForBuy.code_ticker);
      setAssetType(isCrypto ? 'CRYPTO' : prefillAssetForBuy.asset_type);
      setInstitution(prefillAssetForBuy.institution || (isCrypto ? 'Binance' : defaultBank));
      setQuantity('');
      setInvestedAmount('');
      const curP = prefillAssetForBuy.current_price || prefillAssetForBuy.average_price || 0;
      setCurrentPrice(curP > 0 ? String(curP) : '');
      setAveragePrice(curP > 0 ? String(curP) : '');
      setCurrency(isCrypto ? 'USD' : prefillAssetForBuy.currency || 'BRL');
      setYieldRate('');
      setYieldFrequency('MONTHLY');
      setTransactionDate(new Date().toISOString().substring(0, 10));
      setIsCaixinha(false);
      setExistingPositionMode('ADD');
    } else {
      const defaultType = initialAssetType || 'STOCK';
      setName('');
      setTicker('');
      setAssetType(defaultType);
      setInstitution(defaultType === 'CRYPTO' ? 'Binance' : defaultBank);
      setQuantity('');
      setInvestedAmount('');
      setAveragePrice('');
      setCurrentPrice('');
      setCurrency(defaultType === 'CRYPTO' ? 'USD' : 'BRL');
      setYieldRate('');
      setYieldFrequency('MONTHLY');
      setTransactionDate(new Date().toISOString().substring(0, 10));
      setIsCaixinha(false);
      setExistingPositionMode('ADD');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [investmentToEdit, prefillAssetForBuy, initialAssetType, open]);

  // Quando o usuário seleciona um ativo que já existe na carteira e muda para REPLACE, preenche com os dados atuais
  useEffect(() => {
    if (!matchedExistingAsset || investmentToEdit) return;
    if (existingPositionMode === 'REPLACE') {
      setQuantity(String(matchedExistingAsset.quantity));
      const avgP = matchedExistingAsset.average_price || matchedExistingAsset.current_price || 0;
      const curP = matchedExistingAsset.current_price || avgP;
      setAveragePrice(String(avgP));
      setCurrentPrice(String(curP));
      setInvestedAmount(String(Number((matchedExistingAsset.quantity * avgP).toFixed(2))));
    }
  }, [existingPositionMode, matchedExistingAsset, investmentToEdit]);

  if (!open) return null;

  // Cálculo de prévia quando está somando a uma posição existente (ex: já tem BTC e comprou mais hoje)
  const isCrypto = assetType === 'CRYPTO' || KNOWN_CRYPTO_TICKERS.has(ticker.trim().toUpperCase());
  const parsedQty = parseFloat(quantity) || 0;
  const parsedBuyPrice = parseFloat(averagePrice) || parseFloat(currentPrice) || 0;
  const parsedCurPrice = parseFloat(currentPrice) || parsedBuyPrice;

  // Para cripto, converte para USD para cálculo da carteira se o usuário escolheu digitar em BRL/EUR
  const buyPriceInNative = isCrypto && currency !== 'USD' && currency !== 'USDT'
    ? convertAmount(parsedBuyPrice, toRateCurrency(currency), 'USD', rates)
    : parsedBuyPrice;
  const curPriceInNative = isCrypto && currency !== 'USD' && currency !== 'USDT'
    ? convertAmount(parsedCurPrice, toRateCurrency(currency), 'USD', rates)
    : parsedCurPrice;

  const existingQty = matchedExistingAsset ? Number(matchedExistingAsset.quantity) || 0 : 0;
  const existingAvg = matchedExistingAsset ? Number(matchedExistingAsset.average_price) || Number(matchedExistingAsset.current_price) || 0 : 0;
  const previewNewTotalQty = Number((existingQty + parsedQty).toFixed(8));
  const previewNewAvgPrice =
    previewNewTotalQty > 0 && parsedQty > 0
      ? Number((((existingQty * existingAvg) + (parsedQty * buyPriceInNative)) / previewNewTotalQty).toFixed(isCrypto ? 2 : 4))
      : existingAvg;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isCaixinha) {
      if (!name.trim()) {
        notify('O nome da caixinha é obrigatório.', 'error');
        return;
      }
      const qty = parseFloat(quantity);
      if (isNaN(qty) || qty <= 0) {
        notify('Informe um saldo válido para a caixinha.', 'error');
        return;
      }

      let autoTicker = ticker.trim().toUpperCase();
      if (!autoTicker) {
        const instUpper = institution.toUpperCase();
        if (instUpper.includes('WISE')) {
          autoTicker = currency === 'EUR' ? 'WISE_EUR' : currency === 'CLP' ? 'WISE_CLP' : 'WISE_USD';
        } else {
          autoTicker = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 15) || `CAIXINHA_${currency}`;
        }
      }

      const parsedYield = yieldRate.trim() ? parseFloat(yieldRate.replace(',', '.')) : 0;
      setLoading(true);
      try {
        if (investmentToEdit?.id) {
          const srcPrefix = (investmentToEdit.sync_source || 'MANUAL').split('#')[0];
          await api.updateInvestment(investmentToEdit.id, {
            name: name.trim(),
            code_ticker: autoTicker,
            asset_type: 'FIXED_INCOME',
            institution: institution.trim() || 'Wise',
            quantity: qty,
            average_price: 1,
            current_price: 1,
            currency,
            sync_source: `${srcPrefix}#1#1` as any,
            yield_rate: parsedYield,
            yield_frequency: yieldFrequency,
            date: transactionDate,
          });
          notify('Caixinha atualizada com sucesso!', 'success');
        } else {
          await api.createInvestment({
            name: name.trim(),
            code_ticker: autoTicker,
            asset_type: 'FIXED_INCOME',
            institution: institution.trim() || 'Wise',
            quantity: qty,
            average_price: 1,
            current_price: 1,
            currency,
            yield_rate: parsedYield,
            yield_frequency: yieldFrequency,
            date: transactionDate,
          });
          notify('Caixinha cadastrada com sucesso!', 'success');
        }
        onSuccess();
        onClose();
      } catch (err) {
        notify(err instanceof Error ? err.message : 'Falha ao salvar caixinha.', 'error');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!name.trim() || !ticker.trim()) {
      notify('Nome e Ticker são obrigatórios.', 'error');
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      notify('Informe uma quantidade maior que zero (ou preencha o Valor Investido).', 'error');
      return;
    }

    const isYieldEligible = isCaixinha;
    const parsedYield = (isYieldEligible && yieldRate.trim()) ? parseFloat(yieldRate.replace(',', '.')) : 0;

    // Para Criptomoedas, salva sempre na moeda padrão USD na carteira (convertendo automaticamente se o usuário digitou em R$ ou €)
    const finalCurrency = isCrypto ? 'USD' : currency;
    const finalAvgPrice = isCrypto ? Number(buyPriceInNative.toFixed(6)) : (parseFloat(averagePrice) || 0);
    const finalCurPrice = isCrypto ? Number(curPriceInNative.toFixed(6)) : (parseFloat(currentPrice) || finalAvgPrice || 0);

    setLoading(true);
    try {
      const targetEditAsset = investmentToEdit || (matchedExistingAsset && existingPositionMode === 'REPLACE' ? matchedExistingAsset : null);

      if (targetEditAsset?.id) {
        const srcPrefix = (targetEditAsset.sync_source || 'MANUAL').split('#')[0];
        const updatedSyncSource = `${srcPrefix}#${finalAvgPrice}#${finalCurPrice}`;

        await api.updateInvestment(targetEditAsset.id, {
          name: name.trim(),
          code_ticker: ticker.trim().toUpperCase(),
          asset_type: assetType,
          institution: institution.trim() || 'Manual',
          quantity: qty,
          average_price: finalAvgPrice,
          current_price: finalCurPrice,
          currency: finalCurrency,
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
          average_price: finalAvgPrice,
          current_price: finalCurPrice,
          currency: finalCurrency,
          yield_rate: parsedYield,
          yield_frequency: yieldFrequency,
          date: transactionDate,
        });
        if (matchedExistingAsset) {
          notify(
            `Compra de +${qty} ${ticker.trim().toUpperCase()} somada à sua carteira! Novo saldo: ${previewNewTotalQty} ${ticker.trim().toUpperCase()}`,
            'success',
          );
        } else {
          notify('Novo investimento cadastrado com sucesso!', 'success');
        }
      }

      onSuccess();
      onClose();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Falha ao salvar investimento.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const currSym = getCurrencySymbol(currency);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-3 sm:p-4 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-bg-card p-5 sm:p-6 shadow-2xl my-auto max-h-[94vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-border pb-3.5">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-text-primary">
              {investmentToEdit
                ? (isCaixinha ? 'Editar Caixinha / Reserva' : `Editar ${investmentToEdit.code_ticker}`)
                : matchedExistingAsset && existingPositionMode === 'ADD'
                ? `Nova Compra de ${matchedExistingAsset.code_ticker}`
                : (isCaixinha ? 'Nova Caixinha / Reserva' : 'Novo Lançamento de Investimento')}
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">
              {isCaixinha
                ? 'Contas remuneradas, saldo direto e caixinhas (Wise, Nubank, etc.)'
                : 'Digite quanto investiu ou a quantidade comprada — o cálculo é automático'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-secondary hover:bg-bg-elevated hover:text-text-primary transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Alternador de Modo: Investimento vs Caixinha */}
          <div className="flex rounded-xl p-1 bg-bg-primary border border-border">
            <button
              type="button"
              onClick={() => {
                setIsCaixinha(false);
                setYieldRate('');
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                !isCaixinha
                  ? 'bg-bg-card text-text-primary shadow-xs border border-border/80 font-bold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
              <span>Ações / Cripto / FII</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCaixinha(true);
                setAssetType('FIXED_INCOME');
                if (!name) setName('Wise Dólar (USD)');
                if (!institution || institution === 'XP Investimentos') setInstitution('Wise');
                if (!currency || currency === 'BRL') setCurrency('USD');
                setAveragePrice('1');
                setCurrentPrice('1');
              }}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                isCaixinha
                  ? 'bg-emerald-500/15 text-emerald-400 shadow-xs border border-emerald-500/30 font-bold'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Wallet className="h-3.5 w-3.5 text-emerald-500" />
              <span>Caixinha / Reserva (Wise)</span>
            </button>
          </div>

          {isCaixinha ? (
            /* ======================================================== */
            /* MODO CAIXINHA / RESERVA (WISE, NUBANK, ETC.)             */
            /* ======================================================== */
            <div className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-sm font-semibold text-text-primary mb-1.5">
                  Nome da Caixinha / Reserva *
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Wise Dólar (USD), Caixinha Nubank, Reserva Euro"
                  className="w-full rounded-xl border border-border bg-bg-primary px-3.5 py-2.5 text-sm sm:text-base text-text-primary placeholder:text-text-secondary/50 focus:border-accent-gold focus:outline-none"
                />
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {[
                    { label: '🇺🇸 Wise Dólar (USD)', name: 'Wise Dólar (USD)', inst: 'Wise', curr: 'USD', ticker: 'WISE_USD' },
                    { label: '🇪🇺 Wise Euro (EUR)', name: 'Wise Euro (EUR)', inst: 'Wise', curr: 'EUR', ticker: 'WISE_EUR' },
                    { label: '🇧🇷 Caixinha Nubank (R$)', name: 'Caixinha Nubank', inst: 'Nubank', curr: 'BRL', ticker: 'CAIXINHA_NUBANK' },
                  ].map((preset) => (
                    <button
                      key={preset.ticker}
                      type="button"
                      onClick={() => {
                        setName(preset.name);
                        setInstitution(preset.inst);
                        setCurrency(preset.curr);
                        setTicker(preset.ticker);
                      }}
                      className="px-2.5 py-1 text-xs rounded-lg border border-border/70 bg-bg-elevated/50 text-text-secondary hover:text-text-primary hover:border-emerald-500/40 transition-all"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1.5">
                    Instituição / Banco *
                  </label>
                  <input
                    type="text"
                    list="institution-options"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="Ex: Wise, Nubank"
                    className="w-full rounded-xl border border-border bg-bg-primary px-3.5 py-2.5 text-sm sm:text-base text-text-primary focus:border-accent-gold focus:outline-none"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {['Wise', 'Nubank', 'Inter', 'Santander', 'BTG Pactual', 'Nomad'].map((inst) => (
                      <button
                        key={inst}
                        type="button"
                        onClick={() => setInstitution(inst)}
                        className={`px-2 py-0.5 text-xs rounded-md border transition-all ${
                          institution === inst
                            ? 'border-emerald-500 bg-emerald-500/20 text-emerald-300 font-bold'
                            : 'border-border/60 bg-bg-elevated/40 text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {inst}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1.5">
                    Moeda do Saldo *
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full rounded-xl border border-border bg-bg-primary px-3.5 py-2.5 text-sm sm:text-base text-text-primary focus:border-accent-gold focus:outline-none font-semibold"
                  >
                    <option value="USD">🇺🇸 Dólar (USD - $)</option>
                    <option value="EUR">🇪🇺 Euro (EUR - €)</option>
                    <option value="BRL">🇧🇷 Real (BRL - R$)</option>
                    <option value="CLP">🇨🇱 Peso Chileno (CLP)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1.5">
                    Saldo Atual na Conta ({currSym}) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    placeholder="Ex: 1250.00"
                    className="w-full rounded-xl border border-emerald-500/40 bg-bg-primary px-3.5 py-2.5 text-base font-mono font-bold text-emerald-400 placeholder:text-text-secondary/40 focus:border-emerald-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1.5 flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-emerald-400" />
                    <span>Data do Aporte *</span>
                  </label>
                  <input
                    type="date"
                    value={transactionDate}
                    onChange={(e) => setTransactionDate(e.target.value)}
                    className="w-full rounded-xl border border-border bg-bg-primary px-3 py-2.5 text-sm sm:text-base font-medium text-text-primary focus:border-accent-gold focus:outline-none cursor-pointer"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* ======================================================== */
            /* MODO PADRÃO: AÇÕES, FIIs, CRIPTOMOEDAS E RENDA FIXA      */
            /* ======================================================== */
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-2 gap-3">
                <div className="relative" ref={searchRef}>
                  <label className="block text-sm font-semibold text-text-primary mb-1.5">
                    Ticker / Código *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={ticker}
                      onChange={(e) => handleTickerChange(e.target.value)}
                      onFocus={() => {
                        if (suggestions.length > 0) setShowSuggestions(true);
                      }}
                      onBlur={handleTickerBlur}
                      placeholder="Ex: BTC, ETH, PETR4"
                      className="w-full rounded-xl border border-border bg-bg-primary px-3.5 py-2.5 pr-9 text-sm sm:text-base font-mono font-bold text-text-primary uppercase placeholder:text-text-secondary/50 placeholder:font-sans placeholder:font-normal focus:border-accent-gold focus:outline-none"
                    />
                    {fetchingQuote && (
                      <Loader2 className="h-4 w-4 animate-spin text-accent-gold absolute right-3 top-1/2 -translate-y-1/2" />
                    )}
                  </div>

                  {showSuggestions && (suggestions.length > 0 || ticker.trim().length >= 2) && (
                    <div
                      onMouseDown={(e) => e.preventDefault()}
                      className="absolute left-0 right-0 mt-1 max-h-56 overflow-y-auto rounded-xl border border-border bg-bg-card p-1.5 shadow-2xl z-50 animate-fade-in space-y-1"
                    >
                      <div className="px-3 py-1 text-xs font-bold text-text-secondary uppercase tracking-wider flex items-center gap-1 border-b border-border/50 pb-1">
                        <Search className="h-3.5 w-3.5 text-accent-gold" />
                        <span>Ativos Cadastrados</span>
                      </div>
                      {suggestions.map((item) => (
                        <button
                          key={item.ticker}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleSelectSuggestion(item);
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            handleSelectSuggestion(item);
                          }}
                          className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs sm:text-sm text-left hover:bg-bg-elevated transition-colors group cursor-pointer"
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
                          onClick={(e) => {
                            e.preventDefault();
                            handleLookupOnline(ticker);
                          }}
                          className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs sm:text-sm text-left text-accent-gold hover:bg-bg-elevated transition-colors border-t border-border/50 font-medium cursor-pointer"
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
                        setInstitution('Binance');
                        handleCurrencyChange('USD');
                      } else if (currency === 'USD' && val !== 'OTHER') {
                        handleCurrencyChange('BRL');
                      }
                    }}
                    className="w-full rounded-xl border border-border bg-bg-primary px-3.5 py-2.5 text-sm sm:text-base text-text-primary focus:border-accent-gold focus:outline-none"
                  >
                    <option value="CRYPTO">Criptomoeda</option>
                    <option value="STOCK">Ação Brasil (B3)</option>
                    <option value="FII">Fundo Imobiliário (FII)</option>
                    <option value="FIXED_INCOME">Renda Fixa (Tesouro/CDB)</option>
                    <option value="OTHER">Outros / Internacional</option>
                  </select>
                </div>
              </div>

              {/* Banner inteligente quando o usuário JÁ TEM este ativo na carteira (ex: BTC) */}
              {matchedExistingAsset && !investmentToEdit && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 space-y-2.5 animate-fade-in">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <PlusCircle className="h-4 w-4 text-amber-400 shrink-0" />
                      <span className="text-xs sm:text-sm font-bold text-amber-300">
                        Você já possui {matchedExistingAsset.quantity} {matchedExistingAsset.code_ticker} na carteira
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-amber-200/80 bg-black/30 px-2 py-0.5 rounded-md">
                      PM: {isCrypto ? 'US$' : 'R$'}{' '}
                      {Number(matchedExistingAsset.average_price || 0).toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5 bg-black/30 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setExistingPositionMode('ADD');
                        setQuantity('');
                        setInvestedAmount('');
                      }}
                      className={`py-1.5 px-2.5 rounded-md text-xs font-semibold transition-all ${
                        existingPositionMode === 'ADD'
                          ? 'bg-accent-gold text-black font-bold shadow-xs'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      ➕ Somar compra de hoje
                    </button>
                    <button
                      type="button"
                      onClick={() => setExistingPositionMode('REPLACE')}
                      className={`py-1.5 px-2.5 rounded-md text-xs font-semibold transition-all ${
                        existingPositionMode === 'REPLACE'
                          ? 'bg-bg-card text-text-primary font-bold border border-border'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      ✏️ Substituir saldo total
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1.5">
                    Nome do Ativo *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Bitcoin, Petrobras PN"
                    className="w-full rounded-xl border border-border bg-bg-primary px-3.5 py-2.5 text-sm sm:text-base text-text-primary placeholder:text-text-secondary/50 focus:border-accent-gold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-accent-gold" />
                      Data da Compra *
                    </span>
                  </label>
                  <input
                    type="date"
                    value={transactionDate}
                    onChange={(e) => setTransactionDate(e.target.value)}
                    className="w-full rounded-xl border border-border bg-bg-primary px-3 py-2 text-sm sm:text-base font-medium text-text-primary focus:border-accent-gold focus:outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1.5 flex items-center justify-between">
                    <span>Banco / Corretora *</span>
                    <span className="text-xs text-text-secondary font-normal">Onde comprou</span>
                  </label>
                  <input
                    type="text"
                    list="institution-options"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="Selecione ou digite o banco"
                    className="w-full rounded-xl border border-border bg-bg-primary px-3.5 py-2 text-sm sm:text-base text-text-primary placeholder:text-text-secondary/50 focus:border-accent-gold focus:outline-none"
                  />
                  <datalist id="institution-options">
                    {allInstitutionOptions.map((inst) => (
                      <option key={inst} value={inst} />
                    ))}
                  </datalist>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {topQuickInstitutions.slice(0, 6).map((inst) => (
                      <button
                        key={inst}
                        type="button"
                        onClick={() => setInstitution(inst)}
                        className={`px-2 py-0.5 text-[11px] rounded-md border transition-all ${
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

                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1.5 flex items-center justify-between">
                    <span>Moeda dos Valores</span>
                    {isCrypto && (
                      <span className="text-[11px] text-amber-400 font-medium">
                        Cotação Cripto em US$
                      </span>
                    )}
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => handleCurrencyChange(e.target.value)}
                    className="w-full rounded-xl border border-border bg-bg-primary px-3.5 py-2 text-sm sm:text-base font-semibold text-text-primary focus:border-accent-gold focus:outline-none"
                  >
                    <option value="USD">🇺🇸 USD (US$ Dólar)</option>
                    <option value="BRL">🇧🇷 BRL (R$ Real)</option>
                    <option value="EUR">🇪🇺 EUR (€ Euro)</option>
                    <option value="USDT">🪙 USDT (Tether)</option>
                    <option value="CLP">🇨🇱 CLP ($ Peso Chileno)</option>
                  </select>
                  <p className="text-[11px] text-text-secondary mt-1 leading-tight">
                    {isCrypto
                      ? 'Se você comprou em Reais (R$) ou Euros (€), troque a moeda acima e os preços convertem sozinhos.'
                      : 'Moeda em que você realizou a compra.'}
                  </p>
                </div>
              </div>

              {/* ================================================================= */}
              {/* CALCULADORA DE COMPRA: VALOR INVESTIDO <-> QUANTIDADE + COTAÇÃO    */}
              {/* ================================================================= */}
              <div className="rounded-xl border border-border bg-bg-primary/60 p-3.5 space-y-3">
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-text-primary uppercase tracking-wider">
                    <Calculator className="h-3.5 w-3.5 text-accent-gold" />
                    <span>
                      {matchedExistingAsset && existingPositionMode === 'ADD'
                        ? 'Dados da Compra de Hoje'
                        : 'Quantidade e Preço'}
                    </span>
                  </div>
                  <span className="text-[11px] text-text-secondary">
                    Preencha o <strong>Valor</strong> ou a <strong>Quantidade</strong>
                  </span>
                </div>

                {/* Linha 1: Quanto investiu hoje <-> Quantidade comprada (2 colunas amplas!) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-text-primary mb-1">
                      {matchedExistingAsset && existingPositionMode === 'ADD'
                        ? `Quanto você investiu hoje? (${currSym})`
                        : `Valor Total Investido (${currSym})`}
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-accent-gold">
                        {currSym}
                      </span>
                      <input
                        type="number"
                        step="any"
                        value={investedAmount}
                        onChange={(e) => handleInvestedAmountChange(e.target.value)}
                        placeholder="Ex: 100.00 ou 500.00"
                        className="w-full rounded-xl border border-accent-gold/40 bg-bg-card pl-10 pr-3 py-2.5 text-sm sm:text-base font-mono font-bold text-accent-gold placeholder:text-text-secondary/40 placeholder:font-sans placeholder:font-normal focus:border-accent-gold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                    </div>
                    <span className="block text-[11px] text-text-secondary mt-1">
                      Calcula a quantidade de {ticker || 'ativo'} sozinho
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-text-primary mb-1">
                      Quantidade {ticker ? `de ${ticker}` : ''} *
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={quantity}
                      onChange={(e) => handleQuantityChange(e.target.value)}
                      placeholder={isCrypto ? 'Ex: 0.00145423' : 'Ex: 100'}
                      className="w-full rounded-xl border border-border bg-bg-card px-3.5 py-2.5 text-sm sm:text-base font-mono font-bold text-text-primary placeholder:text-text-secondary/40 placeholder:font-sans placeholder:font-normal focus:border-accent-gold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <span className="block text-[11px] text-text-secondary mt-1">
                      {isCrypto ? 'Suporta até 8 casas decimais (ex: 0.00145423)' : 'Quantidade de cotas/ações'}
                    </span>
                  </div>
                </div>

                {/* Linha 2: Preço de Compra unitário & Cotação Atual de Mercado */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-text-primary mb-1">
                      {matchedExistingAsset && existingPositionMode === 'ADD'
                        ? `Cotação paga no ${ticker || 'Ativo'} (${currSym})`
                        : `Preço Médio de Compra (${currSym})`}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={averagePrice}
                      onChange={(e) => handleAveragePriceChange(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-border bg-bg-card px-3.5 py-2 text-sm sm:text-base font-mono font-medium text-text-primary placeholder:text-text-secondary/50 focus:border-accent-gold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-text-primary mb-1 flex items-center justify-between">
                      <span>Cotação Atual ({currSym})</span>
                      {ticker && (
                        <button
                          type="button"
                          onClick={() => handleLookupOnline(ticker)}
                          className="inline-flex items-center gap-1 text-[11px] text-accent-gold hover:underline font-medium"
                          title="Atualizar cotação online"
                        >
                          <RefreshCw className={`h-3 w-3 ${fetchingQuote ? 'animate-spin' : ''}`} />
                          <span>Atualizar</span>
                        </button>
                      )}
                    </label>
                    <input
                      type="number"
                      step="any"
                      value={currentPrice}
                      onChange={(e) => setCurrentPrice(e.target.value)}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-border bg-bg-card px-3.5 py-2 text-sm sm:text-base font-mono font-medium text-text-secondary placeholder:text-text-secondary/50 focus:border-accent-gold focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>

                {/* Resumo visual da operação quando for somar à posição existente */}
                {matchedExistingAsset && existingPositionMode === 'ADD' && parsedQty > 0 && (
                  <div className="mt-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs space-y-1.5 animate-fade-in">
                    <div className="font-bold text-emerald-300 flex items-center justify-between">
                      <span>Resumo após salvar sua compra:</span>
                      <span className="font-mono text-emerald-400">
                        +{parsedQty} {ticker}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-text-secondary">
                      <span>Quantidade Total de {ticker}:</span>
                      <span className="font-mono font-bold text-text-primary flex items-center gap-1.5">
                        <span>{existingQty}</span>
                        <ArrowRight className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-400">{previewNewTotalQty} {ticker}</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-text-secondary">
                      <span>Novo Preço Médio (US$):</span>
                      <span className="font-mono font-bold text-text-primary flex items-center gap-1.5">
                        <span>${existingAvg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        <ArrowRight className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-400">
                          ${previewNewAvgPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Seção de Taxa de Rendimento Automático (exclusiva para Caixinha / Reserva remunerada) */}
          {isCaixinha && (
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
                  {matchedExistingAsset && existingPositionMode === 'ADD'
                    ? `Somar Compra de ${ticker}`
                    : 'Salvar Ativo'}
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
