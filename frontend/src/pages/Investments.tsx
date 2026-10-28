import { useEffect, useState, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  TrendingUp,
  Coins,
  Building2,
  RefreshCw,
  Plus,
  FileSpreadsheet,
  Search,
  Loader2,
  Edit2,
  Trash2,
  History,
  Landmark,
  Layers,
  ChevronDown,
  Zap,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  Calendar,
  Wallet,
  Receipt,
  BarChart3,
  GripVertical,
  MoreHorizontal,
  HelpCircle,
  Clock,
  ArrowUpDown,
  Sun,
  Moon,
  Save,
  Pencil,
  X,
} from 'lucide-react';
import { AssetLogo } from '@/components/investments/AssetLogo';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/services/api';
import { formatPercent } from '@/lib/format';
import { useCurrency, type Currency, convertAmount } from '@/contexts/CurrencyContext';
import { usePluggyConnect } from '@/hooks/usePluggy';
import type { AssetType, DividendsSummary, Investment, InvestmentSummary, InvestmentTrade, RealizedOperation } from '@/types/finance';
import { ImportB3Modal } from '@/components/investments/ImportB3Modal';
import { AddInvestmentModal } from '@/components/investments/AddInvestmentModal';
import { BinanceHistoryModal } from '@/components/investments/BinanceHistoryModal';
import { SellInvestmentModal } from '@/components/investments/SellInvestmentModal';
import { EditTradeModal } from '@/components/investments/EditTradeModal';
import { ImportarExtrato } from './Carteira/ImportarExtrato';
import { UnifiedWatchlist } from '@/components/investments/UnifiedWatchlist';

type ActiveTab = 'WATCHLIST' | 'OVERVIEW' | 'STOCK' | 'FII' | 'FIXED_INCOME' | 'CRYPTO' | 'TRADES' | 'DIVIDENDS' | 'REALIZED_HISTORY' | 'IMPORT_B3';

type RealizedFilter = 'ALL' | 'WIN' | 'LOSS';
type TradeTypeFilter = 'BUY' | 'SELL' | 'SWAP' | 'DEPOSIT' | 'EARN_SUB' | 'EARN_REDEEM' | 'EARN_INTEREST' | 'AIRDROP';

const CURRENCIES: { code: Currency; label: string; flag: string }[] = [
  { code: 'BRL', label: 'BRL', flag: '🇧🇷' },
  { code: 'USD', label: 'USD', flag: '🇺🇸' },
  { code: 'EUR', label: 'EUR', flag: '🇪🇺' },
  { code: 'CLP', label: 'CLP', flag: '🇨🇱' },
];

const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  CRYPTO: 'Criptomoedas',
  STOCK: 'Ações',
  FII: 'FIIs',
  FIXED_INCOME: 'Renda Fixa',
  OTHER: 'Outros / Internacional',
};

const ASSET_TYPE_COLORS: Record<AssetType, string> = {
  CRYPTO: '#0EA5E9',
  STOCK: '#2563EB',
  FII: '#8B5CF6',
  FIXED_INCOME: '#14B8A6',
  OTHER: '#64748B',
};

export const DISPLAY_CATEGORY_LABELS: Record<string, string> = {
  STOCK: 'Ações',
  FII: 'Fundos Imobiliários',
  CRYPTO: 'Criptomoedas',
  TREASURY: 'Tesouro Direto',
  FIXED_INCOME: 'Renda Fixa / Caixinhas',
  ETF: 'ETFs',
  OTHER: 'Outros / Internacional',
};

export const CATEGORY_DISPLAY_ORDER = ['STOCK', 'FII', 'CRYPTO', 'TREASURY', 'FIXED_INCOME', 'ETF', 'OTHER'];

export const getAssetCategoryKey = (inv: Investment): string => {
  const isCrypto =
    inv.asset_type === 'CRYPTO' ||
    inv.institution === 'Binance' ||
    ['BTC', 'ETH', 'SOL', 'ONDO', 'SXT', 'LINK', 'RENDER', 'ROSE', 'VIRTUAL', 'XRP', 'ADA', 'DOGE', 'PEPE', 'TAO', 'XLM', 'BNB', 'AVAX'].includes(inv.code_ticker?.toUpperCase() || '');
  if (isCrypto) return 'CRYPTO';

  if (inv.asset_type === 'STOCK') return 'STOCK';
  if (inv.asset_type === 'FII') return 'FII';

  const cleanName = (inv.name || '').toUpperCase();
  const cleanTicker = (inv.code_ticker || '').toUpperCase();

  // Caixinhas e Contas remuneradas (Wise, etc.) agrupadas em FIXED_INCOME / Caixinhas
  if (
    cleanTicker.includes('WISE') ||
    cleanName.includes('WISE') ||
    cleanName.includes('CAIXINHA') ||
    cleanTicker.includes('CAIXINHA')
  ) {
    return 'FIXED_INCOME';
  }

  // Tesouro Direto
  if (
    cleanTicker.includes('RENDA+') ||
    cleanName.includes('RENDA+') ||
    cleanTicker.includes('TESOURO') ||
    cleanName.includes('TESOURO') ||
    cleanTicker.includes('NTNB') ||
    cleanName.includes('NTNB') ||
    cleanTicker.includes('LTN') ||
    cleanName.includes('LTN') ||
    cleanTicker.includes('LFT') ||
    cleanName.includes('LFT')
  ) {
    return 'TREASURY';
  }

  if (cleanTicker.endsWith('11') && !cleanName.includes('FUNDO') && !cleanName.includes('FII') && (inv.asset_type as string) === 'ETF') {
    return 'ETF';
  }

  if (inv.asset_type === 'FIXED_INCOME') return 'FIXED_INCOME';

  return inv.asset_type || 'OTHER';
};

const renderCategoryBadge = (categoryKey: string, isDark: boolean) => {
  const containerClasses = `flex h-7 w-7 items-center justify-center rounded-lg border shrink-0 shadow-xs ${
    isDark ? 'border-slate-700 bg-slate-800 text-slate-300' : 'border-slate-200 bg-slate-50 text-slate-700'
  }`;

  switch (categoryKey) {
    case 'TREASURY':
      return (
        <span className={containerClasses}>
          <Landmark className="h-4 w-4 text-emerald-500" />
        </span>
      );
    case 'STOCK':
      return (
        <span className={containerClasses}>
          <TrendingUp className="h-4 w-4 text-blue-500" />
        </span>
      );
    case 'FII':
      return (
        <span className={containerClasses}>
          <Building2 className="h-4 w-4 text-purple-500" />
        </span>
      );
    case 'CRYPTO':
      return (
        <span className={containerClasses}>
          <Coins className="h-4 w-4 text-amber-500" />
        </span>
      );
    case 'ETF':
      return (
        <span className={containerClasses}>
          <Wallet className="h-4 w-4 text-indigo-500" />
        </span>
      );
    case 'FIXED_INCOME':
      return (
        <span className={containerClasses}>
          <Receipt className="h-4 w-4 text-teal-500" />
        </span>
      );
    default:
      return (
        <span className={containerClasses}>
          <Layers className="h-4 w-4 text-slate-400" />
        </span>
      );
  }
};

export function Investments() {
  const { notify } = useToast();
  const { currency, setCurrency, fmt, rates } = useCurrency();
  const { openConnect, connecting: connectingPluggy } = usePluggyConnect();

  // Tema Dark / Light
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('investor10_theme') as 'light' | 'dark') || 'light';
  });

  useEffect(() => {
    const handleThemeChange = () => {
      setTheme((localStorage.getItem('investor10_theme') as 'light' | 'dark') || 'light');
    };
    window.addEventListener('theme-changed', handleThemeChange);
    return () => window.removeEventListener('theme-changed', handleThemeChange);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('investor10_theme', next);
    window.dispatchEvent(new Event('theme-changed'));
  };

  const isDark = theme === 'dark';

  /**
   * Identifica a moeda nativa / padrão de cada ativo:
   * - Criptos / Binance / USD -> Sempre em Dólar ($)
   * - Ações / FIIs / B3 / Brasil -> Sempre em Reais (R$)
   * - Wise EUR -> Sempre em Euro (€)
   * - Wise CLP -> Sempre em Peso Chileno ($)
   */
  const getNativeCurrency = (inv: Partial<Investment>): Currency => {
    const inst = (inv.institution || '').toUpperCase();
    const name = (inv.name || '').toUpperCase();
    const ticker = (inv.code_ticker || '').toUpperCase();

    // Moeda explícita da caixinha/ativo ou nome
    if (inv.currency === 'USD' || inv.currency === 'USDT' || ticker.includes('WISE_USD') || name.includes('WISE DÓLAR') || name.includes('WISE DOLAR')) return 'USD';
    if (inv.currency === 'EUR' || ticker.includes('WISE_EUR') || name.includes('WISE EURO')) return 'EUR';
    if (inv.currency === 'CLP' || ticker.includes('WISE_CLP')) return 'CLP';

    const isCrypto =
      inv.asset_type === 'CRYPTO' ||
      inst.includes('BINANCE') ||
      ['BTC', 'ETH', 'SOL', 'ONDO', 'SXT', 'LINK', 'RENDER', 'ROSE', 'VIRTUAL', 'XRP', 'ADA', 'DOGE', 'PEPE', 'TAO', 'XLM', 'BNB', 'AVAX'].includes(ticker);

    if (isCrypto) return 'USD';
    return 'BRL';
  };

  /**
   * Formata os valores respeitando a moeda selecionada para a tabela,
   * mantendo SEMPRE fixo por defeito a moeda nativa de cada ativo:
   */
  const formatAssetValue = (
    val: number,
    inv: Partial<Investment>,
    isUnitPrice: boolean = false,
    overrideCurrency?: Currency | 'AUTO',
  ) => {
    if (val === undefined || val === null || isNaN(val)) return '$0.00';

    const nativeCurrency = getNativeCurrency(inv);
    const targetCurrency: Currency =
      overrideCurrency && overrideCurrency !== 'AUTO' ? overrideCurrency : nativeCurrency;

    // Converte o valor da moeda nativa para a moeda alvo se necessário
    const convertedVal = convertAmount(val, nativeCurrency, targetCurrency, rates);

    const localeMap: Record<Currency, string> = {
      BRL: 'pt-BR',
      USD: 'en-US',
      EUR: 'pt-PT',
      CLP: 'es-CL',
    };

    let minDecimals = 2;
    let maxDecimals = 2;

    const isCrypto = nativeCurrency === 'USD' || inv.asset_type === 'CRYPTO';

    if (isCrypto && isUnitPrice) {
      if (convertedVal < 0.001) {
        minDecimals = 2;
        maxDecimals = 8;
      } else if (convertedVal < 0.1) {
        minDecimals = 2;
        maxDecimals = 6;
      } else if (convertedVal < 1.0) {
        minDecimals = 2;
        maxDecimals = 4;
      } else if (convertedVal >= 100) {
        minDecimals = 2;
        maxDecimals = 2;
      } else {
        minDecimals = 2;
        maxDecimals = 4;
      }
    }

    return new Intl.NumberFormat(localeMap[targetCurrency], {
      style: 'currency',
      currency: targetCurrency,
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: maxDecimals,
    }).format(convertedVal);
  };

  const [investments, setInvestments] = useState<Investment[]>([]);
  const [summary, setSummary] = useState<InvestmentSummary | null>(null);
  const [dividendsData, setDividendsData] = useState<DividendsSummary | null>(null);
  const [tradesData, setTradesData] = useState<InvestmentTrade[]>([]);
  const [realizedOperations, setRealizedOperations] = useState<RealizedOperation[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingBinance, setSyncingBinance] = useState(false);
  const [syncingB3, setSyncingB3] = useState(false);
  const [syncingDividends, setSyncingDividends] = useState(false);
  const [syncingQuotes, setSyncingQuotes] = useState(false);
  const [recompilingTrades, setRecompilingTrades] = useState(false);

  // Navegação por URL query param (?tab=OVERVIEW etc.)
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = (searchParams.get('tab') as ActiveTab) || 'OVERVIEW';

  // Moeda de visualização individual por tabela/classe de ativo (defeito = AUTO / Fixo nativo)
  const [categoryCurrencies, setCategoryCurrencies] = useState<Record<string, Currency | 'AUTO'>>(() => {
    try {
      const saved = localStorage.getItem('investments_category_currencies');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const updateCategoryCurrency = (type: string, curr: Currency | 'AUTO') => {
    setCategoryCurrencies(prev => {
      const next = { ...prev, [type]: curr };
      try {
        localStorage.setItem('investments_category_currencies', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Controle de accordion de classes de ativos estilo Investidor 10
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});
  const toggleCategory = (type: string) => {
    setCollapsedCategories(prev => ({ ...prev, [type]: !prev[type] }));
  };

  // Menu de opções de cada linha (...)
  const [openOptionMenuId, setOpenOptionMenuId] = useState<string | null>(null);

  // Filtro da aba de Histórico de Transações (multi-selecão)
  const [tradeTypeFilter, setTradeTypeFilter] = useState<Set<TradeTypeFilter>>(new Set());

  // Ordenação da Tabela de Dividendos
  type DividendSortKey = 'date' | 'ticker' | 'institution' | 'total_earnings';
  const [divSortKey, setDivSortKey] = useState<DividendSortKey>('date');
  const [divSortAsc, setDivSortAsc] = useState<boolean>(false);

  // Filtro de Histórico Realizado (Vencedores vs Perdedores e Classe de Ativo)
  const [realizedFilter, setRealizedFilter] = useState<RealizedFilter>('ALL');
  const [realizedTypeFilter, setRealizedTypeFilter] = useState<'ALL' | 'STOCK' | 'FII' | 'CRYPTO' | 'FIXED_INCOME'>('ALL');
  const [closedSortKey, setClosedSortKey] = useState<'date' | 'total_value'>('date');
  const [closedSortAsc, setClosedSortAsc] = useState<boolean>(false);

  // Menu Dropdown de Ações / Sincronizações
  const [showSyncMenu, setShowSyncMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Modais
  const [showB3Modal, setShowB3Modal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedAssetTypeForAdd, setSelectedAssetTypeForAdd] = useState<AssetType>('STOCK');
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [sellingInvestment, setSellingInvestment] = useState<Investment | null>(null);
  const [showSellModal, setShowSellModal] = useState<boolean>(false);
  const [sellModalInitialTab, setSellModalInitialTab] = useState<'SELL' | 'EDIT'>('SELL');
  const [editingTrade, setEditingTrade] = useState<InvestmentTrade | null>(null);
  const [editingRealizedOp, setEditingRealizedOp] = useState<RealizedOperation | null>(null);
  const [realizedOpNewDate, setRealizedOpNewDate] = useState<string>('');
  const [savingRealizedDate, setSavingRealizedDate] = useState<boolean>(false);

  const handleOpenAddModal = (type?: AssetType) => {
    setEditingInvestment(null);
    if (type) {
      setSelectedAssetTypeForAdd(type);
    } else if (activeTab === 'STOCK' || activeTab === 'FII' || activeTab === 'FIXED_INCOME' || activeTab === 'CRYPTO') {
      setSelectedAssetTypeForAdd(activeTab as AssetType);
    } else {
      setSelectedAssetTypeForAdd('STOCK');
    }
    setShowAddModal(true);
  };

  // Filtro de busca por texto, mês e classe
  const [search, setSearch] = useState('');
  const [tradeMonthFilter, setTradeMonthFilter] = useState('ALL');
  const [assetClassFilter, setAssetClassFilter] = useState('ALL');
  const [evolutionData, setEvolutionData] = useState<Array<{ month: string; appliedValue: number; marketValue: number; capitalGain: number }>>([]);

  const tradeMonths = (() => {
    const months = new Set<string>();
    for (const t of tradesData) {
      if (t.date) months.add(t.date.substring(0, 7));
    }
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  })();

  const fetchInvestments = async () => {
    // Só exibe o carregamento inicial se não houver nenhum ativo em memória
    if (investments.length === 0) {
      setLoading(true);
    }
    try {
      // 1. Busca os investimentos e resumo primeiro para renderizar a tabela na hora
      const invData = await api.getInvestments();
      setInvestments(invData.investments);
      setSummary(invData.summary);
      setLoading(false);

      // 2. Busca proventos, histórico e evolução em paralelo sem travar a interface
      Promise.all([
        api.getDividends().catch(() => null),
        api.getTrades().catch(() => null),
        api.getInvestmentEvolution().catch(() => null),
        api.getRealizedOperations().catch(() => null),
      ]).then(([divData, tradeRes, evolutionRes, realizedRes]) => {
        if (divData) setDividendsData(divData);
        if (tradeRes?.trades) setTradesData(tradeRes.trades);
        if (evolutionRes?.evolution) setEvolutionData(evolutionRes.evolution);
        if (realizedRes?.operations) setRealizedOperations(realizedRes.operations);
      });
    } catch (err) {
      notify('Falha ao carregar investimentos.', 'error');
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchInvestments();

    const handleUpdateEvent = () => {
      void fetchInvestments();
    };

    // Atualiza automaticamente a cada 1 hora se a página estiver aberta
    const hourlyInterval = setInterval(() => {
      void fetchInvestments();
    }, 60 * 60 * 1000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchInvestments();
      }
    };

    window.addEventListener('investments-updated', handleUpdateEvent);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(hourlyInterval);
      window.removeEventListener('investments-updated', handleUpdateEvent);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Fechar menu dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowSyncMenu(false);
      }
      setOpenOptionMenuId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSyncBinance = async () => {
    setShowSyncMenu(false);
    setSyncingBinance(true);
    try {
      const res = await api.syncBinance();
      notify(`Sincronizado! ${res.synced_count} ativo(s) da Binance atualizados.`, 'success');
      await fetchInvestments();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erro ao sincronizar com Binance.', 'error');
    } finally {
      setSyncingBinance(false);
    }
  };

  const [importingBinanceReport, setImportingBinanceReport] = useState(false);
  const handleImportBinanceReport = async () => {
    setShowSyncMenu(false);
    setImportingBinanceReport(true);
    try {
      const res = await api.importBinanceReport();
      notify(`Relatório Binance processado! ${res.count} ativos recalculados com câmbio histórico e trocas.`, 'success');
      await fetchInvestments();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Erro ao processar relatório Binance.', 'error');
    } finally {
      setImportingBinanceReport(false);
    }
  };

  const handleSyncB3 = async () => {
    setShowSyncMenu(false);
    setSyncingB3(true);
    try {
      const res = await api.syncB3Investments();
      notify(`Sincronizado! ${res.count} ativo(s) da B3/Corretoras atualizados.`, 'success');
      await fetchInvestments();
    } catch (err) {
      notify('Erro ao sincronizar B3. Conecte sua conta via Open Finance.', 'error');
    } finally {
      setSyncingB3(false);
    }
  };

  const handleSyncQuotes = async () => {
    setShowSyncMenu(false);
    setSyncingQuotes(true);
    try {
      const res = await api.updateQuotes();
      notify(`Cotações atualizadas via Yahoo Finance! ${res.updated_count} ativo(s) atualizados.`, 'success');
      await fetchInvestments();
    } catch (err) {
      notify('Erro ao atualizar cotações de mercado.', 'error');
    } finally {
      setSyncingQuotes(false);
    }
  };

  const handleConnectB3 = () => {
    setShowSyncMenu(false);
    void openConnect(
      async () => {
        notify('B3 / Corretora conectada com sucesso!', 'success');
        await handleSyncB3();
      },
      (msg) => notify(msg, 'error'),
    );
  };

  const handleSyncDividends = async () => {
    setSyncingDividends(true);
    try {
      const res = await api.syncDividendsToTransactions();
      if (res.insertedCount > 0) {
        notify(`Sucesso! ${res.insertedCount} provento(s) lançado(s) nas transações.`, 'success');
      } else {
        notify(`Todos os proventos já constavam nas transações. Nenhuma duplicata criada!`, 'info');
      }
      await fetchInvestments();
    } catch (err) {
      notify('Erro ao sincronizar proventos.', 'error');
    } finally {
      setSyncingDividends(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Deseja remover o ativo "${name}" da carteira?`)) return;
    try {
      await api.deleteInvestment(id);
      notify('Ativo removido com sucesso.', 'success');
      await fetchInvestments();
    } catch (err) {
      notify('Erro ao remover ativo.', 'error');
    }
  };

  const handleDeleteTrade = async (id: string, ticker: string) => {
    if (!confirm(`Deseja excluir esta transação de ${ticker}?`)) return;
    try {
      await api.deleteTrade(id);
      notify('Transação excluída do histórico com sucesso.', 'success');
      await fetchInvestments();
    } catch (err) {
      notify('Erro ao excluir transação.', 'error');
    }
  };

  // Separação entre Posições Ativas e Histórico Realizado de Vendas Fechadas
  const activeInvestments = investments.filter((i) => i.quantity > 0 && i.sync_source !== 'GORILA_CLOSED');

  // Filtrar posições ativas por Sub-aba
  const currentTabInvestments = activeInvestments.filter((inv) => {
    const matchesSearch =
      inv.name.toLowerCase().includes(search.toLowerCase()) ||
      inv.code_ticker.toLowerCase().includes(search.toLowerCase()) ||
      inv.institution.toLowerCase().includes(search.toLowerCase());

    const matchesTab =
      activeTab === 'OVERVIEW' ||
      inv.asset_type === activeTab ||
      (activeTab === 'STOCK' && (inv.asset_type === 'STOCK' || inv.asset_type === 'OTHER'));

    return matchesSearch && matchesTab;
  });

  const matchesRealizedType = (op: RealizedOperation, typeFilter: string) => {
    if (typeFilter === 'ALL') return true;
    if (typeFilter === 'STOCK') return op.asset_type === 'STOCK' || op.asset_type === 'OTHER';
    if (typeFilter === 'FII') return op.asset_type === 'FII';
    if (typeFilter === 'CRYPTO') return op.asset_type === 'CRYPTO';
    if (typeFilter === 'FIXED_INCOME') return op.asset_type === 'FIXED_INCOME' || (op.asset_type as string) === 'TREASURY';
    return op.asset_type === typeFilter;
  };

  const realizedTypeCounts = useMemo(() => {
    const ops = realizedOperations || [];
    return {
      ALL: ops.length,
      STOCK: ops.filter((o) => matchesRealizedType(o, 'STOCK')).length,
      FII: ops.filter((o) => matchesRealizedType(o, 'FII')).length,
      CRYPTO: ops.filter((o) => matchesRealizedType(o, 'CRYPTO')).length,
      FIXED_INCOME: ops.filter((o) => matchesRealizedType(o, 'FIXED_INCOME')).length,
    };
  }, [realizedOperations]);

  const typeFilteredRealized = useMemo(() => {
    return (realizedOperations || []).filter((op) => matchesRealizedType(op, realizedTypeFilter));
  }, [realizedOperations, realizedTypeFilter]);

  // Filtrar histórico de vendas encerradas por tipo + busca + filtro de ganho/perda e ordenar do mais recente ao mais antigo
  const currentRealizedOperations = useMemo(() => {
    return (typeFilteredRealized || [])
      .filter((op) => {
        const q = search.toLowerCase();
        const matchesSearch =
          op.ticker.toLowerCase().includes(q) ||
          op.institution.toLowerCase().includes(q) ||
          (op.asset_type && op.asset_type.toLowerCase().includes(q));

        const matchesResultFilter =
          realizedFilter === 'ALL' ||
          (realizedFilter === 'WIN' && op.result_brl >= 0) ||
          (realizedFilter === 'LOSS' && op.result_brl < 0);

        return matchesSearch && matchesResultFilter;
      })
      .sort((a, b) => {
        if (closedSortKey === 'total_value') {
          return closedSortAsc ? a.result_brl - b.result_brl : b.result_brl - a.result_brl;
        }
        // Padrão: do mais recente para os mais antigos (com legado ao fim)
        if (!a.date && !b.date) return b.result_brl - a.result_brl;
        if (!a.date) return 1;
        if (!b.date) return -1;
        const timeA = new Date(a.date).getTime();
        const timeB = new Date(b.date).getTime();
        return closedSortAsc ? timeA - timeB : timeB - timeA;
      });
  }, [typeFilteredRealized, search, realizedFilter, closedSortKey, closedSortAsc]);

  // Métricas do Histórico Realizado com valores reais (dinâmicas conforme o tipo selecionado)
  const totalRealizedProfitLoss = typeFilteredRealized.reduce((acc, op) => acc + (op.result_brl || 0), 0);
  const winTrades = typeFilteredRealized.filter((op) => op.result_brl >= 0);
  const lossTrades = typeFilteredRealized.filter((op) => op.result_brl < 0);
  const winRatePct = typeFilteredRealized.length > 0 ? (winTrades.length / typeFilteredRealized.length) * 100 : 0;
  const topGainTrade = winTrades.length > 0
    ? winTrades.reduce((max, i) => (i.result_brl > max.result_brl ? i : max), winTrades[0])
    : null;
  const topLossTrade = lossTrades.length > 0
    ? lossTrades.reduce((min, i) => (i.result_brl < min.result_brl ? i : min), lossTrades[0])
    : null;


  // Métricas das posições ativas
  const tabNetWorth = currentTabInvestments.reduce((acc, inv) => acc + (inv.total_value || 0), 0);
  const tabInvested = currentTabInvestments.reduce(
    (acc, inv) => acc + (inv.quantity * (inv.average_price || inv.current_price)),
    0,
  );
  const tabProfitLoss = tabNetWorth - tabInvested;
  const tabProfitLossPct = tabInvested > 0 ? (tabProfitLoss / tabInvested) * 100 : 0;

  // Dados para gráficos de alocação (Aba Visão Geral)
  const pieData = summary?.by_asset_type.map((item) => ({
    name: ASSET_TYPE_LABELS[item.type] || item.type,
    value: item.total,
    percentage: item.percentage,
    color: ASSET_TYPE_COLORS[item.type] || '#64748B',
  })) ?? [];

  return (
    <div className={`min-h-full p-3 sm:p-4 md:p-6 pb-24 space-y-4 sm:space-y-5 animate-fade-in font-sans transition-colors duration-200 ${
      isDark ? 'bg-[#0B0F19] text-slate-100' : 'bg-[#F4F6F9] text-slate-800'
    }`}>
      {/* 1. Sub-Navbar Estilo Investidor 10 */}
      <div className={`rounded-2xl border px-3 sm:px-5 py-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-4 transition-colors ${
        isDark
          ? 'bg-[#111827] border-slate-800/90 shadow-md'
          : 'bg-white border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.03)]'
      }`}>
        {/* Abas de Navegação */}
        <div
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          className={`flex items-center gap-4 sm:gap-6 overflow-x-auto no-scrollbar border-b xl:border-b-0 pb-2.5 xl:pb-0 w-full xl:w-auto shrink-0 ${
            isDark ? 'border-slate-800' : 'border-slate-100'
          }`}
        >
          {[
            { id: 'WATCHLIST' as ActiveTab, label: 'Radar de Cotações' },
            { id: 'OVERVIEW' as ActiveTab, label: 'Resumo' },
            { id: 'DIVIDENDS' as ActiveTab, label: 'Proventos' },
            { id: 'REALIZED_HISTORY' as ActiveTab, label: 'Rentabilidade' },
            { id: 'TRADES' as ActiveTab, label: 'Lançamentos' },
            { id: 'IMPORT_B3' as ActiveTab, label: 'Importar B3' },
          ].map((tab, idx) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={`${tab.id}-${idx}`}
                onClick={() => setSearchParams(tab.id === 'OVERVIEW' ? {} : { tab: tab.id })}
                className={`relative py-1.5 text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                  isActive
                    ? isDark ? 'text-white font-bold' : 'text-slate-900 font-bold'
                    : isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
                {isActive && (
                  <span className={`absolute -bottom-3 left-0 right-0 h-0.5 rounded-full ${isDark ? 'bg-white' : 'bg-slate-900'}`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Botões de Ação à Direita (B3, + Adicionar Lançamento, Moedas, Sincronizações, Toggle Dark/Light) */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 w-full xl:w-auto justify-end">
          {/* Alternador de Tema Claro / Escuro (Investidor 10) - Oculto em mobile já que existe no Header */}
          <button
            onClick={toggleTheme}
            className={`hidden sm:inline-flex items-center justify-center h-8 w-8 rounded-lg border transition-all cursor-pointer shadow-xs ${
              isDark
                ? 'border-slate-700 bg-slate-800 text-amber-400 hover:bg-slate-700 hover:text-amber-300'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
            title={isDark ? 'Mudar para Tema Claro (Light)' : 'Mudar para Tema Escuro (Dark)'}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>

          {/* Seletor de Moeda - Oculto em mobile já que existe no Header */}
          <div className={`hidden sm:flex items-center gap-1 rounded-lg border p-0.5 ${
            isDark ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-slate-50'
          }`}>
            {CURRENCIES.map((c) => (
              <button
                key={c.code}
                onClick={() => void setCurrency(c.code)}
                className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold transition-all ${
                  currency === c.code
                    ? isDark ? 'bg-slate-700 text-white shadow-xs' : 'bg-white text-slate-900 shadow-xs'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-900'
                }`}
                title={`Exibir valores em ${c.label}`}
              >
                <span>{c.flag}</span>
                <span>{c.code}</span>
              </button>
            ))}
          </div>

          {/* Botão Integração B3 */}
          <button
            onClick={handleConnectB3}
            disabled={connectingPluggy}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors shadow-xs ${
              isDark
                ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
            }`}
          >
            <Landmark className={`h-3.5 w-3.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`} />
            <span className="hidden xs:inline">Integração B3</span>
            <span className="xs:hidden">B3</span>
          </button>

          {/* Botão + Adicionar Lançamento */}
          <button
            onClick={() => handleOpenAddModal()}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 sm:px-4 py-1.5 text-xs font-semibold transition-all shadow-sm ${
              isDark
                ? 'bg-white hover:bg-slate-100 text-slate-950 font-bold'
                : 'bg-[#18181B] hover:bg-black text-white'
            }`}
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Adicionar</span>
          </button>

          {/* Dropdown de Sincronizações */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setShowSyncMenu(!showSyncMenu)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-xs transition-colors ${
                isDark
                  ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700'
                  : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
              }`}
            >
              {syncingBinance || syncingB3 || syncingQuotes ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className={`h-3.5 w-3.5 ${isDark ? 'text-slate-300' : 'text-slate-600'}`} />
              )}
              <span>Sincronizar</span>
              <ChevronDown className={`h-3 w-3 ${isDark ? 'text-slate-400' : 'text-slate-400'} transition-transform ${showSyncMenu ? 'rotate-180' : ''}`} />
            </button>

            {showSyncMenu && (
              <div className={`absolute right-0 mt-2 w-64 rounded-xl border p-2 z-50 animate-fade-in space-y-1 ${
                isDark ? 'bg-[#1F2937] border-slate-700 text-slate-200 shadow-2xl' : 'bg-white border-slate-100 text-slate-700 shadow-xl'
              }`}>
                <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  Integrações Automáticas
                </div>

                <button
                  onClick={handleSyncBinance}
                  disabled={syncingBinance}
                  className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                    isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    <span>Sync Binance (Spot & Earn)</span>
                  </div>
                  {syncingBinance && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                </button>

                <button
                  onClick={handleSyncB3}
                  disabled={syncingB3}
                  className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                    isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-blue-500" />
                    <span>Sync B3 & Corretoras</span>
                  </div>
                  {syncingB3 && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                </button>

                <button
                  onClick={handleSyncQuotes}
                  disabled={syncingQuotes}
                  className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                    isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-500" />
                    <span>Atualizar Preços (Yahoo)</span>
                  </div>
                  {syncingQuotes && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                </button>

                <div className={`my-1 border-t ${isDark ? 'border-slate-700' : 'border-slate-100'}`} />

                <button
                  onClick={() => {
                    setShowSyncMenu(false);
                    setShowHistoryModal(true);
                  }}
                  className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                    isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <History className="h-4 w-4 text-amber-500" />
                  <span>Histórico Compras Binance</span>
                </button>

                <button
                  onClick={handleImportBinanceReport}
                  disabled={importingBinanceReport}
                  className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                    isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-amber-500" />
                    <span>Recalcular Extrato Binance</span>
                  </div>
                  {importingBinanceReport && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                </button>

                <button
                  onClick={() => {
                    setShowSyncMenu(false);
                    setShowB3Modal(true);
                  }}
                  className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${
                    isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <FileSpreadsheet className="h-4 w-4 text-blue-500" />
                  <span>Importar Planilha B3 / Gorila</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Os 4 Cartões KPI Hero */}
      {activeTab === 'TRADES' || activeTab === 'IMPORT_B3' || activeTab === 'WATCHLIST' ? null : activeTab === 'DIVIDENDS' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className={`rounded-2xl border p-5 flex flex-col justify-between transition-colors ${
            isDark ? 'bg-[#111827] border-slate-800/90 shadow-md text-slate-100' : 'bg-white border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.03)] text-slate-800'
          }`}>
            <div className={`flex items-center gap-2 text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Coins className="h-4 w-4 text-amber-500" />
              <span>Total em Proventos</span>
            </div>
            <div className="mt-3">
              <div className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {fmt(dividendsData?.total_overall || 0)}
              </div>
              <div className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Rendimento acumulado</div>
            </div>
          </div>

          <div className={`rounded-2xl border p-5 flex flex-col justify-between transition-colors ${
            isDark ? 'bg-[#111827] border-slate-800/90 shadow-md text-slate-100' : 'bg-white border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.03)] text-slate-800'
          }`}>
            <div className={`flex items-center gap-2 text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <TrendingUp className="h-4 w-4 text-blue-500" />
              <span>Dividendos (Ações)</span>
            </div>
            <div className="mt-3">
              <div className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {fmt(dividendsData?.total_dividends || 0)}
              </div>
              <div className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Isentos de IR</div>
            </div>
          </div>

          <div className={`rounded-2xl border p-5 flex flex-col justify-between transition-colors ${
            isDark ? 'bg-[#111827] border-slate-800/90 shadow-md text-slate-100' : 'bg-white border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.03)] text-slate-800'
          }`}>
            <div className={`flex items-center gap-2 text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Building2 className="h-4 w-4 text-purple-500" />
              <span>JCP (Capital Próprio)</span>
            </div>
            <div className="mt-3">
              <div className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {fmt(dividendsData?.total_jcp || 0)}
              </div>
              <div className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Juros sobre Capital Próprio</div>
            </div>
          </div>

          <div className={`rounded-2xl border p-5 flex flex-col justify-between transition-colors ${
            isDark ? 'bg-[#111827] border-slate-800/90 shadow-md text-slate-100' : 'bg-white border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.03)] text-slate-800'
          }`}>
            <div className={`flex items-center gap-2 text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Layers className="h-4 w-4 text-emerald-500" />
              <span>Rendimentos FIIs</span>
            </div>
            <div className="mt-3">
              <div className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {fmt(dividendsData?.total_fii_earnings || 0)}
              </div>
              <div className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Proventos mensais de FIIs</div>
            </div>
          </div>
        </div>
      ) : activeTab === 'REALIZED_HISTORY' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className={`rounded-2xl border p-5 flex flex-col justify-between transition-colors ${
            isDark ? 'bg-[#111827] border-slate-800/90 shadow-md text-slate-100' : 'bg-white border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.03)] text-slate-800'
          }`}>
            <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Lucro Realizado {realizedTypeFilter === 'ALL' ? 'Total' : `(${ASSET_TYPE_LABELS[realizedTypeFilter as AssetType] || realizedTypeFilter})`}
            </span>
            <div className="mt-3">
              <div className={`text-2xl font-bold tracking-tight ${totalRealizedProfitLoss >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {totalRealizedProfitLoss >= 0 ? `+${fmt(totalRealizedProfitLoss)}` : fmt(totalRealizedProfitLoss)}
              </div>
              <div className="mt-1 text-xs text-emerald-500 font-medium">
                {typeFilteredRealized.length} {typeFilteredRealized.length === 1 ? 'operação encerrada' : 'operações encerradas'}
              </div>
            </div>
          </div>

          <div className={`rounded-2xl border p-5 flex flex-col justify-between transition-colors ${
            isDark ? 'bg-[#111827] border-slate-800/90 shadow-md text-slate-100' : 'bg-white border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.03)] text-slate-800'
          }`}>
            <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Taxa de Acerto (Win Rate)</span>
            <div className="mt-3">
              <div className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>{winRatePct.toFixed(1)}%</div>
              <div className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-400'}`}>
                <span className="text-emerald-500 font-semibold">{winTrades.length} Ganho</span> ·{' '}
                <span className="text-rose-500 font-semibold">{lossTrades.length} Perda</span>
              </div>
            </div>
          </div>

          <div className={`rounded-2xl border p-5 flex flex-col justify-between transition-colors ${
            isDark ? 'bg-[#111827] border-slate-800/90 shadow-md text-slate-100' : 'bg-white border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.03)] text-slate-800'
          }`}>
            <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Maior Ganho {realizedTypeFilter !== 'ALL' && `(${ASSET_TYPE_LABELS[realizedTypeFilter as AssetType] || realizedTypeFilter})`}
            </span>
            <div className="mt-3">
              <div className="text-2xl font-bold text-emerald-500 truncate">
                {topGainTrade ? `+${fmt(topGainTrade.result_brl)}` : 'R$ 0,00'}
              </div>
              <div className={`mt-1 text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {topGainTrade ? `${topGainTrade.ticker} (${topGainTrade.institution})` : 'Nenhum ganho'}
              </div>
            </div>
          </div>

          <div className={`rounded-2xl border p-5 flex flex-col justify-between transition-colors ${
            isDark ? 'bg-[#111827] border-slate-800/90 shadow-md text-slate-100' : 'bg-white border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.03)] text-slate-800'
          }`}>
            <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Maior Perda {realizedTypeFilter !== 'ALL' && `(${ASSET_TYPE_LABELS[realizedTypeFilter as AssetType] || realizedTypeFilter})`}
            </span>
            <div className="mt-3">
              <div className="text-2xl font-bold text-rose-500 truncate">
                {topLossTrade ? fmt(topLossTrade.result_brl) : 'R$ 0,00'}
              </div>
              <div className={`mt-1 text-xs truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                {topLossTrade ? `${topLossTrade.ticker} (${topLossTrade.institution})` : 'Nenhuma perda'}
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'OVERVIEW' ? (
        /* Os 4 Cards Hero Idênticos ao Investidor 10 */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Patrimônio total */}
          <div className={`rounded-2xl border p-5 flex flex-col justify-between transition-colors ${
            isDark ? 'bg-[#111827] border-slate-800/90 shadow-md text-slate-100' : 'bg-white border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.03)] text-slate-800'
          }`}>
            <div className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Wallet className={`h-4 w-4 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
              <span className="text-xs font-medium">Patrimônio total</span>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {fmt(summary?.total_net_worth ?? 0)}
                </span>
                <span className={`inline-flex items-center text-xs font-semibold ${
                  (summary?.profit_loss_pct ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'
                }`}>
                  {formatPercent(summary?.profit_loss_pct ?? 0)} {(summary?.profit_loss_pct ?? 0) >= 0 ? '▲' : '▼'}
                </span>
              </div>
              <div className={`mt-2 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Valor investido <span className={`font-semibold ml-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{fmt(summary?.total_invested ?? 0)}</span>
              </div>
            </div>
          </div>

          {/* Card 2: Lucro total */}
          <div className={`rounded-2xl border p-5 flex flex-col justify-between transition-colors ${
            isDark ? 'bg-[#111827] border-slate-800/90 shadow-md text-slate-100' : 'bg-white border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.03)] text-slate-800'
          }`}>
            <div className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Coins className={`h-4 w-4 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
              <span className="text-xs font-medium">Lucro total</span>
            </div>
            <div className="mt-3">
              <div className={`text-2xl font-bold tracking-tight ${
                (summary?.total_profit_loss ?? 0) >= 0 ? 'text-emerald-500' : 'text-rose-500'
              }`}>
                {(summary?.total_profit_loss ?? 0) >= 0 ? `+${fmt(summary?.total_profit_loss ?? 0)}` : fmt(summary?.total_profit_loss ?? 0)}
              </div>
              <div className={`mt-2 grid grid-cols-2 gap-2 text-[11px] border-t pt-2 ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
                <div>
                  <span className={`block text-[10px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Ganho de Capital</span>
                  <span className={`font-semibold ${(summary?.total_profit_loss ?? 0) >= 0 ? (isDark ? 'text-slate-300' : 'text-slate-700') : 'text-rose-500'}`}>
                    {fmt((summary?.total_profit_loss ?? 0) - (dividendsData?.total_overall ?? 0))}
                  </span>
                </div>
                <div>
                  <span className={`block text-[10px] font-medium ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Dividendos Recebidos</span>
                  <span className="font-semibold text-emerald-500">
                    +{fmt(dividendsData?.total_overall ?? 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Proventos Recebidos (12M) */}
          <div className={`rounded-2xl border p-5 flex flex-col justify-between transition-colors ${
            isDark ? 'bg-[#111827] border-slate-800/90 shadow-md text-slate-100' : 'bg-white border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.03)] text-slate-800'
          }`}>
            <div className={`flex items-center gap-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <Receipt className={`h-4 w-4 ${isDark ? 'text-slate-400' : 'text-slate-400'}`} />
              <span className="text-xs font-medium">Proventos Recebidos (12M)</span>
            </div>
            <div className="mt-3">
              <div className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                {fmt(dividendsData?.total_overall ?? 0)}
              </div>
              <div className={`mt-2 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Total <span className={`font-semibold ml-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>{fmt(dividendsData?.total_overall ?? 0)}</span>
              </div>
            </div>
          </div>

          {/* Card 4: Rentabilidade (12M) / Rentabilidade Total */}
          <div className={`rounded-2xl border p-5 flex flex-col justify-between transition-colors ${
            isDark ? 'bg-[#111827] border-slate-800/90 shadow-md text-slate-100' : 'bg-white border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.03)] text-slate-800'
          }`}>
            <div className={`flex items-center justify-between text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              <span>Rentabilidade (12M)</span>
              <span>Rentabilidade Total</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div>
                <span className={`inline-flex items-center justify-center w-full py-1 px-2 rounded-md text-xs font-bold ${
                  (summary?.profit_loss_pct ?? 0) >= 0
                    ? isDark ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    : isDark ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' : 'bg-rose-50 text-rose-500 border border-rose-100'
                }`}>
                  {formatPercent(summary?.profit_loss_pct ?? 0)} {(summary?.profit_loss_pct ?? 0) >= 0 ? '↗' : '↘'}
                </span>
              </div>
              <div>
                <span className={`inline-flex items-center justify-center w-full py-1 px-2 rounded-md text-xs font-bold ${
                  (summary?.profit_loss_pct ?? 0) >= 0
                    ? isDark ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                    : isDark ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' : 'bg-rose-50 text-rose-500 border border-rose-100'
                }`}>
                  {formatPercent(summary?.profit_loss_pct ?? 0)} {(summary?.profit_loss_pct ?? 0) >= 0 ? '↗' : '↘'}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className={`rounded-2xl border p-5 transition-colors ${
            isDark ? 'bg-[#111827] border-slate-800/90 shadow-md text-slate-100' : 'bg-white border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.03)] text-slate-800'
          }`}>
            <span className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
              Patrimônio em {ASSET_TYPE_LABELS[activeTab as AssetType] || activeTab}
            </span>
            <div className={`mt-3 text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {fmt(tabNetWorth)}
            </div>
            <div className="mt-1 flex items-center gap-1 text-xs">
              <span className={`font-semibold ${tabProfitLoss >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {tabProfitLoss >= 0 ? '+' : ''}{fmt(tabProfitLoss)} ({formatPercent(tabProfitLossPct)})
              </span>
            </div>
          </div>

          <div className={`rounded-2xl border p-5 transition-colors ${
            isDark ? 'bg-[#111827] border-slate-800/90 shadow-md text-slate-100' : 'bg-white border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.03)] text-slate-800'
          }`}>
            <span className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total Investido (Custo)</span>
            <div className={`mt-3 text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {fmt(tabInvested)}
            </div>
            <div className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>Custo médio de aquisição</div>
          </div>

          <div className={`rounded-2xl border p-5 transition-colors ${
            isDark ? 'bg-[#111827] border-slate-800/90 shadow-md text-slate-100' : 'bg-white border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.03)] text-slate-800'
          }`}>
            <span className={`text-xs font-medium uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Total de Ativos</span>
            <div className={`mt-3 text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
              {currentTabInvestments.length} <span className={`text-sm font-normal ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>ativos</span>
            </div>
          </div>
        </div>
      )}

      {/* 3. Linha de Gráficos (Aba Resumo) */}
      {activeTab === 'OVERVIEW' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Card Esquerdo: Evolução do Patrimônio (7 colunas) */}
          <div className={`lg:col-span-7 rounded-2xl border p-5 sm:p-6 flex flex-col justify-between transition-colors ${
            isDark ? 'bg-[#111827] border-slate-800/90 shadow-md' : 'bg-white border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.03)]'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
              <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                Evolução do Patrimônio
              </h3>

              <div className="flex items-center gap-2">
                <button className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
                  isDark
                    ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-xs'
                }`}>
                  <Calendar className="h-3 w-3 text-slate-400" />
                  <span>Últimos 12 Meses</span>
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                </button>
                <button className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
                  isDark
                    ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-xs'
                }`}>
                  <span>Todos os tipos</span>
                  <ChevronDown className="h-3 w-3 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Legenda Customizada */}
            <div className={`flex items-center gap-4 text-xs font-medium mb-2 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-4 rounded-xs bg-[#10B981]" />
                <span>Valor aplicado</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-4 rounded-xs bg-[#6EE7B7]" />
                <span>Ganho de Capital</span>
              </div>
            </div>

            {/* Gráfico de Barras */}
            <div className="h-72 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={evolutionData.map((item) => {
                    const [year, month] = item.month.split('-');
                    return {
                      ...item,
                      displayMonth: `${month}/${year.substring(2)}`,
                    };
                  })}
                  margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#1F293D' : '#F1F5F9'} />
                  <ReferenceLine y={0} stroke={isDark ? '#334155' : '#E2E8F0'} strokeWidth={1} />
                  
                  <XAxis
                    dataKey="displayMonth"
                    stroke={isDark ? '#64748B' : '#94A3B8'}
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: isDark ? '#334155' : '#E2E8F0' }}
                  />
                  <YAxis
                    stroke={isDark ? '#64748B' : '#94A3B8'}
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: isDark ? '#334155' : '#E2E8F0' }}
                    tickFormatter={(val) => `R$ ${(val / 1000).toFixed(0)}K`}
                  />

                  <Tooltip
                    cursor={{ fill: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(241, 245, 249, 0.6)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        const applied = data.appliedValue || 0;
                        const gain = data.capitalGain || 0;
                        const total = data.marketValue || (applied + gain);
                        return (
                          <div className={`rounded-xl border p-3 space-y-1.5 min-w-[180px] text-xs ${
                            isDark ? 'border-slate-700 bg-[#1F2937] text-white shadow-2xl' : 'border-slate-100 bg-white text-slate-800 shadow-xl'
                          }`}>
                            <div className={`font-bold border-b pb-1 ${isDark ? 'border-slate-700 text-white' : 'border-slate-100 text-slate-800'}`}>
                              Mês {data.displayMonth}
                            </div>
                            <div className={`flex items-center justify-between ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                              <span>Aplicado:</span>
                              <span className={`font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{fmt(applied)}</span>
                            </div>
                            <div className={`flex items-center justify-between ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                              <span>Ganho:</span>
                              <span className={`font-semibold ${gain >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {gain >= 0 ? '+' : ''}{fmt(gain)}
                              </span>
                            </div>
                            <div className={`flex items-center justify-between font-bold border-t pt-1 ${isDark ? 'border-slate-700 text-white' : 'border-slate-100 text-slate-800'}`}>
                              <span>Patrimônio:</span>
                              <span>{fmt(total)}</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />

                  <Bar
                    dataKey="appliedValue"
                    name="Valor aplicado"
                    stackId="a"
                    fill="#10B981"
                    maxBarSize={28}
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="capitalGain"
                    name="Ganho de Capital"
                    stackId="a"
                    fill="#6EE7B7"
                    maxBarSize={28}
                    radius={[2, 2, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Card Direito: Ativos na Carteira Donut (5 colunas) */}
          <div className={`lg:col-span-5 rounded-2xl border p-5 sm:p-6 flex flex-col justify-between transition-colors ${
            isDark ? 'bg-[#111827] border-slate-800/90 shadow-md' : 'bg-white border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.03)]'
          }`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className={`text-base font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                Ativos na Carteira
              </h3>
              <button className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1 text-xs font-medium transition-colors ${
                isDark
                  ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 shadow-xs'
              }`}>
                <span>Todos os tipos</span>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-6 my-auto pt-4">
              {/* Rosca Donut com centro oco */}
              <div className="h-56 w-56 shrink-0 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} stroke={isDark ? '#111827' : '#FFFFFF'} strokeWidth={2} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(val: number) => [fmt(val), 'Total']}
                      contentStyle={{
                        backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                        borderColor: isDark ? '#374151' : '#E2E8F0',
                        borderRadius: '10px',
                        color: isDark ? '#F9FAFB' : '#0F172A',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legenda Lateral com Porcentagens Alinhadas */}
              <div className="flex flex-col gap-3 min-w-[150px]">
                {pieData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="h-3 w-3 rounded-xs shrink-0" style={{ backgroundColor: item.color }} />
                      <span className={`font-medium ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{item.name}</span>
                    </div>
                    <span className={`font-semibold font-mono ${isDark ? 'text-white' : 'text-slate-800'}`}>
                      {item.percentage.toFixed(2)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Título da Seção "Meus Ativos" e Tabela Accordion */}
      {activeTab === 'WATCHLIST' ? (
        <UnifiedWatchlist />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className={`text-base font-bold flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-800'}`}>
              <span>
                {activeTab === 'DIVIDENDS' ? 'Histórico de Proventos' :
                 activeTab === 'REALIZED_HISTORY' ? 'Operações Encerradas' :
                 activeTab === 'TRADES' ? 'Histórico de Transações' : 'Meus Ativos'}
              </span>
              <span className={`text-xs font-semibold ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                ({activeTab === 'REALIZED_HISTORY' ? currentRealizedOperations.length : activeInvestments.length})
              </span>
            </h2>

            {/* Campo de Busca Rápida */}
            <div className="relative w-full sm:w-64">
              <Search className={`absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
              <input
                type="text"
                placeholder="Buscar ativo ou corretora..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className={`w-full rounded-xl border pl-9 pr-4 py-1.5 text-xs transition-colors ${
                  isDark
                    ? 'border-slate-700 bg-[#1F2937] text-white placeholder-slate-500 focus:border-slate-500'
                    : 'border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:border-slate-400 shadow-xs'
                }`}
              />
            </div>
          </div>

          {/* Exibição: Posições Ativas com Accordion ou Outras Abas */}
          {loading ? (
            <div className={`flex h-48 items-center justify-center rounded-2xl border ${
              isDark ? 'bg-[#111827] border-slate-800 text-slate-400' : 'bg-white border-slate-100 text-slate-400'
            }`}>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Carregando ativos...
            </div>
          ) : activeTab === 'IMPORT_B3' ? (
            <div className="-mx-4 md:-mx-6 -mt-6">
              <ImportarExtrato />
            </div>
          ) : activeTab === 'DIVIDENDS' ? (
          /* TABELA DE PROVENTOS & DIVIDENDOS */
          <div className={`rounded-2xl border p-5 space-y-4 transition-colors ${
            isDark ? 'bg-[#111827] border-slate-800/90 shadow-md' : 'bg-white border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.03)]'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                Sincronize com seu fluxo de caixa ou ordene pelo valor acumulado.
              </div>
              <button
                onClick={handleSyncDividends}
                disabled={syncingDividends}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-1.5 text-xs font-semibold transition-colors shadow-xs ${
                  isDark ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {syncingDividends ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Coins className="h-3.5 w-3.5 text-amber-500" />}
                <span>Sincronizar com Transações</span>
              </button>
            </div>

            <div className={`overflow-x-auto rounded-xl border ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
              <table className="w-full text-left text-xs">
                <thead className={`border-b text-[11px] font-medium ${
                  isDark ? 'bg-slate-800/40 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-400'
                }`}>
                  <tr>
                    <th className="px-4 py-2.5">Data</th>
                    <th className="px-4 py-2.5">Ativo</th>
                    <th className="px-4 py-2.5">Instituição</th>
                    <th className="px-4 py-2.5">Classe</th>
                    <th className="px-4 py-2.5 text-right font-mono">Dividendos</th>
                    <th className="px-4 py-2.5 text-right font-mono">JCP</th>
                    <th className="px-4 py-2.5 text-right font-mono">Rend. FII</th>
                    <th
                      className={`px-4 py-2.5 text-right font-mono font-bold cursor-pointer ${isDark ? 'text-white' : 'text-slate-800'}`}
                      onClick={() => {
                        if (divSortKey === 'total_earnings') setDivSortAsc(!divSortAsc);
                        else { setDivSortKey('total_earnings'); setDivSortAsc(false); }
                      }}
                    >
                      Total {divSortKey === 'total_earnings' && (divSortAsc ? '↑' : '↓')}
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-slate-800 text-slate-300' : 'divide-slate-100 text-slate-700'}`}>
                  {(dividendsData?.items || [])
                    .filter(item => item.ticker.toLowerCase().includes(search.toLowerCase()) || item.institution.toLowerCase().includes(search.toLowerCase()))
                    .sort((a, b) => {
                      let valA: any = a[divSortKey] ?? '';
                      let valB: any = b[divSortKey] ?? '';
                      if (typeof valA === 'string') valA = valA.toLowerCase();
                      if (typeof valB === 'string') valB = valB.toLowerCase();
                      if (valA < valB) return divSortAsc ? -1 : 1;
                      if (valA > valB) return divSortAsc ? 1 : -1;
                      return 0;
                    })
                    .map(item => (
                      <tr key={item.id} className={`transition-colors ${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50/60'}`}>
                        <td className={`px-4 py-2.5 font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{item.date?.substring(0, 10)}</td>
                        <td className={`px-4 py-2.5 font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{item.ticker}</td>
                        <td className={`px-4 py-2.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{item.institution}</td>
                        <td className={`px-4 py-2.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{item.asset_class}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{item.dividends > 0 ? fmt(item.dividends) : '-'}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{item.jcp > 0 ? fmt(item.jcp) : '-'}</td>
                        <td className="px-4 py-2.5 text-right font-mono">{item.fii_earnings > 0 ? fmt(item.fii_earnings) : '-'}</td>
                        <td className="px-4 py-2.5 text-right font-mono font-bold text-emerald-500">{fmt(item.total_earnings)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : activeTab === 'REALIZED_HISTORY' ? (
          /* TABELA DE OPERAÇÕES FECHADAS (HISTÓRICO REALIZADO) */
          <div className={`rounded-2xl border p-5 space-y-4 transition-colors ${
            isDark ? 'bg-[#111827] border-slate-800/90 shadow-md' : 'bg-white border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.03)]'
          }`}>
            <div className="flex flex-col gap-3">
              {/* Filtro por Classe / Tipo de Ativo */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/40">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`text-xs font-semibold mr-1 flex items-center gap-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                    <Layers className="h-3.5 w-3.5 text-accent-gold" /> Filtrar por Tipo:
                  </span>
                  {[
                    { id: 'ALL' as const, label: 'Todos os Tipos', count: realizedTypeCounts.ALL, icon: Layers },
                    { id: 'STOCK' as const, label: 'Ações', count: realizedTypeCounts.STOCK, icon: TrendingUp },
                    { id: 'FII' as const, label: 'Fundos Imobiliários', count: realizedTypeCounts.FII, icon: Building2 },
                    { id: 'CRYPTO' as const, label: 'Criptomoedas', count: realizedTypeCounts.CRYPTO, icon: Coins },
                    { id: 'FIXED_INCOME' as const, label: 'Renda Fixa / Tesouro', count: realizedTypeCounts.FIXED_INCOME, icon: Landmark },
                  ].map((t) => {
                    const Icon = t.icon;
                    const isActive = realizedTypeFilter === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setRealizedTypeFilter(t.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                          isActive
                            ? 'bg-accent-gold text-slate-950 font-bold shadow-sm'
                            : isDark
                            ? 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700/60'
                            : 'bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        <span>{t.label}</span>
                        <span className={`text-[11px] px-1.5 py-0.2 rounded-full font-mono ${
                          isActive
                            ? 'bg-black/20 text-slate-950'
                            : isDark ? 'bg-slate-700 text-slate-300' : 'bg-slate-200 text-slate-700'
                        }`}>
                          {t.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Filtro de Resultado (Todos / Lucros / Prejuízos) + Busca Rápida */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className={`flex items-center gap-1.5 rounded-lg border p-0.5 ${
                  isDark ? 'border-slate-700 bg-slate-800/70' : 'border-slate-200 bg-slate-50'
                }`}>
                  <button
                    onClick={() => setRealizedFilter('ALL')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                      realizedFilter === 'ALL'
                        ? isDark ? 'bg-slate-700 text-white shadow-xs' : 'bg-white text-slate-900 shadow-xs'
                        : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Todos ({typeFilteredRealized.length})
                  </button>
                  <button
                    onClick={() => setRealizedFilter('WIN')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                      realizedFilter === 'WIN'
                        ? isDark ? 'bg-emerald-500/20 text-emerald-300 shadow-xs' : 'bg-emerald-50 text-emerald-700 shadow-xs'
                        : isDark ? 'text-slate-400 hover:text-emerald-400' : 'text-slate-500 hover:text-emerald-700'
                    }`}
                  >
                    Lucros ({winTrades.length})
                  </button>
                  <button
                    onClick={() => setRealizedFilter('LOSS')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                      realizedFilter === 'LOSS'
                        ? isDark ? 'bg-rose-500/20 text-rose-300 shadow-xs' : 'bg-rose-50 text-rose-600 shadow-xs'
                        : isDark ? 'text-slate-400 hover:text-rose-400' : 'text-slate-500 hover:text-rose-600'
                    }`}
                  >
                    Prejuízos ({lossTrades.length})
                  </button>
                </div>

                <div className="relative min-w-[220px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-secondary" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Filtrar por código ou instituição..."
                    className="w-full rounded-xl border border-border bg-bg-primary pl-9 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-secondary/60 focus:border-accent-gold focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className={`overflow-x-auto rounded-xl border ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
              <table className="w-full text-left text-xs">
                <thead className={`border-b text-[11px] font-medium ${
                  isDark ? 'bg-slate-800/40 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-400'
                }`}>
                  <tr>
                    <th
                      className="px-4 py-2.5 cursor-pointer select-none hover:text-text-primary transition-colors"
                      onClick={() => {
                        if (closedSortKey === 'date') setClosedSortAsc(!closedSortAsc);
                        else {
                          setClosedSortKey('date');
                          setClosedSortAsc(false);
                        }
                      }}
                      title="Clique para alternar ordenação por data"
                    >
                      Data {closedSortKey === 'date' && (closedSortAsc ? '↑' : '↓')}
                    </th>
                    <th className="px-4 py-2.5">Ativo Fechado</th>
                    <th className="px-4 py-2.5">Classe</th>
                    <th className="px-4 py-2.5">Instituição</th>
                    <th className="px-4 py-2.5 font-mono">Preço Médio Compra</th>
                    <th className="px-4 py-2.5 font-mono">Preço Venda</th>
                    <th
                      className="px-4 py-2.5 font-mono cursor-pointer select-none hover:text-text-primary transition-colors"
                      onClick={() => {
                        if (closedSortKey === 'total_value') setClosedSortAsc(!closedSortAsc);
                        else {
                          setClosedSortKey('total_value');
                          setClosedSortAsc(false);
                        }
                      }}
                      title="Clique para alternar ordenação por resultado"
                    >
                      Resultado (R$) {closedSortKey === 'total_value' && (closedSortAsc ? '↑' : '↓')}
                    </th>
                    <th className="px-4 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-slate-800 text-slate-300' : 'divide-slate-100 text-slate-700'}`}>
                  {currentRealizedOperations.map((op) => {
                    const isWin = op.result_brl >= 0;
                    const dateFormatted = op.date ? (() => {
                      const clean = op.date.substring(0, 10);
                      const parts = clean.split('-');
                      return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : clean;
                    })() : null;

                    return (
                      <tr key={op.id} className={`transition-colors ${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50/60'}`}>
                        <td className="px-4 py-2.5 font-mono text-xs">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRealizedOp(op);
                              setRealizedOpNewDate(op.date ? op.date.substring(0, 10) : '2024-06-01');
                            }}
                            className="group inline-flex items-center gap-1.5 rounded px-2 py-1 -mx-2 transition-all hover:bg-slate-700/30 text-left"
                            title="Clique para definir ou ajustar a data exata da venda"
                          >
                            {dateFormatted ? (
                              <span className={`font-medium ${isDark ? 'text-slate-300 group-hover:text-accent-gold' : 'text-slate-700 group-hover:text-accent-gold'}`}>
                                {dateFormatted}
                              </span>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold border transition-all ${
                                  isDark
                                    ? 'bg-amber-500/10 text-amber-300 border-amber-500/30 group-hover:border-amber-400 group-hover:bg-amber-500/20'
                                    : 'bg-amber-50 text-amber-800 border-amber-200 group-hover:border-amber-400 group-hover:bg-amber-100'
                                }`}
                                title="Operação anterior sem data no extrato B3 recente. Clique para definir a data de encerramento!"
                              >
                                <Calendar className="h-3 w-3 text-amber-500" />
                                Anterior
                              </span>
                            )}
                            <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-100 text-slate-400 transition-opacity shrink-0" />
                          </button>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{op.ticker}</span>
                            {op.kind === 'SWAP' && op.to_ticker && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent-gold/15 text-accent-gold border border-accent-gold/25 font-semibold">
                                Troca ➔ {op.to_ticker}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className={`px-4 py-2.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {ASSET_TYPE_LABELS[op.asset_type as AssetType] || op.asset_type}
                        </td>
                        <td className={`px-4 py-2.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{op.institution}</td>
                        <td className="px-4 py-2.5 font-mono">
                          {op.currency === 'USD' ? `$ ${op.avg_cost.toFixed(op.avg_cost < 1 ? 4 : 2)}` : fmt(op.avg_cost || 0)}
                        </td>
                        <td className="px-4 py-2.5 font-mono">
                          {op.currency === 'USD' ? `$ ${op.sell_price.toFixed(op.sell_price < 1 ? 4 : 2)}` : fmt(op.sell_price || 0)}
                        </td>
                        <td className={`px-4 py-2.5 font-mono font-bold ${isWin ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {isWin ? `+${fmt(op.result_brl)}` : fmt(op.result_brl)}
                        </td>
                        <td className="px-4 py-2.5">
                          {isWin ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Lucro
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-500">
                              <XCircle className="h-3.5 w-3.5" /> Prejuízo
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

            </div>
          </div>
        ) : activeTab === 'TRADES' ? (
          /* TABELA DE LANÇAMENTOS */
          <div className={`rounded-2xl border p-5 space-y-4 transition-colors ${
            isDark ? 'bg-[#111827] border-slate-800/90 shadow-md' : 'bg-white border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.03)]'
          }`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setTradeTypeFilter(new Set())}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                    tradeTypeFilter.size === 0
                      ? isDark ? 'bg-white text-slate-900 shadow-xs' : 'bg-slate-900 text-white shadow-xs'
                      : isDark ? 'text-slate-400 hover:text-white bg-slate-800' : 'text-slate-600 hover:text-slate-900 bg-slate-50'
                  }`}
                >
                  Todas
                </button>
                {(['BUY', 'SELL', 'SWAP'] as TradeTypeFilter[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      setTradeTypeFilter(prev => {
                        const next = new Set(prev);
                        if (next.has(type)) next.delete(type);
                        else next.add(type);
                        return next;
                      });
                    }}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                      tradeTypeFilter.has(type)
                        ? isDark ? 'bg-white text-slate-900 shadow-xs' : 'bg-slate-900 text-white shadow-xs'
                        : isDark ? 'text-slate-400 hover:text-white bg-slate-800' : 'text-slate-600 hover:text-slate-900 bg-slate-50'
                    }`}
                  >
                    {type === 'BUY' ? 'Compras' : type === 'SELL' ? 'Vendas' : 'Trocas'}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={tradeMonthFilter}
                  onChange={(e) => setTradeMonthFilter(e.target.value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold focus:outline-none ${
                    isDark ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <option value="ALL">Todos os Meses</option>
                  {tradeMonths.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>

                <select
                  value={assetClassFilter}
                  onChange={(e) => setAssetClassFilter(e.target.value)}
                  className={`rounded-lg border px-3 py-1.5 text-xs font-semibold focus:outline-none ${
                    isDark ? 'border-slate-700 bg-slate-800 text-slate-200' : 'border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  <option value="ALL">Todas as Classes</option>
                  <option value="STOCK">Ações (B3)</option>
                  <option value="FII">FIIs (B3)</option>
                  <option value="FIXED_INCOME">Renda Fixa</option>
                  <option value="CRYPTO">Criptomoedas</option>
                </select>

                <button
                  onClick={async () => {
                    try {
                      setRecompilingTrades(true);
                      const res = await api.recompileTrades();
                      setTradesData(res.trades);
                      notify(`Histórico recompilado: ${res.count} transações carregadas.`, 'success');
                    } catch (e: any) {
                      notify(e.message || 'Erro ao recompilar.', 'error');
                    } finally {
                      setRecompilingTrades(false);
                    }
                  }}
                  disabled={recompilingTrades}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    isDark ? 'border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <RefreshCw className={`h-3 w-3 ${recompilingTrades ? 'animate-spin' : ''}`} />
                  <span>Recompilar</span>
                </button>
              </div>
            </div>

            <div className={`overflow-x-auto rounded-xl border ${isDark ? 'border-slate-800' : 'border-slate-100'}`}>
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className={`border-b text-xs sm:text-[13px] font-semibold ${
                  isDark ? 'bg-slate-800/40 border-slate-800 text-slate-300' : 'bg-slate-50 border-slate-100 text-slate-600'
                }`}>
                  <tr>
                    <th className="px-4 py-3">Data</th>
                    <th className="px-4 py-3">Operação</th>
                    <th className="px-4 py-3">Ativo</th>
                    <th className="px-4 py-3">Instituição</th>
                    <th className="px-4 py-3 font-mono">Quantidade</th>
                    <th className="px-4 py-3 font-mono">Preço Unit.</th>
                    <th className="px-4 py-3 font-mono text-right">Total (R$)</th>
                    <th className="px-4 py-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDark ? 'divide-slate-800 text-slate-200' : 'divide-slate-100 text-slate-700'}`}>
                  {tradesData
                    .filter(tr => {
                      const q = search.toLowerCase();
                      const matchesSearch = tr.ticker.toLowerCase().includes(q) || tr.institution.toLowerCase().includes(q);
                      const matchesType = tradeTypeFilter.size === 0 || tradeTypeFilter.has(tr.trade_type as TradeTypeFilter);
                      const matchesMonth = tradeMonthFilter === 'ALL' || tr.date.startsWith(tradeMonthFilter);
                      const matchesClass = assetClassFilter === 'ALL' || tr.asset_type === assetClassFilter;
                      return matchesSearch && matchesType && matchesMonth && matchesClass;
                    })
                    .map(tr => (
                      <tr key={tr.id} className={`transition-colors ${isDark ? 'hover:bg-slate-800/40' : 'hover:bg-slate-50/60'}`}>
                        <td className={`px-4 py-3 font-mono ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>{tr.date?.substring(0, 10)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold ${
                            tr.trade_type === 'BUY'
                              ? isDark ? 'bg-emerald-500/20 text-emerald-400' : 'bg-emerald-50 text-emerald-700'
                              : isDark ? 'bg-rose-500/20 text-rose-400' : 'bg-rose-50 text-rose-500'
                          }`}>
                            {tr.trade_type}
                          </span>
                        </td>
                        <td className={`px-4 py-3 font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{tr.ticker}</td>
                        <td className={`px-4 py-3 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>{tr.institution}</td>
                        <td className="px-4 py-3 font-mono">{tr.quantity}</td>
                        <td className="px-4 py-3 font-mono">{fmt(tr.unit_price || 0)}</td>
                        <td className={`px-4 py-3 font-mono font-bold text-right ${isDark ? 'text-white' : 'text-slate-900'}`}>{fmt(tr.total_value || 0)}</td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleDeleteTrade(tr.id, tr.ticker)}
                            className="p-1 text-slate-400 hover:text-rose-500 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ACCORDION DE CLASSES DE ATIVOS (INVESTIDOR 10) */
          currentTabInvestments.length === 0 ? (
            <div className={`rounded-2xl border p-12 text-center transition-colors ${
              isDark ? 'bg-[#111827] border-slate-800 text-slate-400' : 'bg-white border-slate-100 text-slate-400'
            }`}>
              <Coins className={`h-10 w-10 mx-auto mb-3 ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
              <p className={`font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>Nenhum ativo encontrado nesta categoria</p>
              <button
                onClick={() => handleOpenAddModal()}
                className={`mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold shadow-sm transition-all ${
                  isDark ? 'bg-white text-slate-950 hover:bg-slate-100 font-bold' : 'bg-[#18181B] text-white hover:bg-black'
                }`}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Adicionar Ativo</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {(() => {
                const groupedByCategory = currentTabInvestments.reduce<Record<string, Investment[]>>((acc, inv) => {
                  if (inv.quantity <= 0 && (!inv.total_value || inv.total_value <= 0)) return acc;
                  const cat = getAssetCategoryKey(inv);
                  if (!acc[cat]) acc[cat] = [];
                  acc[cat].push(inv);
                  return acc;
                }, {});

                const sortedCategories = Object.entries(groupedByCategory).sort(([catA], [catB]) => {
                  const idxA = CATEGORY_DISPLAY_ORDER.indexOf(catA);
                  const idxB = CATEGORY_DISPLAY_ORDER.indexOf(catB);
                  return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
                });

                return sortedCategories.map(([categoryKey, groupInvestments]) => {
                  const isCollapsed = !!collapsedCategories[categoryKey];
                  const activeCategoryCurr = categoryCurrencies[categoryKey] || 'AUTO';

                  // Valor total somado e convertido para a moeda selecionada da categoria
                  const groupDisplayTotalNetWorth = groupInvestments.reduce((sum, inv) => {
                    const isCrypto =
                      inv.asset_type === 'CRYPTO' ||
                      inv.institution === 'Binance' ||
                      ['BTC', 'ETH', 'SOL', 'ONDO', 'SXT', 'LINK', 'RENDER', 'ROSE', 'VIRTUAL', 'XRP', 'ADA', 'DOGE', 'PEPE', 'TAO', 'XLM', 'BNB', 'AVAX'].includes(inv.code_ticker?.toUpperCase() || '');

                    let curPrice = inv.current_price || inv.average_price || 0;
                    if (inv.sync_source && inv.sync_source.includes('#')) {
                      const parts = inv.sync_source.split('#');
                      if (parts.length >= 3) {
                        const parsedCur = parseFloat(parts[2]);
                        if ((!inv.current_price || inv.current_price === 0) && !isNaN(parsedCur) && parsedCur > 0) {
                          curPrice = parsedCur;
                        }
                      }
                    }

                    if (isCrypto && inv.currency === 'BRL') {
                      curPrice = curPrice * (rates['usd'] ?? 0.1818);
                    }

                    const nativeCurr = getNativeCurrency(inv);
                    const totalVal = inv.quantity > 0 ? inv.quantity * curPrice : (inv.total_value || 0);
                    const targetCurr = activeCategoryCurr !== 'AUTO' ? activeCategoryCurr : nativeCurr;

                    return sum + convertAmount(totalVal, nativeCurr, targetCurr, rates);
                  }, 0);

                  const groupDisplayTotalInvested = groupInvestments.reduce((sum, inv) => {
                    const isCrypto =
                      inv.asset_type === 'CRYPTO' ||
                      inv.institution === 'Binance' ||
                      ['BTC', 'ETH', 'SOL', 'ONDO', 'SXT', 'LINK', 'RENDER', 'ROSE', 'VIRTUAL', 'XRP', 'ADA', 'DOGE', 'PEPE', 'TAO', 'XLM', 'BNB', 'AVAX'].includes(inv.code_ticker?.toUpperCase() || '');

                    let avgPrice = inv.average_price || inv.current_price || 0;
                    if (inv.sync_source && inv.sync_source.includes('#')) {
                      const parts = inv.sync_source.split('#');
                      if (parts.length >= 2) {
                        const parsedAvg = parseFloat(parts[1]);
                        if (!isNaN(parsedAvg) && parsedAvg > 0 && !inv.average_price) avgPrice = parsedAvg;
                      }
                    }

                    if (isCrypto && inv.currency === 'BRL') {
                      avgPrice = avgPrice * (rates['usd'] ?? 0.1818);
                    }

                    const nativeCurr = getNativeCurrency(inv);
                    const totalInv = inv.quantity > 0 ? inv.quantity * avgPrice : (inv.total_value || 0);
                    const targetCurr = activeCategoryCurr !== 'AUTO' ? activeCategoryCurr : nativeCurr;

                    return sum + convertAmount(totalInv, nativeCurr, targetCurr, rates);
                  }, 0);

                  const groupDisplayProfitLoss = groupDisplayTotalNetWorth - groupDisplayTotalInvested;

                  const headerDisplayCurrency: Currency =
                    activeCategoryCurr !== 'AUTO'
                      ? activeCategoryCurr
                      : (categoryKey === 'CRYPTO' ? 'USD' : 'BRL');

                  const localeMap: Record<Currency, string> = {
                    BRL: 'pt-BR',
                    USD: 'en-US',
                    EUR: 'pt-PT',
                    CLP: 'es-CL',
                  };

                  const formattedGroupTotal = new Intl.NumberFormat(localeMap[headerDisplayCurrency], {
                    style: 'currency',
                    currency: headerDisplayCurrency,
                  }).format(groupDisplayTotalNetWorth);

                  const formattedGroupProfitLoss = new Intl.NumberFormat(localeMap[headerDisplayCurrency], {
                    style: 'currency',
                    currency: headerDisplayCurrency,
                  }).format(Math.abs(groupDisplayProfitLoss));

                  const groupProfitLossPct = groupDisplayTotalInvested > 0 ? (groupDisplayProfitLoss / groupDisplayTotalInvested) * 100 : 0;
                  const groupTotalNetWorthBrl = groupInvestments.reduce((sum, inv) => {
                    const nativeCurr = getNativeCurrency(inv);
                    let curPrice = inv.current_price || inv.average_price || 0;
                    const isCrypto =
                      inv.asset_type === 'CRYPTO' ||
                      inv.institution === 'Binance' ||
                      ['BTC', 'ETH', 'SOL', 'ONDO', 'SXT', 'LINK', 'RENDER', 'ROSE', 'VIRTUAL', 'XRP', 'ADA', 'DOGE', 'PEPE', 'TAO', 'XLM', 'BNB', 'AVAX'].includes(inv.code_ticker?.toUpperCase() || '');
                    if (isCrypto && inv.currency === 'BRL') {
                      curPrice = curPrice * (rates['usd'] ?? 0.1818);
                    }
                    const totalVal = inv.quantity > 0 ? inv.quantity * curPrice : (inv.total_value || 0);
                    return sum + convertAmount(totalVal, nativeCurr, 'BRL', rates);
                  }, 0);
                  const totalPortfolioVal = summary?.total_net_worth || 1;
                  const classPct = totalPortfolioVal > 0 ? (groupTotalNetWorthBrl / totalPortfolioVal) * 100 : 0;

                  const consolidatedGroup = Object.values(
                    groupInvestments.reduce<Record<string, Investment>>((acc, inv) => {
                      const key = inv.code_ticker || inv.name || inv.id;
                      if (!acc[key]) {
                        acc[key] = { ...inv };
                      } else {
                        const prev = acc[key];
                        const prevQty = prev.quantity || 0;
                        const invQty = inv.quantity || 0;
                        const totalQty = prevQty + invQty;
                        const prevInvested = prevQty * (prev.average_price || prev.current_price || 0);
                        const invInvested = invQty * (inv.average_price || inv.current_price || 0);
                        const combinedInvested = prevInvested + invInvested;
                        const combinedAvgPrice = totalQty > 0 ? combinedInvested / totalQty : prev.average_price;

                        acc[key] = {
                          ...prev,
                          quantity: totalQty,
                          average_price: combinedAvgPrice,
                          total_value: (prev.total_value || 0) + (inv.total_value || 0),
                          institution: prev.institution === inv.institution ? prev.institution : `${prev.institution}, ${inv.institution}`,
                        };
                      }
                      return acc;
                    }, {})
                  ).sort((a, b) => (b.total_value || b.quantity * b.current_price) - (a.total_value || a.quantity * a.current_price));

                  const addModalAssetType: AssetType =
                    categoryKey === 'TREASURY' ? 'FIXED_INCOME' :
                    categoryKey === 'ETF' ? 'OTHER' :
                    (categoryKey as AssetType);

                  return (
                    <div
                      key={categoryKey}
                      className={`rounded-2xl border overflow-hidden transition-all ${
                        isDark
                          ? 'bg-[#111827] border-slate-800/90 shadow-md'
                          : 'bg-white border-slate-100 shadow-[0_1px_3px_rgba(0,0,0,0.03)]'
                      }`}
                    >
                      {/* Header do Accordion Estilo Investidor 10 */}
                      <div
                        onClick={() => toggleCategory(categoryKey)}
                        className={`flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-3.5 cursor-pointer select-none transition-colors border-b ${
                          isDark ? 'hover:bg-slate-800/40 border-slate-800' : 'hover:bg-slate-50/50 border-slate-100'
                        }`}
                      >
                        {/* Lado Esquerdo: Grip + Badge + Título + Botão (+) */}
                        <div className="flex items-center gap-2.5">
                          <GripVertical className={`h-4 w-4 cursor-grab ${isDark ? 'text-slate-600' : 'text-slate-300'}`} />
                          {renderCategoryBadge(categoryKey, isDark)}
                          <h3 className={`font-bold text-base sm:text-lg tracking-tight ${isDark ? 'text-white' : 'text-slate-800'}`}>
                            {DISPLAY_CATEGORY_LABELS[categoryKey] || categoryKey}
                          </h3>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenAddModal(addModalAssetType);
                            }}
                            className={`p-1.5 rounded-md transition-colors ${
                              isDark
                                ? 'text-slate-400 hover:text-white hover:bg-slate-800'
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                            }`}
                            title={`Adicionar novo ativo em ${DISPLAY_CATEGORY_LABELS[categoryKey] || categoryKey}`}
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Lado Direito: Seletor de Moeda + Métricas em Colunas Horizontais + Chevron */}
                        <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-sm">
                          {/* Seletor de Moeda desta Tabela */}
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5"
                          >
                            <span className={`text-xs font-medium hidden lg:inline ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              Moeda:
                            </span>
                            <select
                              value={activeCategoryCurr}
                              onChange={(e) => {
                                e.stopPropagation();
                                updateCategoryCurrency(categoryKey, e.target.value as Currency | 'AUTO');
                              }}
                              className={`rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all focus:outline-none cursor-pointer ${
                                activeCategoryCurr !== 'AUTO'
                                  ? isDark
                                    ? 'border-emerald-500/60 bg-emerald-950/40 text-emerald-300 font-bold'
                                    : 'border-emerald-400 bg-emerald-50 text-emerald-700 font-bold shadow-xs'
                                  : isDark
                                    ? 'border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600'
                                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 shadow-xs'
                              }`}
                              title="Trocar moeda de visualização desta tabela"
                            >
                              <option value="AUTO">
                                {categoryKey === 'CRYPTO' ? '🌐 Padrão (USD $)' : '🌐 Padrão (BRL R$)'}
                              </option>
                              <option value="BRL">🇧🇷 BRL (R$)</option>
                              <option value="USD">🇺🇸 USD ($)</option>
                              <option value="EUR">🇪🇺 EUR (€)</option>
                              <option value="CLP">🇨🇱 CLP ($)</option>
                            </select>
                          </div>

                          <div className="text-right">
                            <span className={`block text-xs font-medium leading-tight ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Ativos</span>
                            <span className={`text-sm sm:text-base font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>{consolidatedGroup.length}</span>
                          </div>

                          <div className="text-right">
                            <span className={`block text-xs font-medium leading-tight ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>Valor total</span>
                            <span className={`text-sm sm:text-base font-bold ${isDark ? 'text-white' : 'text-slate-800'}`}>
                              {formattedGroupTotal}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className={`block text-xs font-medium leading-tight flex items-center justify-end gap-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              Variação <HelpCircle className={`h-3 w-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                            </span>
                            <span className={`text-sm sm:text-base font-bold ${groupProfitLossPct >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {groupProfitLossPct.toFixed(2)}% {groupProfitLossPct >= 0 ? '▲' : '▼'}
                            </span>
                          </div>

                          <div className="text-right">
                            <span className={`block text-xs font-medium leading-tight flex items-center justify-end gap-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              Ganho/Perda total <HelpCircle className={`h-3 w-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                            </span>
                            <span className={`text-sm sm:text-base font-bold ${groupDisplayProfitLoss >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                              {groupDisplayProfitLoss >= 0 ? `+${formattedGroupProfitLoss}` : `-${formattedGroupProfitLoss}`}
                            </span>
                          </div>

                          <div className="text-right hidden md:block">
                            <span className={`block text-xs font-medium leading-tight flex items-center justify-end gap-1 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                              % na carteira <HelpCircle className={`h-3 w-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                            </span>
                            <span className={`text-sm sm:text-base font-semibold flex items-center gap-1 ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                              <Clock className={`h-3 w-3 ${isDark ? 'text-slate-500' : 'text-slate-400'}`} />
                              {classPct.toFixed(0)}% / 25%
                            </span>
                          </div>

                          {/* Botão Chevron Circular */}
                          <div className={`h-7 w-7 rounded-full flex items-center justify-center transition-colors ${
                            isDark ? 'bg-slate-800 text-slate-300 hover:bg-slate-700' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}>
                            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isCollapsed ? '' : 'rotate-180'}`} />
                          </div>
                        </div>
                      </div>

                      {/* Tabela de Ativos da Categoria - Proporções Idênticas ao Investidor 10 */}
                      {!isCollapsed && (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs sm:text-sm border-collapse">
                            <thead className={`border-b text-xs sm:text-[13px] font-semibold tracking-normal select-none ${
                              isDark ? 'bg-[#161f30] border-slate-800 text-slate-300' : 'bg-[#f7f8fa] border-slate-100 text-slate-600'
                            }`}>
                              <tr>
                                <th className="pl-4 sm:pl-5 pr-2 py-3 text-left">
                                  <span className={`inline-flex items-center gap-1 cursor-pointer ${isDark ? 'hover:text-white' : 'hover:text-slate-900'}`}>
                                    Ativo <ArrowUpDown className="h-3 w-3 opacity-60" />
                                  </span>
                                </th>
                                <th className="px-3 py-3 text-right">
                                  <span className={`inline-flex items-center gap-1 cursor-pointer justify-end ${isDark ? 'hover:text-white' : 'hover:text-slate-900'}`}>
                                    Quant. <ArrowUpDown className="h-3 w-3 opacity-60" />
                                  </span>
                                </th>
                                <th className="px-3 py-3 text-right">
                                  <span className={`inline-flex items-center gap-1 cursor-pointer justify-end ${isDark ? 'hover:text-white' : 'hover:text-slate-900'}`}>
                                    Preço Médio <ArrowUpDown className="h-3 w-3 opacity-60" />
                                  </span>
                                </th>
                                <th className="px-3 py-3 text-right">
                                  <span className={`inline-flex items-center gap-1 cursor-pointer justify-end ${isDark ? 'hover:text-white' : 'hover:text-slate-900'}`}>
                                    Preço Atual <ArrowUpDown className="h-3 w-3 opacity-60" />
                                  </span>
                                </th>
                                <th className="px-3 py-3 text-right">
                                  <span className={`inline-flex items-center gap-1 cursor-pointer justify-end ${isDark ? 'hover:text-white' : 'hover:text-slate-900'}`}>
                                    Variação <ArrowUpDown className="h-3 w-3 opacity-60" />
                                  </span>
                                </th>
                                <th className="px-3 py-3 text-right">
                                  <span className={`inline-flex items-center gap-1 cursor-pointer justify-end ${isDark ? 'hover:text-white' : 'hover:text-slate-900'}`}>
                                    Ganho/Perda <ArrowUpDown className="h-3 w-3 opacity-60" />
                                  </span>
                                </th>
                                <th className="px-3 py-3 text-right">
                                  <span className={`inline-flex items-center gap-1 cursor-pointer justify-end ${isDark ? 'hover:text-white' : 'hover:text-slate-900'}`}>
                                    Saldo <ArrowUpDown className="h-3 w-3 opacity-60" />
                                  </span>
                                </th>
                                <th className="px-3 py-3 text-center">
                                  <span className="inline-flex items-center justify-center gap-0.5">
                                    % Carteira <HelpCircle className="h-3 w-3 opacity-60" />
                                  </span>
                                </th>
                                <th className="pr-4 sm:pr-5 pl-2 py-3 text-right font-medium">Opções</th>
                              </tr>
                            </thead>
                            <tbody className={`divide-y ${isDark ? 'divide-slate-800/80' : 'divide-slate-100'}`}>
                              {consolidatedGroup.map((inv) => {
                                const isCrypto =
                                  inv.asset_type === 'CRYPTO' ||
                                  inv.institution === 'Binance' ||
                                  ['BTC', 'ETH', 'SOL', 'ONDO', 'SXT', 'LINK', 'RENDER', 'ROSE', 'VIRTUAL', 'XRP', 'ADA', 'DOGE', 'PEPE', 'TAO', 'XLM', 'BNB', 'AVAX'].includes(inv.code_ticker?.toUpperCase() || '');

                                const nativeCurr = getNativeCurrency(inv);

                                let avgPrice = inv.average_price || inv.current_price || 0;
                                let curPrice = inv.current_price || inv.average_price || 0;

                                if (inv.sync_source && inv.sync_source.includes('#')) {
                                  const parts = inv.sync_source.split('#');
                                  if (parts.length >= 2) {
                                    const parsedAvg = parseFloat(parts[1]);
                                    if (!isNaN(parsedAvg) && parsedAvg > 0 && !inv.average_price) avgPrice = parsedAvg;
                                  }
                                  if (parts.length >= 3) {
                                    const parsedCur = parseFloat(parts[2]);
                                    if ((!inv.current_price || inv.current_price === 0) && !isNaN(parsedCur) && parsedCur > 0) {
                                      curPrice = parsedCur;
                                    }
                                  }
                                }

                                if (isCrypto && inv.currency === 'BRL') {
                                  avgPrice = avgPrice * (rates['usd'] ?? 0.1818);
                                  curPrice = curPrice * (rates['usd'] ?? 0.1818);
                                }

                                const totalVal = inv.quantity > 0 ? inv.quantity * curPrice : (inv.total_value || 0);
                                const totalValBrl = convertAmount(totalVal, nativeCurr, 'BRL', rates);
                                const totalInvested = inv.quantity > 0 ? inv.quantity * avgPrice : totalVal;
                                const profitLoss = totalVal - totalInvested;
                                const varPct = avgPrice > 0 ? ((curPrice - avgPrice) / avgPrice) * 100 : 0;
                                const pctCarteira = totalPortfolioVal > 0 ? (totalValBrl / totalPortfolioVal) * 100 : 0;

                                const isOptionOpen = openOptionMenuId === inv.id;

                                const isCaixinha =
                                  inv.code_ticker?.toUpperCase().includes('WISE') ||
                                  inv.name?.toUpperCase().includes('WISE') ||
                                  inv.name?.toUpperCase().includes('CAIXINHA') ||
                                  inv.institution?.toUpperCase().includes('WISE');

                                const displayName = (isCrypto || inv.asset_type === 'STOCK' || inv.asset_type === 'FII')
                                  ? (inv.code_ticker || inv.name)
                                  : (inv.name || inv.code_ticker);

                                return (
                                  <tr
                                    key={inv.id}
                                    onDoubleClick={() => {
                                      setSellingInvestment(inv);
                                      setSellModalInitialTab('SELL');
                                    }}
                                    className={`transition-colors cursor-pointer select-none border-b ${
                                      isDark ? 'border-slate-800/80 hover:bg-slate-800/40' : 'border-slate-100 hover:bg-slate-50/70'
                                    }`}
                                    title={isCaixinha ? "Dê 2 cliques para resgatar ou editar esta caixinha" : "Dê 2 cliques para vender ou editar este ativo"}
                                  >
                                    {/* Ativo com Foto Real + Nome / Ticker + Banco/Corretora */}
                                    <td className="pl-4 sm:pl-5 pr-2 py-3">
                                      <div className="flex items-center gap-3">
                                        <AssetLogo
                                          ticker={inv.code_ticker}
                                          name={inv.name}
                                          institution={inv.institution}
                                          assetType={inv.asset_type}
                                          sizeClassName="h-7 w-7 sm:h-8 sm:w-8"
                                        />
                                        <div className="min-w-0">
                                          <div className={`font-bold text-sm sm:text-[14.5px] truncate flex items-center gap-1.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                            <span className="truncate">{displayName}</span>
                                            {isCaixinha && (
                                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shrink-0">
                                                <Wallet className="h-2.5 w-2.5 text-emerald-400" />
                                                Caixinha
                                              </span>
                                            )}
                                            {inv.yield_rate !== undefined && inv.yield_rate > 0 && (
                                              <span
                                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20 shrink-0"
                                                title={`Rendimento automático de ${inv.yield_rate}% ${inv.yield_frequency === 'ANNUAL' ? 'ao ano (~' + (inv.yield_rate / 12).toFixed(2) + '% a.m.)' : 'ao mês'} somado todo dia 1º`}
                                              >
                                                <Zap className="h-2.5 w-2.5 fill-amber-500/30" />
                                                <span>{inv.yield_rate}% {inv.yield_frequency === 'ANNUAL' ? 'a.a.' : 'a.m.'}</span>
                                              </span>
                                            )}
                                          </div>
                                          {/* Banco / Corretora onde comprou as ações/ativos */}
                                          <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className={`text-xs font-medium truncate ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                              {inv.institution || 'Geral'}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    </td>

                                    {/* Quant. */}
                                    <td className={`px-3 py-3 text-right text-xs sm:text-[13.5px] font-medium tabular-nums ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                                      {inv.quantity.toLocaleString('pt-BR', { minimumFractionDigits: isCaixinha ? 2 : 0, maximumFractionDigits: isCrypto ? 8 : 4 })}
                                    </td>

                                    {/* Preço Médio */}
                                    <td className={`px-3 py-3 text-right text-xs sm:text-[13.5px] font-medium tabular-nums ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                                      {isCaixinha ? '1,00' : formatAssetValue(avgPrice, inv, true, activeCategoryCurr)}
                                    </td>

                                    {/* Preço Atual com Lápis de Edição Rápida */}
                                    <td className={`px-3 py-3 text-right text-xs sm:text-[13.5px] font-medium tabular-nums ${isDark ? 'text-slate-200' : 'text-slate-700'}`}>
                                      <span className="inline-flex items-center justify-end gap-1.5">
                                        <span>{isCaixinha ? '1,00' : formatAssetValue(curPrice, inv, true, activeCategoryCurr)}</span>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSellingInvestment(inv);
                                            setSellModalInitialTab('EDIT');
                                          }}
                                          className={`transition-colors p-1 rounded ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-400 hover:text-slate-800'}`}
                                          title={isCaixinha ? "Editar saldo / dados da caixinha" : "Editar dados do ativo"}
                                        >
                                          <Edit2 className="h-3 w-3" />
                                        </button>
                                      </span>
                                    </td>

                                    {/* Variação */}
                                    <td className="px-3 py-3 text-right text-xs sm:text-[13.5px] tabular-nums">
                                      {isCaixinha ? (
                                        inv.yield_rate !== undefined && inv.yield_rate > 0 ? (
                                          <span
                                            className="font-bold text-amber-500 inline-flex items-center gap-0.5 justify-end"
                                            title={`Rendimento configurado: ${inv.yield_rate}% ${inv.yield_frequency === 'ANNUAL' ? 'ao ano (~' + (inv.yield_rate / 12).toFixed(2) + '% a.m.)' : 'ao mês'}`}
                                          >
                                            <Zap className="h-2.5 w-2.5 fill-amber-500/30" />
                                            +{inv.yield_rate}% {inv.yield_frequency === 'ANNUAL' ? 'a.a.' : 'a.m.'}
                                          </span>
                                        ) : (
                                          <span className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                            Estável (1:1)
                                          </span>
                                        )
                                      ) : (
                                        <span className={`font-bold inline-flex items-center gap-0.5 justify-end ${
                                          varPct >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
                                        }`}>
                                          {varPct >= 0 ? '+' : ''}{varPct.toFixed(2)}% {varPct >= 0 ? '▲' : '▼'}
                                        </span>
                                      )}
                                    </td>

                                    {/* Ganho / Perda */}
                                    <td className="px-3 py-3 text-right text-xs sm:text-[13.5px] tabular-nums">
                                      {isCaixinha ? (
                                        profitLoss > 0 ? (
                                          <span className="font-bold text-emerald-500 inline-flex items-center gap-0.5 justify-end">
                                            +{formatAssetValue(profitLoss, inv, false, activeCategoryCurr)}
                                          </span>
                                        ) : (
                                          <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                            -
                                          </span>
                                        )
                                      ) : (
                                        <span className={`font-bold inline-flex items-center gap-0.5 justify-end ${
                                          profitLoss >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
                                        }`}>
                                          {profitLoss > 0
                                            ? `+${formatAssetValue(profitLoss, inv, false, activeCategoryCurr)}`
                                            : formatAssetValue(profitLoss, inv, false, activeCategoryCurr)}
                                        </span>
                                      )}
                                    </td>

                                    {/* Saldo */}
                                    <td className={`px-3 py-3 text-right font-bold text-sm sm:text-[15px] tabular-nums ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                      {formatAssetValue(totalVal, inv, false, activeCategoryCurr)}
                                    </td>

                                    {/* % Carteira */}
                                    <td className={`px-3 py-3 text-center text-xs sm:text-[13.5px] font-medium tabular-nums ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                      {pctCarteira.toFixed(2)}%
                                    </td>

                                    {/* Opções com Botão Direto de Vender e (...) */}
                                    <td
                                      className="pr-4 sm:pr-5 pl-2 py-3 text-right relative"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <div className="inline-flex items-center justify-end gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => setOpenOptionMenuId(isOptionOpen ? null : inv.id)}
                                          className={`p-1 rounded transition-colors ${
                                            isDark ? 'text-slate-400 hover:text-white hover:bg-slate-800' : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
                                          }`}
                                          title="Mais opções"
                                        >
                                          <MoreHorizontal className="h-4 w-4" />
                                        </button>
                                      </div>

                                      {isOptionOpen && (
                                        <div className={`absolute right-4 top-8 w-44 rounded-xl border p-1.5 z-50 text-left space-y-0.5 animate-fade-in ${
                                          isDark ? 'bg-[#1F2937] border-slate-700 text-slate-200 shadow-2xl' : 'bg-white border-slate-100 text-slate-700 shadow-xl'
                                        }`}>
                                          <button
                                            onClick={() => {
                                              setOpenOptionMenuId(null);
                                              setSelectedAssetTypeForAdd(inv.asset_type || 'STOCK');
                                              setEditingInvestment(inv);
                                              setShowAddModal(true);
                                            }}
                                            className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                                              isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-50'
                                            }`}
                                          >
                                            <Edit2 className="h-3.5 w-3.5 text-slate-400" />
                                            <span>Editar Ativo</span>
                                          </button>
                                          {inv.yield_rate !== undefined && inv.yield_rate > 0 && (
                                            <button
                                              onClick={async () => {
                                                setOpenOptionMenuId(null);
                                                try {
                                                  const res = await api.applyYieldForAsset(inv.id);
                                                  if (res.results && res.results.length > 0) {
                                                    const r = res.results[0];
                                                    notify(`Rendimento aplicado! +${r.yieldAmount} ${r.currency} somado à quantidade (Novo saldo: ${r.newQuantity}).`, 'success');
                                                    await fetchInvestments();
                                                  } else {
                                                    notify('O rendimento deste mês já foi aplicado anteriormente.', 'info');
                                                  }
                                                } catch (err: any) {
                                                  notify(err.message || 'Erro ao aplicar rendimento.', 'error');
                                                }
                                              }}
                                              className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                                                isDark ? 'text-amber-400 hover:bg-slate-800 font-medium' : 'text-amber-600 hover:bg-slate-50 font-medium'
                                              }`}
                                            >
                                              <Zap className="h-3.5 w-3.5 text-amber-500" />
                                              <span>Aplicar Rendimento</span>
                                            </button>
                                          )}
                                          <button
                                            onClick={() => {
                                              setOpenOptionMenuId(null);
                                              setSellingInvestment(inv);
                                            }}
                                            className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                                              isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-700 hover:bg-slate-50'
                                            }`}
                                          >
                                            <ArrowUpRight className="h-3.5 w-3.5 text-rose-500" />
                                            <span>Vender Ativo</span>
                                          </button>
                                          <div className={`border-t my-1 ${isDark ? 'border-slate-700' : 'border-slate-100'}`} />
                                          <button
                                            onClick={() => {
                                              setOpenOptionMenuId(null);
                                              handleDelete(inv.id, inv.code_ticker);
                                            }}
                                            className={`w-full flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-rose-500 transition-colors ${
                                              isDark ? 'hover:bg-rose-500/10' : 'hover:bg-rose-50'
                                            }`}
                                          >
                                            <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                                            <span>Excluir Ativo</span>
                                          </button>
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>

                          {/* Barra Inferior da Categoria Idêntica ao Investidor 10 */}
                          <div className={`flex flex-wrap items-center justify-between gap-2.5 px-4 sm:px-5 py-2.5 border-t transition-colors ${
                            isDark ? 'bg-[#111827] border-slate-800' : 'bg-white border-slate-100'
                          }`}>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => setSearchParams({ tab: 'TRADES' })}
                                className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors ${
                                  isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                <span>Lançamentos</span>
                                <Clock className="h-3 w-3 text-slate-400" />
                              </button>

                              <div className={`h-3.5 w-px ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

                              {/* Seletor Rápido de Moeda da Tabela */}
                              <div className="flex items-center gap-1">
                                <span className={`text-[10px] font-medium hidden sm:inline ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                                  Moeda:
                                </span>
                                {(['AUTO', 'BRL', 'USD', 'EUR'] as const).map((curr) => {
                                  const isSelected = activeCategoryCurr === curr;
                                  const label = curr === 'AUTO' ? (categoryKey === 'CRYPTO' ? 'USD (Padrão)' : 'BRL (Padrão)') : curr;
                                  return (
                                    <button
                                      key={curr}
                                      type="button"
                                      onClick={() => updateCategoryCurrency(categoryKey, curr as Currency | 'AUTO')}
                                      className={`px-1.5 py-0.5 text-[10px] font-semibold rounded transition-all ${
                                        isSelected
                                          ? isDark
                                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs'
                                          : isDark
                                            ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                                      }`}
                                    >
                                      {label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setSearchParams({ tab: 'OVERVIEW' })}
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                                  isDark
                                    ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <BarChart3 className="h-3.5 w-3.5 text-slate-400" />
                                <span>Gráficos</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => notify('Colunas configuradas conforme padrão Investidor 10.', 'info')}
                                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                                  isDark
                                    ? 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700'
                                    : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                <FileSpreadsheet className="h-3.5 w-3.5 text-slate-400" />
                                <span>Editar colunas</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenAddModal(addModalAssetType)}
                                className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all shadow-sm ${
                                  isDark
                                    ? 'bg-white hover:bg-slate-100 text-slate-950 font-bold'
                                    : 'bg-[#18181B] hover:bg-black text-white'
                                }`}
                              >
                                <Plus className="h-3.5 w-3.5" />
                                <span>Adicionar Lançamento</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          )
        )}
      </div>
      )}

      {/* Modais do Sistema */}
      <BinanceHistoryModal
        open={showHistoryModal}
        onClose={() => setShowHistoryModal(false)}
      />

      <ImportB3Modal
        open={showB3Modal}
        onClose={() => setShowB3Modal(false)}
        onSuccess={fetchInvestments}
      />

      <AddInvestmentModal
        open={showAddModal}
        investmentToEdit={editingInvestment}
        initialAssetType={selectedAssetTypeForAdd}
        onClose={() => {
          setShowAddModal(false);
          setEditingInvestment(null);
        }}
        onSuccess={fetchInvestments}
      />

      <SellInvestmentModal
        open={!!sellingInvestment || showSellModal}
        investment={sellingInvestment}
        availableInvestments={investments}
        initialTab={sellModalInitialTab}
        onClose={() => {
          setSellingInvestment(null);
          setShowSellModal(false);
          setSellModalInitialTab('SELL');
        }}
        onSuccess={fetchInvestments}
      />

      <EditTradeModal
        open={!!editingTrade}
        trade={editingTrade}
        onClose={() => setEditingTrade(null)}
        onSuccess={fetchInvestments}
      />

      {editingRealizedOp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-bg-card p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-accent-gold" />
                <h3 className="text-base font-bold text-text-primary">
                  Data da Venda: {editingRealizedOp.ticker}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingRealizedOp(null)}
                className="text-text-secondary hover:text-text-primary transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-text-secondary mb-4 leading-relaxed">
              Informe a data real em que a operação de <strong>{editingRealizedOp.ticker}</strong> foi encerrada/vendida para posicioná-la no mês e ano corretos.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1.5">
                  Data de Encerramento (DD/MM/AAAA)
                </label>
                <input
                  type="date"
                  value={realizedOpNewDate}
                  onChange={(e) => setRealizedOpNewDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-bg-primary px-3.5 py-2.5 text-sm font-medium text-text-primary focus:border-accent-gold focus:outline-none cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingRealizedOp(null)}
                  disabled={savingRealizedDate}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg text-text-secondary hover:text-text-primary transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!realizedOpNewDate) {
                      notify('Selecione uma data.', 'error');
                      return;
                    }
                    setSavingRealizedDate(true);
                    try {
                      await api.updateRealizedOperationDate(editingRealizedOp.id, realizedOpNewDate);
                      notify(`Data de encerramento de ${editingRealizedOp.ticker} atualizada com sucesso!`, 'success');
                      setEditingRealizedOp(null);
                      await fetchInvestments();
                    } catch (err: any) {
                      notify(err?.message || 'Falha ao salvar data.', 'error');
                    } finally {
                      setSavingRealizedDate(false);
                    }
                  }}
                  disabled={savingRealizedDate}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-lg bg-accent-gold text-slate-950 hover:bg-accent-gold/90 transition-all shadow-sm disabled:opacity-50"
                >
                  {savingRealizedDate ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Salvar Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
