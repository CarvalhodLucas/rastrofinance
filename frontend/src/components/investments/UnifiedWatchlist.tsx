import { useState, useEffect, useMemo, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Search,
  Plus,
  Trash2,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Sparkles,
  Building2,
  Coins,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Bell,
  BellRing,
  Check,
  GripVertical,
  Star,
  Wallet,
} from 'lucide-react';
import { AssetLogo } from '@/components/investments/AssetLogo';
import { WatchlistSparkline } from '@/components/investments/WatchlistSparkline';
import { SellInvestmentModal } from '@/components/investments/SellInvestmentModal';
import { api } from '@/services/api';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/contexts/AuthContext';
import type {
  PriceAlert,
  WatchlistPeriod,
  WatchlistQuoteResult,
  WatchlistResponse,
  Investment,
  WatchlistItem,
} from '@/types/finance';
import rastroAssets from '@/data/assetsDatabase.json';

export type WatchlistListTab = 'CUSTOM' | 'MY_B3' | 'MY_CRYPTO';
type FilterType = 'ALL' | 'STOCK' | 'CRYPTO' | 'GAINERS' | 'LOSERS';
type PillMode = 'percent' | 'amount' | 'cap';
type ViewMode = 'list' | 'grid';

const POPULAR_CRYPTOS = [
  { ticker: 'BTC', name: 'Bitcoin', type: 'CRYPTO' as const },
  { ticker: 'ETH', name: 'Ethereum', type: 'CRYPTO' as const },
  { ticker: 'SOL', name: 'Solana', type: 'CRYPTO' as const },
  { ticker: 'BNB', name: 'BNB', type: 'CRYPTO' as const },
  { ticker: 'XRP', name: 'XRP', type: 'CRYPTO' as const },
  { ticker: 'RENDER', name: 'Render', type: 'CRYPTO' as const },
  { ticker: 'ADA', name: 'Cardano', type: 'CRYPTO' as const },
  { ticker: 'DOGE', name: 'Dogecoin', type: 'CRYPTO' as const },
  { ticker: 'AVAX', name: 'Avalanche', type: 'CRYPTO' as const },
  { ticker: 'DOT', name: 'Polkadot', type: 'CRYPTO' as const },
  { ticker: 'LINK', name: 'ChainLink', type: 'CRYPTO' as const },
  { ticker: 'NEAR', name: 'NEAR Protocol', type: 'CRYPTO' as const },
  { ticker: 'SUI', name: 'Sui', type: 'CRYPTO' as const },
  { ticker: 'PEPE', name: 'Pepe', type: 'CRYPTO' as const },
  { ticker: 'SHIB', name: 'Shiba Inu', type: 'CRYPTO' as const },
  { ticker: 'ONDO', name: 'Ondo', type: 'CRYPTO' as const },
  { ticker: 'ROSE', name: 'Oasis Network', type: 'CRYPTO' as const },
  { ticker: 'VIRTUAL', name: 'Virtuals Protocol', type: 'CRYPTO' as const },
  { ticker: 'MATIC', name: 'Polygon', type: 'CRYPTO' as const },
  { ticker: 'LTC', name: 'Litecoin', type: 'CRYPTO' as const },
  { ticker: 'UNI', name: 'Uniswap', type: 'CRYPTO' as const },
  { ticker: 'ATOM', name: 'Cosmos', type: 'CRYPTO' as const },
  { ticker: 'APT', name: 'Aptos', type: 'CRYPTO' as const },
  { ticker: 'ARB', name: 'Arbitrum', type: 'CRYPTO' as const },
  { ticker: 'OP', name: 'Optimism', type: 'CRYPTO' as const },
  { ticker: 'FET', name: 'Artificial Superintelligence', type: 'CRYPTO' as const },
  { ticker: 'TAO', name: 'Bittensor', type: 'CRYPTO' as const },
  { ticker: 'ICP', name: 'Internet Computer', type: 'CRYPTO' as const },
  { ticker: 'TRX', name: 'TRON', type: 'CRYPTO' as const },
  { ticker: 'FIL', name: 'Filecoin', type: 'CRYPTO' as const },
  { ticker: 'INJ', name: 'Injective', type: 'CRYPTO' as const },
  { ticker: 'AAVE', name: 'Aave', type: 'CRYPTO' as const },
  { ticker: 'MKR', name: 'Maker', type: 'CRYPTO' as const },
  { ticker: 'RUNE', name: 'THORChain', type: 'CRYPTO' as const },
  { ticker: 'TIA', name: 'Celestia', type: 'CRYPTO' as const },
  { ticker: 'SEI', name: 'Sei', type: 'CRYPTO' as const },
  { ticker: 'FLOKI', name: 'Floki', type: 'CRYPTO' as const },
  { ticker: 'BONK', name: 'Bonk', type: 'CRYPTO' as const },
  { ticker: 'WIF', name: 'dogwifhat', type: 'CRYPTO' as const },
];

const SUGGESTED_B3 = [
  { ticker: 'PETR4.SA', name: 'Petrobras', type: 'STOCK' as const },
  { ticker: 'VALE3.SA', name: 'Vale S.A.', type: 'STOCK' as const },
  { ticker: 'WEGE3.SA', name: 'WEG S.A.', type: 'STOCK' as const },
  { ticker: 'BBAS3.SA', name: 'Banco do Brasil', type: 'STOCK' as const },
  { ticker: 'CXSE3.SA', name: 'Caixa Seguridade', type: 'STOCK' as const },
  { ticker: 'KLBN11.SA', name: 'Klabin', type: 'STOCK' as const },
  { ticker: 'ITSA4.SA', name: 'Itaúsa', type: 'STOCK' as const },
];

const SUGGESTED_CRYPTO = [
  { ticker: 'BTC', name: 'Bitcoin', type: 'CRYPTO' as const },
  { ticker: 'ETH', name: 'Ethereum', type: 'CRYPTO' as const },
  { ticker: 'SOL', name: 'Solana', type: 'CRYPTO' as const },
  { ticker: 'RENDER', name: 'Render', type: 'CRYPTO' as const },
  { ticker: 'XRP', name: 'XRP', type: 'CRYPTO' as const },
  { ticker: 'LINK', name: 'ChainLink', type: 'CRYPTO' as const },
  { ticker: 'ONDO', name: 'Ondo', type: 'CRYPTO' as const },
];

export interface EnrichedWatchlistItem extends WatchlistQuoteResult {
  uniqueId: string;
  inWatchlist: boolean;
  portfolio?: {
    id?: string;
    quantity: number;
    averagePrice: number;
    totalInvested: number;
    currentValue: number;
    profitLoss: number;
    profitLossPct: number;
    institution: string;
  };
}

export function UnifiedWatchlist() {
  const { notify } = useToast();
  const { user } = useAuth();
  const cacheKey = user?.id ? `rastro_watchlist_cache_${user.id}` : 'rastro_watchlist_cache_anon';

  const [listTab, setListTab] = useState<WatchlistListTab>(() => {
    try {
      const saved = localStorage.getItem('rastro_watchlist_list_tab');
      if (saved === 'CUSTOM' || saved === 'MY_B3' || saved === 'MY_CRYPTO') return saved;
    } catch {}
    return 'CUSTOM';
  });

  const [investments, setInvestments] = useState<Investment[]>([]);
  const [portfolioQuotes, setPortfolioQuotes] = useState<Map<string, WatchlistQuoteResult>>(new Map());
  const [portfolioLoading, setPortfolioLoading] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem('rastro_watchlist_list_tab', listTab);
    } catch {}
  }, [listTab]);

  const [data, setData] = useState<WatchlistResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [pillMode, setPillMode] = useState<PillMode>('percent');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedPeriod, setSelectedPeriod] = useState<WatchlistPeriod>('1D');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Fecha dropdown de busca ao clicar fora
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Modais de Adicionar Ativo
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTickerInput, setNewTickerInput] = useState('');
  const [newTickerType, setNewTickerType] = useState<'STOCK' | 'CRYPTO'>('STOCK');
  const [addingTicker, setAddingTicker] = useState(false);

  // Modais e Estados de Remoção e Drag & Drop
  const [tickerToDelete, setTickerToDelete] = useState<string | null>(null);
  const [deletingTicker, setDeletingTicker] = useState(false);
  const [sellingInvestment, setSellingInvestment] = useState<Investment | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Ordem personalizada de ativos por aba (salva no localStorage do usuário)
  const [b3Order, setB3Order] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`rastro_order_b3_${user?.id || 'default'}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [cryptoOrder, setCryptoOrder] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(`rastro_order_crypto_${user?.id || 'default'}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Sempre reseta o filtro para ALL e limpa a busca ao alternar entre as 3 abas
  useEffect(() => {
    setFilter('ALL');
    setSearchQuery('');
  }, [listTab]);

  // Modais de Alerta de Preço
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);
  const [isManageAlertsOpen, setIsManageAlertsOpen] = useState(false);
  const [selectedAssetForAlert, setSelectedAssetForAlert] = useState<WatchlistQuoteResult | null>(null);
  const [alertTargetPrice, setAlertTargetPrice] = useState('');
  const [alertCondition, setAlertCondition] = useState<'ABOVE' | 'BELOW'>('ABOVE');
  const [alertNote, setAlertNote] = useState('');
  const [savingAlert, setSavingAlert] = useState(false);
  const [alertsList, setAlertsList] = useState<PriceAlert[]>([]);

  // Filtra e remove ativos Wise ou saldo em moeda fiat que não possuem cotação de bolsa
  const isWiseOrCashAsset = (inv: Investment): boolean => {
    const inst = (inv.institution || '').toUpperCase();
    const ticker = (inv.code_ticker || '').toUpperCase();
    const name = (inv.name || '').toUpperCase();
    const assetType = (inv.asset_type || '').toUpperCase();

    return (
      inst.includes('WISE') ||
      ticker.includes('WISE') ||
      ticker.startsWith('WISE_') ||
      name.includes('WISE') ||
      assetType === 'CURRENCY' ||
      assetType === 'CASH' ||
      assetType === 'CHECKING_ACCOUNT'
    );
  };

  // Identifica títulos públicos federais do Tesouro Direto (possuem cotação e rentabilidade de custódia direta)
  const isTesouroAsset = (inv: { code_ticker?: string; name?: string; asset_type?: string }): boolean => {
    const ticker = (inv.code_ticker || '').toUpperCase();
    const name = (inv.name || '').toUpperCase();
    return (
      ticker.includes('TESOURO') ||
      ticker.includes('RENDA+') ||
      ticker.startsWith('LTN') ||
      ticker.startsWith('NTN') ||
      ticker.startsWith('LFT') ||
      name.includes('TESOURO') ||
      name.includes('RENDA+')
    );
  };

  // Carrega os investimentos do usuário e busca cotações em tempo real para eles
  const loadPortfolio = async () => {
    try {
      setPortfolioLoading(true);
      const res = await api.getInvestments();
      const active = (res?.investments || []).filter(
        (i) =>
          (i.quantity || 0) > 0 &&
          i.sync_source !== 'GORILA_CLOSED' &&
          !isWiseOrCashAsset(i),
      );
      setInvestments(active);

      const itemsToQuote: WatchlistItem[] = [];
      for (const inv of active) {
        const isCrypto = inv.asset_type === 'CRYPTO' || inv.institution?.toUpperCase() === 'BINANCE';
        const cleanTicker = inv.code_ticker?.trim().toUpperCase();
        if (!cleanTicker) continue;
        if (isCrypto) {
          itemsToQuote.push({ ticker: cleanTicker, type: 'CRYPTO', name: inv.name });
        } else if (isTesouroAsset(inv)) {
          // Títulos públicos do Tesouro Direto são precificados via custódia oficial e não devem ser enviados para API de ações
          continue;
        } else {
          const formatted =
            !cleanTicker.includes('.') && !cleanTicker.includes('-')
              ? `${cleanTicker}.SA`
              : cleanTicker;
          itemsToQuote.push({ ticker: formatted, type: 'STOCK', name: inv.name });
        }
      }

      if (itemsToQuote.length > 0) {
        const quotesRes = await api.getBatchQuotes(itemsToQuote);
        if (quotesRes?.items) {
          const qMap = new Map<string, WatchlistQuoteResult>();
          for (const q of quotesRes.items) {
            qMap.set(q.ticker.toUpperCase(), q);
            qMap.set(q.ticker.replace(/\.SA$/, '').toUpperCase(), q);
          }
          setPortfolioQuotes(qMap);
        }
      }
    } catch (err) {
      console.warn('[Watchlist] Erro ao carregar carteira:', err);
    } finally {
      setPortfolioLoading(false);
    }
  };

  // Carrega os dados da watchlist
  const loadWatchlist = async (bypassCache = false) => {
    try {
      if (bypassCache) setRefreshing(true);
      const res = await api.getWatchlist(bypassCache);
      setData(res);
      if (res.alerts) setAlertsList(res.alerts);

      // Notifica se houver alertas recém-disparados
      if (res.triggeredAlerts && res.triggeredAlerts.length > 0) {
        for (const t of res.triggeredAlerts) {
          const sym = t.currency === 'USD' ? '$' : 'R$';
          notify(
            `🚨 ALERTA: ${t.ticker} atingiu ${sym} ${t.lastCheckedPrice?.toFixed(2)} (Alvo: ${sym} ${t.targetPrice.toFixed(2)})!`,
            'info',
          );
        }
      }

      localStorage.setItem(cacheKey, JSON.stringify(res));
    } catch (err: any) {
      console.error('Erro ao carregar watchlist:', err);
      const local = localStorage.getItem(cacheKey);
      if (local && !data) {
        try {
          setData(JSON.parse(local));
        } catch {}
      }
      if (bypassCache) {
        notify('Não foi possível atualizar as cotações agora.', 'error');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefreshAll = async () => {
    await Promise.all([loadWatchlist(true), loadPortfolio()]);
    notify('Cotações e carteira atualizadas!', 'success');
  };

  useEffect(() => {
    setData(null);
    const local = localStorage.getItem(cacheKey);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        setData(parsed);
        if (parsed.alerts) setAlertsList(parsed.alerts);
        setLoading(false);
      } catch {}
    } else {
      setLoading(true);
    }
    void loadWatchlist(false);
    void loadPortfolio();
  }, [user?.id, cacheKey]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      void loadWatchlist(false);
      void loadPortfolio();
    }, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  const handleTogglePillMode = () => {
    setPillMode((prev) => {
      if (prev === 'percent') return 'amount';
      if (prev === 'amount') return 'cap';
      return 'percent';
    });
  };

  const handleAddTicker = async (tickerToAdd?: string, typeToAdd?: 'STOCK' | 'CRYPTO') => {
    const raw = (tickerToAdd || newTickerInput).trim().toUpperCase();
    if (!raw) return;

    setAddingTicker(true);
    try {
      const type = typeToAdd || newTickerType;
      const formattedTicker =
        type === 'STOCK' && !raw.includes('.') && !raw.includes('-') ? `${raw}.SA` : raw;

      const res = await api.addWatchlistItem({
        ticker: formattedTicker,
        type,
      });

      if (res.data) {
        setData(res.data);
        if (res.data.alerts) setAlertsList(res.data.alerts);
        localStorage.setItem(cacheKey, JSON.stringify(res.data));
      }
      notify(`Ativo ${formattedTicker} adicionado com sucesso!`, 'success');
      setNewTickerInput('');
      setIsAddModalOpen(false);
      setShowSearchDropdown(false);
      setSearchQuery('');
    } catch (err: any) {
      notify(err.message || 'Erro ao adicionar ativo.', 'error');
    } finally {
      setAddingTicker(false);
    }
  };

  const handleRemoveTicker = async (tickerToRemove: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setDeletingTicker(true);
    try {
      const res = await api.removeWatchlistItem(tickerToRemove);
      if (res.data) {
        setData(res.data);
        if (res.data.alerts) setAlertsList(res.data.alerts);
        localStorage.setItem(cacheKey, JSON.stringify(res.data));
      }
      notify(`${tickerToRemove} removido da lista.`, 'info');
      setTickerToDelete(null);
    } catch (err: any) {
      notify(err.message || 'Erro ao remover ativo.', 'error');
    } finally {
      setDeletingTicker(false);
    }
  };

  // Drag and Drop: Início do arrasto
  const handleDragStart = (id: string, e: React.DragEvent) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
  };

  // Drag and Drop: Passando por cima de outro ativo
  const handleDragOver = (id: string, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverId !== id) {
      setDragOverId(id);
    }
  };

  // Drag and Drop: Fim do arrasto
  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverId(null);
  };

  // Drag and Drop: Soltar para aplicar a nova ordem
  const handleDrop = async (targetId: string, e: React.DragEvent) => {
    e.preventDefault();
    const sourceId = draggedId || e.dataTransfer.getData('text/plain');
    if (!sourceId || sourceId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }

    if (listTab === 'CUSTOM') {
      if (!data?.items) {
        setDraggedId(null);
        setDragOverId(null);
        return;
      }

      const items = [...data.items];
      const sourceIndex = items.findIndex((it) => it.ticker === sourceId);
      const targetIndex = items.findIndex((it) => it.ticker === targetId);

      if (sourceIndex === -1 || targetIndex === -1) {
        setDraggedId(null);
        setDragOverId(null);
        return;
      }

      // Move o item de sourceIndex para targetIndex
      const [moved] = items.splice(sourceIndex, 1);
      items.splice(targetIndex, 0, moved);

      // Atualização otimista imediata na interface
      const updatedData: WatchlistResponse = { ...data, items };
      setData(updatedData);
      localStorage.setItem(cacheKey, JSON.stringify(updatedData));
      setDraggedId(null);
      setDragOverId(null);

      // Persiste no backend
      try {
        const minimalPayload = items.map((it) => ({
          ticker: it.ticker,
          type: it.type,
          name: it.name,
        }));
        await api.saveWatchlist(minimalPayload);
        notify('Ordem dos ativos atualizada!', 'success');
      } catch (err: any) {
        console.error('Erro ao salvar nova ordem:', err);
        notify('Não foi possível salvar a nova ordem no servidor.', 'error');
      }
    } else if (listTab === 'MY_B3') {
      const currentIds = currentBaseItems.map((i) => i.uniqueId);
      const sourceIndex = currentIds.indexOf(sourceId);
      const targetIndex = currentIds.indexOf(targetId);

      if (sourceIndex !== -1 && targetIndex !== -1) {
        const newOrder = [...currentIds];
        const [moved] = newOrder.splice(sourceIndex, 1);
        newOrder.splice(targetIndex, 0, moved);
        setB3Order(newOrder);
        localStorage.setItem(`rastro_order_b3_${user?.id || 'default'}`, JSON.stringify(newOrder));
        notify('Ordem dos ativos B3 atualizada!', 'success');
      }
      setDraggedId(null);
      setDragOverId(null);
    } else if (listTab === 'MY_CRYPTO') {
      const currentIds = currentBaseItems.map((i) => i.uniqueId);
      const sourceIndex = currentIds.indexOf(sourceId);
      const targetIndex = currentIds.indexOf(targetId);

      if (sourceIndex !== -1 && targetIndex !== -1) {
        const newOrder = [...currentIds];
        const [moved] = newOrder.splice(sourceIndex, 1);
        newOrder.splice(targetIndex, 0, moved);
        setCryptoOrder(newOrder);
        localStorage.setItem(`rastro_order_crypto_${user?.id || 'default'}`, JSON.stringify(newOrder));
        notify('Ordem das criptos atualizada!', 'success');
      }
      setDraggedId(null);
      setDragOverId(null);
    }
  };

  // Abrir Modal de Criação de Alerta para um ativo
  const handleOpenCreateAlert = (item: WatchlistQuoteResult, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedAssetForAlert(item);
    setAlertTargetPrice(item.price ? item.price.toString() : '');
    setAlertCondition('ABOVE');
    setAlertNote('');
    setIsAlertModalOpen(true);
  };

  // Salvar novo alerta
  const handleSaveAlert = async () => {
    if (!selectedAssetForAlert || !alertTargetPrice) return;
    const priceNum = parseFloat(alertTargetPrice.replace(',', '.'));
    if (isNaN(priceNum) || priceNum <= 0) {
      notify('Por favor, informe um preço alvo válido.', 'error');
      return;
    }

    setSavingAlert(true);
    try {
      const res = await api.createPriceAlert({
        ticker: selectedAssetForAlert.ticker,
        targetPrice: priceNum,
        condition: alertCondition,
        currency: selectedAssetForAlert.currency,
        note: alertNote.trim() || undefined,
      });

      if (res.ok) {
        notify(`Alerta de preço salvo para ${selectedAssetForAlert.ticker}!`, 'success');
        setIsAlertModalOpen(false);
        // Atualiza lista de alertas
        const updated = await api.getPriceAlerts();
        setAlertsList(updated.alerts || []);
      }
    } catch (err: any) {
      notify(err.message || 'Falha ao salvar alerta.', 'error');
    } finally {
      setSavingAlert(false);
    }
  };

  // Deletar alerta
  const handleDeleteAlert = async (alertId: string) => {
    try {
      await api.deletePriceAlert(alertId);
      setAlertsList((prev) => prev.filter((a) => a.id !== alertId));
      notify('Alerta de preço excluído.', 'info');
    } catch (err: any) {
      notify(err.message || 'Erro ao excluir alerta.', 'error');
    }
  };

  // Mapa de alertas ativos por ticker
  const activeAlertsByTicker = useMemo(() => {
    const map = new Map<string, PriceAlert[]>();
    for (const a of alertsList) {
      const clean = a.ticker.replace(/\.SA$/, '').toUpperCase();
      const list = map.get(clean) || [];
      list.push(a);
      map.set(clean, list);
    }
    return map;
  }, [alertsList]);

  // Conjunto de tickers já presentes na Watchlist
  const existingTickersSet = useMemo(() => {
    const set = new Set<string>();
    for (const item of data?.items || []) {
      set.add(item.ticker.toUpperCase());
      set.add(item.ticker.replace(/\.SA$/, '').toUpperCase());
    }
    return set;
  }, [data?.items]);

  // Sugestões de autocomplete baseadas em searchQuery
  const searchSuggestions = useMemo(() => {
    const q = searchQuery.trim().toUpperCase();
    if (!q) return [];

    const results: Array<{
      ticker: string;
      rawTicker: string;
      name: string;
      type: 'STOCK' | 'CRYPTO';
      inWatchlist: boolean;
      score: number;
    }> = [];

    // 1. Verificar Cryptos populares
    for (const c of POPULAR_CRYPTOS) {
      const matchTicker = c.ticker.toUpperCase().includes(q);
      const matchName = c.name.toUpperCase().includes(q);
      if (matchTicker || matchName) {
        const inWatchlist = existingTickersSet.has(c.ticker.toUpperCase());
        const exact = c.ticker.toUpperCase() === q;
        const starts = c.ticker.toUpperCase().startsWith(q);
        results.push({
          ticker: c.ticker,
          rawTicker: c.ticker,
          name: c.name,
          type: 'CRYPTO',
          inWatchlist,
          score: exact ? 100 : starts ? 80 : 50,
        });
      }
    }

    // 2. Verificar B3 Assets (rastroAssets)
    for (const a of rastroAssets) {
      const cleanTicker = a.ticker.toUpperCase();
      const matchTicker = cleanTicker.includes(q);
      const matchName = (a.name || '').toUpperCase().includes(q);
      if (matchTicker || matchName) {
        const inWatchlist =
          existingTickersSet.has(cleanTicker) ||
          existingTickersSet.has(cleanTicker.replace(/\.SA$/, ''));
        const exact = cleanTicker === q;
        const starts = cleanTicker.startsWith(q);
        results.push({
          ticker: cleanTicker.endsWith('.SA') ? cleanTicker : `${cleanTicker}.SA`,
          rawTicker: cleanTicker.replace(/\.SA$/, ''),
          name: a.name || cleanTicker,
          type: 'STOCK',
          inWatchlist,
          score: exact ? 95 : starts ? 75 : 40,
        });
      }
      if (results.length >= 35) break;
    }

    // Ordenar: maior score primeiro, depois alfabético
    results.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.rawTicker.localeCompare(b.rawTicker);
    });

    return results.slice(0, 10);
  }, [searchQuery, existingTickersSet]);

  // Sugestões para o modal de Adicionar Ativo
  const modalSuggestions = useMemo(() => {
    const q = newTickerInput.trim().toUpperCase();
    if (!q) return [];
    if (newTickerType === 'CRYPTO') {
      return POPULAR_CRYPTOS.filter(
        (c) => c.ticker.toUpperCase().includes(q) || c.name.toUpperCase().includes(q),
      ).slice(0, 8);
    } else {
      return rastroAssets
        .filter(
          (a) => a.ticker.toUpperCase().includes(q) || (a.name || '').toUpperCase().includes(q),
        )
        .slice(0, 8)
        .map((a) => ({
          ticker: a.ticker.endsWith('.SA') ? a.ticker : `${a.ticker}.SA`,
          name: a.name,
          type: 'STOCK' as const,
        }));
    }
  }, [newTickerInput, newTickerType]);

  const getItemVariation = (item: WatchlistQuoteResult, period: WatchlistPeriod = selectedPeriod) => {
    if (item.variations && item.variations[period] !== undefined) {
      return item.variations[period]!;
    }
    return item.variation || '0.00';
  };

  const getItemChangeAmount = (item: WatchlistQuoteResult, period: WatchlistPeriod = selectedPeriod) => {
    if (item.changeAmounts && item.changeAmounts[period] !== undefined) {
      return item.changeAmounts[period]!;
    }
    return item.changeAmount || 0;
  };

  const getItemSparkline = (item: WatchlistQuoteResult, period: WatchlistPeriod = selectedPeriod) => {
    if (item.sparklines && item.sparklines[period] && item.sparklines[period]!.length > 0) {
      return item.sparklines[period]!;
    }
    return item.sparkline || [];
  };

  // Ativos B3 possuídos na carteira (quantidade > 0, não cripto e não Wise/moeda)
  const myB3Investments = useMemo(() => {
    return investments.filter((i) => {
      if (isWiseOrCashAsset(i)) return false;
      const isCrypto = i.asset_type === 'CRYPTO' || i.institution?.toUpperCase() === 'BINANCE';
      return !isCrypto && (i.quantity || 0) > 0;
    });
  }, [investments]);

  // Criptomoedas possuídas na carteira (não Wise/moeda)
  const myCryptoInvestments = useMemo(() => {
    return investments.filter((i) => {
      if (isWiseOrCashAsset(i)) return false;
      const isCrypto = i.asset_type === 'CRYPTO' || i.institution?.toUpperCase() === 'BINANCE';
      return isCrypto && (i.quantity || 0) > 0;
    });
  }, [investments]);

  const fallbackQuoteFromInvestment = (inv: Investment): WatchlistQuoteResult => {
    const isCrypto = inv.asset_type === 'CRYPTO' || inv.institution?.toUpperCase() === 'BINANCE';
    const isTesouro = isTesouroAsset(inv);
    const cleanTicker = (inv.code_ticker || '').trim();
    const formattedTicker =
      !isCrypto && !isTesouro && !cleanTicker.includes('.') && !cleanTicker.includes('-')
        ? `${cleanTicker.toUpperCase()}.SA`
        : cleanTicker;

    const price = inv.current_price || inv.average_price || 0;
    const avgPrice = inv.average_price || price;
    const profitPct = avgPrice > 0 && price > 0 ? ((price - avgPrice) / avgPrice) * 100 : 0;
    const changeAmt = price > 0 && avgPrice > 0 ? price - avgPrice : 0;

    let sparkline: number[] = [];
    if (isTesouro && avgPrice > 0 && price > 0) {
      sparkline = [
        Number(avgPrice.toFixed(2)),
        Number((avgPrice + (price - avgPrice) * 0.25).toFixed(2)),
        Number((avgPrice + (price - avgPrice) * 0.55).toFixed(2)),
        Number((avgPrice + (price - avgPrice) * 0.82).toFixed(2)),
        Number(price.toFixed(2)),
      ];
    } else if (price > 0) {
      sparkline = [Number((price * 0.99).toFixed(2)), Number(price.toFixed(2))];
    }

    return {
      ticker: formattedTicker,
      name: inv.name || cleanTicker,
      type: isCrypto ? 'CRYPTO' : 'STOCK',
      price,
      currency: isCrypto ? 'USD' : 'BRL',
      variation: profitPct !== 0 ? profitPct.toFixed(2) : '0.00',
      changeAmount: changeAmt,
      variations: {
        '1D': isTesouro ? '+0.04' : '0.00',
        '7D': isTesouro ? '+0.25' : '0.00',
        '30D': isTesouro ? '+1.10' : '0.00',
        '1Y': profitPct !== 0 ? profitPct.toFixed(2) : '0.00',
      },
      changeAmounts: {
        '1D': isTesouro ? 0.09 : 0,
        '7D': isTesouro ? 0.55 : 0,
        '30D': isTesouro ? 2.38 : 0,
        '1Y': changeAmt,
      },
      high24h: price,
      low24h: avgPrice < price && avgPrice > 0 ? avgPrice : price,
      volume: 0,
      marketCap: '--',
      sparkline,
      category: isCrypto ? 'Criptomoedas' : isTesouro ? 'Tesouro Direto' : 'Ações B3',
    };
  };

  // Itens base de acordo com a aba selecionada (CUSTOM, MY_B3 ou MY_CRYPTO)
  const currentBaseItems = useMemo<EnrichedWatchlistItem[]>(() => {
    if (listTab === 'CUSTOM') {
      return (data?.items || []).map((it) => {
        const clean = it.ticker.replace(/\.SA$/, '').toUpperCase();
        const invMatch = investments.find(
          (inv) => (inv.code_ticker || '').replace(/\.SA$/, '').toUpperCase() === clean,
        );
        let portfolioData: EnrichedWatchlistItem['portfolio'] | undefined;
        if (invMatch && (invMatch.quantity || 0) > 0) {
          const price = it.price || invMatch.current_price || invMatch.average_price || 0;
          const qty = invMatch.quantity || 0;
          const avgPrice = invMatch.average_price || 0;
          const totalInvested = qty * avgPrice;
          const currentValue = qty * price;
          const profitLoss = currentValue - totalInvested;
          const profitLossPct = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;
          portfolioData = {
            quantity: qty,
            averagePrice: avgPrice,
            totalInvested,
            currentValue,
            profitLoss,
            profitLossPct,
            institution: invMatch.institution || 'Carteira',
          };
        }

        return {
          ...it,
          uniqueId: it.ticker,
          inWatchlist: true,
          portfolio: portfolioData,
        };
      });
    }

    const sourceInvs = listTab === 'MY_B3' ? myB3Investments : myCryptoInvestments;

    const mappedItems: EnrichedWatchlistItem[] = sourceInvs.map((inv) => {
      const isCrypto = inv.asset_type === 'CRYPTO' || inv.institution?.toUpperCase() === 'BINANCE';
      const isTesouro = isTesouroAsset(inv);
      const clean = (inv.code_ticker || '').trim().toUpperCase();

      let quote: WatchlistQuoteResult;
      if (isTesouro) {
        quote = fallbackQuoteFromInvestment(inv);
      } else {
        const found =
          portfolioQuotes.get(clean) ||
          data?.items.find((it) => it.ticker.replace(/\.SA$/, '').toUpperCase() === clean);
        if (found && found.price > 0) {
          quote = found;
        } else {
          quote = fallbackQuoteFromInvestment(inv);
        }
      }

      const price = quote.price || inv.current_price || inv.average_price || 0;
      const quantity = inv.quantity || 0;
      const avgPrice = inv.average_price || 0;
      const totalInvested = quantity * avgPrice;
      const currentValue = quantity * price;
      const profitLoss = currentValue - totalInvested;
      const profitLossPct = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;

      const inWatchlist =
        existingTickersSet.has(clean) ||
        existingTickersSet.has(quote.ticker.toUpperCase()) ||
        existingTickersSet.has(quote.ticker.replace(/\.SA$/, '').toUpperCase());

      const uniqueId = String(inv.id || `${clean}_${inv.quantity}_${inv.average_price}`);

      return {
        ...quote,
        uniqueId,
        inWatchlist,
        portfolio: {
          id: inv.id,
          quantity,
          averagePrice: avgPrice,
          totalInvested,
          currentValue,
          profitLoss,
          profitLossPct,
          institution: inv.institution || (isCrypto ? 'Binance' : isTesouro ? 'Tesouro Direto' : 'B3'),
        },
      };
    });

    const currentOrder = listTab === 'MY_B3' ? b3Order : cryptoOrder;
    if (currentOrder && currentOrder.length > 0) {
      mappedItems.sort((a, b) => {
        let idxA = currentOrder.indexOf(a.uniqueId);
        if (idxA === -1) idxA = currentOrder.indexOf(a.ticker);
        let idxB = currentOrder.indexOf(b.uniqueId);
        if (idxB === -1) idxB = currentOrder.indexOf(b.ticker);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        if (idxA !== -1) return -1;
        if (idxB !== -1) return 1;
        return 0;
      });
    }

    return mappedItems;
  }, [
    listTab,
    data?.items,
    investments,
    myB3Investments,
    myCryptoInvestments,
    portfolioQuotes,
    existingTickersSet,
    b3Order,
    cryptoOrder,
  ]);

  // Itens filtrados por busca e tipo
  const filteredItems = useMemo(() => {
    let list = [...currentBaseItems];

    if (filter === 'STOCK') {
      list = list.filter((i) => i.type === 'STOCK');
    } else if (filter === 'CRYPTO') {
      list = list.filter((i) => i.type === 'CRYPTO');
    } else if (filter === 'GAINERS') {
      list = list.filter((i) => parseFloat(getItemVariation(i)) > 0);
    } else if (filter === 'LOSERS') {
      list = list.filter((i) => parseFloat(getItemVariation(i)) < 0);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (i) =>
          i.ticker.toLowerCase().includes(q) ||
          i.name.toLowerCase().includes(q) ||
          (i.yahooSymbol && i.yahooSymbol.toLowerCase().includes(q)),
      );
    }

    return list;
  }, [currentBaseItems, filter, searchQuery, selectedPeriod]);

  const counts = useMemo(() => {
    return {
      all: currentBaseItems.length,
      stock: currentBaseItems.filter((i) => i.type === 'STOCK').length,
      crypto: currentBaseItems.filter((i) => i.type === 'CRYPTO').length,
      gainers: currentBaseItems.filter((i) => parseFloat(getItemVariation(i)) > 0).length,
      losers: currentBaseItems.filter((i) => parseFloat(getItemVariation(i)) < 0).length,
    };
  }, [currentBaseItems, selectedPeriod]);

  // Estatísticas consolidadas para as abas de carteira (MY_B3 e MY_CRYPTO)
  const portfolioStats = useMemo(() => {
    const isB3 = listTab === 'MY_B3';
    const items = isB3 ? myB3Investments : myCryptoInvestments;
    let totalInvested = 0;
    let totalCurrent = 0;

    for (const inv of items) {
      const clean = (inv.code_ticker || '').trim().toUpperCase();
      const quote =
        portfolioQuotes.get(clean) ||
        data?.items.find((it) => it.ticker.replace(/\.SA$/, '').toUpperCase() === clean);
      const price = quote?.price || inv.current_price || inv.average_price || 0;
      const invst = (inv.quantity || 0) * (inv.average_price || 0);
      const curr = (inv.quantity || 0) * price;
      totalInvested += invst;
      totalCurrent += curr;
    }

    const profitLoss = totalCurrent - totalInvested;
    const profitLossPct = totalInvested > 0 ? (profitLoss / totalInvested) * 100 : 0;

    return {
      totalInvested,
      totalCurrent,
      profitLoss,
      profitLossPct,
      count: items.length,
    };
  }, [listTab, myB3Investments, myCryptoInvestments, portfolioQuotes, data?.items]);

  // Alternar ativo na lista Minha Escolha (favorito com estrela)
  const handleToggleFavorite = async (item: EnrichedWatchlistItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const cleanTicker = item.ticker.replace(/\.SA$/, '').toUpperCase();
    const isAlready =
      existingTickersSet.has(cleanTicker) || existingTickersSet.has(item.ticker.toUpperCase());

    if (isAlready) {
      await handleRemoveTicker(item.ticker, e);
      notify(`${cleanTicker} removido do radar de escolha.`, 'info');
    } else {
      await handleAddTicker(item.ticker, item.type);
      notify(`${cleanTicker} adicionado ao radar de escolha!`, 'success');
    }
  };

  // Destaques de maior alta e queda dinâmicos por período
  const periodTopGainer = useMemo(() => {
    if (currentBaseItems.length === 0) return null;
    const sorted = [...currentBaseItems].sort(
      (a, b) => parseFloat(getItemVariation(b)) - parseFloat(getItemVariation(a)),
    );
    const top = sorted[0];
    return top && parseFloat(getItemVariation(top)) > 0 ? top : null;
  }, [currentBaseItems, selectedPeriod]);

  const periodTopLoser = useMemo(() => {
    if (currentBaseItems.length === 0) return null;
    const sorted = [...currentBaseItems].sort(
      (a, b) => parseFloat(getItemVariation(a)) - parseFloat(getItemVariation(b)),
    );
    const worst = sorted[0];
    return worst && parseFloat(getItemVariation(worst)) < 0 ? worst : null;
  }, [currentBaseItems, selectedPeriod]);

  const formatPrice = (item: WatchlistQuoteResult) => {
    const isUsd = item.currency === 'USD';
    const val = item.price;
    if (val === 0) return '--';

    if (isUsd) {
      if (val < 0.01) return `$ ${val.toFixed(5)}`;
      if (val < 1) return `$ ${val.toFixed(4)}`;
      return `$ ${val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const renderPillContent = (item: WatchlistQuoteResult) => {
    const varNum = parseFloat(getItemVariation(item));
    const isPositive = varNum >= 0;

    if (pillMode === 'percent') {
      return `${isPositive ? '+' : ''}${varNum.toFixed(2)}%`;
    }

    if (pillMode === 'amount') {
      const isUsd = item.currency === 'USD';
      const prefix = isUsd ? '$' : 'R$';
      const change = getItemChangeAmount(item);
      const sign = change >= 0 ? '+' : '';
      if (Math.abs(change) < 0.01 && change !== 0) {
        return `${sign}${prefix} ${change.toFixed(4)}`;
      }
      return `${sign}${prefix} ${change.toFixed(2)}`;
    }

    return item.marketCap || '--';
  };

  const totalActiveAlerts = alertsList.filter((a) => !a.triggered).length;

  return (
    <div className="space-y-4 pb-12">
      {/* 1. Header com Status de Mercados e Controles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-bg-surface/80 backdrop-blur-md p-4 rounded-xl border border-border-default/60 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight text-text-primary flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent-gold" />
              Radar de Cotações
            </h2>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent-gold/15 text-accent-gold border border-accent-gold/30">
              {listTab === 'CUSTOM'
                ? 'Minha Escolha'
                : listTab === 'MY_B3'
                ? 'Meus Ativos B3'
                : 'Minhas Criptos'}
            </span>
          </div>
          <p className="text-xs text-text-muted mt-0.5">
            {listTab === 'CUSTOM' &&
              'Acompanhe seus ativos favoritos com cotações em tempo real e alertas de preço customizados.'}
            {listTab === 'MY_B3' &&
              'Acompanhamento ao vivo de todas as ações, FIIs e ETFs da B3 que você tem na carteira.'}
            {listTab === 'MY_CRYPTO' &&
              'Acompanhamento 24/7 de todas as criptomoedas e tokens que você possui em carteira.'}
          </p>
        </div>

        {/* Status badges e botões de ação */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Status B3 */}
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${
              data?.b3Status?.isOpen
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}
            title={data?.b3Status?.nextEvent}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                data?.b3Status?.isOpen ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span>Bolsa B3: {data?.b3Status?.label || 'B3'}</span>
          </div>

          {/* Status Crypto */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border bg-blue-500/10 text-blue-400 border-blue-500/20">
            <span className="h-2 w-2 rounded-full bg-blue-400 animate-pulse" />
            <span>Binance: 24/7 Ativo</span>
          </div>

          {/* Botão Gerenciar Alertas */}
          <button
            onClick={() => setIsManageAlertsOpen(true)}
            className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all active:scale-95 ${
              totalActiveAlerts > 0
                ? 'bg-accent-gold/15 text-accent-gold border-accent-gold/40'
                : 'bg-bg-elevated text-text-secondary hover:text-text-primary border-border-default/80'
            }`}
            title="Ver e gerenciar alertas de preço"
          >
            <Bell className={`h-3.5 w-3.5 ${totalActiveAlerts > 0 ? 'fill-accent-gold/30 text-accent-gold' : ''}`} />
            <span>Alertas</span>
            {totalActiveAlerts > 0 && (
              <span className="h-4 min-w-[16px] px-1 rounded-full bg-accent-gold text-black text-[10px] font-bold flex items-center justify-center">
                {totalActiveAlerts}
              </span>
            )}
          </button>

          {/* Botão Atualizar */}
          <button
            onClick={() => void handleRefreshAll()}
            disabled={refreshing || portfolioLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-text-primary bg-bg-elevated hover:bg-bg-elevated/80 border border-border-default/80 transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
            title="Atualizar cotações e carteira agora"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 text-accent-gold ${
                refreshing || portfolioLoading ? 'animate-spin' : ''
              }`}
            />
            <span className="hidden sm:inline">Atualizar</span>
          </button>

          {/* Toggle Auto-Refresh */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              autoRefresh
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-bg-elevated text-text-muted border-border-default/80'
            }`}
            title="Auto-atualização a cada 30 segundos"
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                autoRefresh ? 'bg-emerald-400 animate-pulse' : 'bg-text-muted'
              }`}
            />
            <span className="hidden sm:inline">Auto-Sync</span>
          </button>

          {/* Botão Adicionar Ativo (Visível na lista de escolha) */}
          {listTab === 'CUSTOM' && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-black bg-accent-gold hover:bg-accent-gold/90 transition-all shadow-xs active:scale-95 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Adicionar Ativo</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Seletor das 3 Listas do Radar (Minha Escolha, Ativos B3, Criptos) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-bg-surface/90 backdrop-blur-md p-2 rounded-2xl border border-border-default/80 shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none p-0.5">
          <button
            type="button"
            onClick={() => setListTab('CUSTOM')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap select-none ${
              listTab === 'CUSTOM'
                ? 'bg-accent-gold text-gray-950 shadow-md shadow-accent-gold/25'
                : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>Minha Escolha</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[11px] font-mono font-bold ${
                listTab === 'CUSTOM'
                  ? 'bg-black/25 text-gray-950'
                  : 'bg-bg-elevated text-text-muted'
              }`}
            >
              {data?.items?.length || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setListTab('MY_B3')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap select-none ${
              listTab === 'MY_B3'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated'
            }`}
          >
            <Building2 className="h-4 w-4" />
            <span>Meus Ativos B3</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[11px] font-mono font-bold ${
                listTab === 'MY_B3'
                  ? 'bg-white/25 text-white'
                  : 'bg-bg-elevated text-text-muted'
              }`}
            >
              {myB3Investments.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setListTab('MY_CRYPTO')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all cursor-pointer whitespace-nowrap select-none ${
              listTab === 'MY_CRYPTO'
                ? 'bg-amber-500 text-gray-950 shadow-md shadow-amber-500/25'
                : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated'
            }`}
          >
            <Coins className="h-4 w-4" />
            <span>Minhas Criptos</span>
            <span
              className={`px-1.5 py-0.2 rounded-full text-[11px] font-mono font-bold ${
                listTab === 'MY_CRYPTO'
                  ? 'bg-black/25 text-gray-950'
                  : 'bg-bg-elevated text-text-muted'
              }`}
            >
              {myCryptoInvestments.length}
            </span>
          </button>
        </div>

        {/* Informação rápida sobre a lista */}
        <div className="text-[11px] text-text-muted px-2 hidden md:block">
          {listTab === 'CUSTOM' && 'Ativos personalizados que você escolheu monitorar'}
          {listTab === 'MY_B3' && 'Cotações ao vivo de todas as ações e FIIs da sua carteira'}
          {listTab === 'MY_CRYPTO' && 'Cotações em tempo real das suas criptos (Binance & Carteira)'}
        </div>
      </div>

      {/* 3. Destaques Top Alta e Queda ou Métricas da Carteira */}
      {listTab === 'CUSTOM' ? (
        data && data.items.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-bg-surface p-3.5 rounded-xl border border-border-default/50 flex items-center justify-between">
              <div>
                <span className="text-xs text-text-muted font-medium">Ativos no Radar</span>
                <p className="text-lg font-bold text-text-primary mt-0.5">
                  {counts.all}{' '}
                  <span className="text-xs font-normal text-text-muted">
                    ({counts.stock} ações, {counts.crypto} criptos)
                  </span>
                </p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-accent-gold/10 flex items-center justify-center text-accent-gold">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>

            <div className="bg-bg-surface p-3.5 rounded-xl border border-border-default/50 flex items-center justify-between">
              <div>
                <span className="text-xs text-text-muted font-medium flex items-center gap-1">
                  <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
                  Maior Alta ({selectedPeriod})
                </span>
                <p className="text-base font-bold text-text-primary mt-0.5 flex items-center gap-1.5">
                  {periodTopGainer ? (
                    <>
                      <span>{periodTopGainer.ticker.replace(/\.SA$/, '')}</span>
                      <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                        +{parseFloat(getItemVariation(periodTopGainer)).toFixed(2)}%
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-text-muted">Nenhuma alta</span>
                  )}
                </p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                <TrendingUp className="h-5 w-5" />
              </div>
            </div>

            <div className="bg-bg-surface p-3.5 rounded-xl border border-border-default/50 flex items-center justify-between">
              <div>
                <span className="text-xs text-text-muted font-medium flex items-center gap-1">
                  <ArrowDownRight className="h-3.5 w-3.5 text-rose-400" />
                  Maior Queda ({selectedPeriod})
                </span>
                <p className="text-base font-bold text-text-primary mt-0.5 flex items-center gap-1.5">
                  {periodTopLoser ? (
                    <>
                      <span>{periodTopLoser.ticker.replace(/\.SA$/, '')}</span>
                      <span className="text-xs font-semibold text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded">
                        {parseFloat(getItemVariation(periodTopLoser)).toFixed(2)}%
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-text-muted">Nenhuma queda</span>
                  )}
                </p>
              </div>
              <div className="h-9 w-9 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400">
                <TrendingDown className="h-5 w-5" />
              </div>
            </div>
          </div>
        )
      ) : (
        /* Cards de Métricas de Carteira (B3 ou Cripto) */
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-bg-surface p-3.5 rounded-xl border border-border-default/50 flex items-center justify-between">
            <div>
              <span className="text-xs text-text-muted font-medium">
                {listTab === 'MY_B3' ? 'Patrimônio em Ativos B3' : 'Patrimônio em Criptos'}
              </span>
              <p className="text-lg font-bold text-text-primary mt-0.5 flex items-baseline gap-2">
                <span>
                  {listTab === 'MY_B3'
                    ? `R$ ${portfolioStats.totalCurrent.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : `$ ${portfolioStats.totalCurrent.toLocaleString('en-US', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`}
                </span>
                {portfolioStats.totalInvested > 0 && (
                  <span
                    className={`text-xs font-semibold px-1.5 py-0.2 rounded ${
                      portfolioStats.profitLoss >= 0
                        ? 'text-emerald-400 bg-emerald-500/10'
                        : 'text-rose-400 bg-rose-500/10'
                    }`}
                  >
                    {portfolioStats.profitLoss >= 0 ? '+' : ''}
                    {portfolioStats.profitLossPct.toFixed(1)}%
                  </span>
                )}
              </p>
            </div>
            <div
              className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                listTab === 'MY_B3'
                  ? 'bg-blue-500/10 text-blue-400'
                  : 'bg-amber-500/10 text-amber-400'
              }`}
            >
              <Wallet className="h-5 w-5" />
            </div>
          </div>

          <div className="bg-bg-surface p-3.5 rounded-xl border border-border-default/50 flex items-center justify-between">
            <div>
              <span className="text-xs text-text-muted font-medium">
                {listTab === 'MY_B3' ? 'Posições em Carteira B3' : 'Criptomoedas Ativas'}
              </span>
              <p className="text-lg font-bold text-text-primary mt-0.5">
                {portfolioStats.count}{' '}
                <span className="text-xs font-normal text-text-muted">
                  {listTab === 'MY_B3' ? 'ativos custodiados' : 'criptoativos'}
                </span>
              </p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-bg-elevated flex items-center justify-center text-text-secondary">
              {listTab === 'MY_B3' ? <Building2 className="h-5 w-5" /> : <Coins className="h-5 w-5" />}
            </div>
          </div>

          <div className="bg-bg-surface p-3.5 rounded-xl border border-border-default/50 flex items-center justify-between">
            <div>
              <span className="text-xs text-text-muted font-medium flex items-center gap-1">
                <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
                Destaque do Período ({selectedPeriod})
              </span>
              <p className="text-base font-bold text-text-primary mt-0.5 flex items-center gap-1.5">
                {periodTopGainer ? (
                  <>
                    <span>{periodTopGainer.ticker.replace(/\.SA$/, '')}</span>
                    <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                      +{parseFloat(getItemVariation(periodTopGainer)).toFixed(2)}%
                    </span>
                  </>
                ) : (
                  <span className="text-sm text-text-muted">Sem destaques no período</span>
                )}
              </p>
            </div>
            <div className="h-9 w-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
        </div>
      )}

      {/* 3. Barra de Ferramentas (Filtros, Busca, Modo de Visualização) */}
      {currentBaseItems.length > 0 && (
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                filter === 'ALL'
                  ? 'bg-accent-gold text-black shadow-xs'
                  : 'bg-bg-surface text-text-muted hover:text-text-primary border border-border-default/60'
              }`}
            >
              Todos ({counts.all})
            </button>

            {/* Apenas na aba Minha Escolha mostramos os filtros específicos de B3 e Cripto se existirem */}
            {listTab === 'CUSTOM' && counts.stock > 0 && (
              <button
                onClick={() => setFilter('STOCK')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  filter === 'STOCK'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-bg-surface text-text-muted hover:text-text-primary border border-border-default/60'
                }`}
              >
                <span>🇧🇷 Bolsa B3 ({counts.stock})</span>
              </button>
            )}

            {listTab === 'CUSTOM' && counts.crypto > 0 && (
              <button
                onClick={() => setFilter('CRYPTO')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  filter === 'CRYPTO'
                    ? 'bg-amber-500 text-black shadow-xs'
                    : 'bg-bg-surface text-text-muted hover:text-text-primary border border-border-default/60'
                }`}
              >
                <span>🟡 Binance Cripto ({counts.crypto})</span>
              </button>
            )}

            <button
              onClick={() => setFilter('GAINERS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                filter === 'GAINERS'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-bg-surface text-text-muted hover:text-text-primary border border-border-default/60'
              }`}
            >
              🟢 Altas ({counts.gainers})
            </button>

            <button
              onClick={() => setFilter('LOSERS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                filter === 'LOSERS'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-bg-surface text-text-muted hover:text-text-primary border border-border-default/60'
              }`}
            >
              🔴 Quedas ({counts.losers})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div ref={searchContainerRef} className="relative flex-1 md:w-72">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onFocus={() => {
                  if (searchQuery.trim().length >= 1) setShowSearchDropdown(true);
                }}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchDropdown(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    const topResult = searchSuggestions[0];
                    if (topResult && !topResult.inWatchlist) {
                      void handleAddTicker(topResult.ticker, topResult.type);
                    } else if (searchSuggestions.length === 0) {
                      const clean = searchQuery.trim().toUpperCase();
                      const guessType = /[0-9]$/.test(clean) ? 'STOCK' : 'CRYPTO';
                      void handleAddTicker(clean, guessType);
                    }
                  }
                }}
                placeholder="Buscar ativo ou ticker (ex: BTC, PETR4)..."
                className="w-full pl-8 pr-7 py-1.5 rounded-lg text-xs bg-[#111827] border border-slate-700 text-white placeholder:text-slate-400 focus:outline-none focus:border-accent-gold focus:bg-[#161F30] transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setShowSearchDropdown(false);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                >
                  <X className="h-3 w-3" />
                </button>
              )}

              {/* DROPDOWN DE AUTOCOMPLETE FLUTUANTE */}
              {showSearchDropdown && searchQuery.trim().length >= 1 && (
                <div className="absolute right-0 sm:left-0 top-full mt-1.5 w-72 sm:w-80 md:w-96 bg-[#0E1524] border border-slate-700/90 rounded-xl shadow-2xl p-2 z-50 backdrop-blur-md space-y-1 max-h-80 overflow-y-auto">
                  <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-accent-gold flex items-center justify-between border-b border-slate-800 pb-1">
                    <span>Sugestões de Ativos</span>
                    <span className="text-slate-400 font-normal lowercase text-[10px]">enter ou clique para adicionar</span>
                  </div>

                  {searchSuggestions.length > 0 ? (
                    <div className="divide-y divide-slate-800/60">
                      {searchSuggestions.map((item) => (
                        <div
                          key={item.ticker}
                          className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/60 transition-colors group cursor-pointer"
                          onClick={() => {
                            if (!item.inWatchlist) {
                              void handleAddTicker(item.ticker, item.type);
                            } else {
                              setShowSearchDropdown(false);
                            }
                          }}
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-2">
                            <AssetLogo
                              ticker={item.rawTicker}
                              name={item.name}
                              assetType={item.type}
                              sizeClassName="h-6 w-6"
                            />
                            <div className="flex flex-col min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-xs font-mono text-white group-hover:text-amber-400 transition-colors">
                                  {item.rawTicker}
                                </span>
                                <span
                                  className={`text-[9px] px-1.5 py-0.2 rounded-full font-semibold ${
                                    item.type === 'CRYPTO'
                                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                      : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                                  }`}
                                >
                                  {item.type === 'CRYPTO' ? '🟡 Cripto' : '🇧🇷 B3'}
                                </span>
                              </div>
                              <span className="text-[11px] text-slate-400 truncate max-w-[140px] sm:max-w-[200px]">
                                {item.name}
                              </span>
                            </div>
                          </div>

                          <div>
                            {item.inWatchlist ? (
                              <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-md flex items-center gap-1 shrink-0">
                                <Check className="h-3 w-3" />
                                <span>No Radar</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void handleAddTicker(item.ticker, item.type);
                                }}
                                disabled={addingTicker}
                                className="text-[11px] font-bold text-black bg-accent-gold hover:bg-amber-300 active:scale-95 px-2.5 py-1 rounded-md transition-all flex items-center gap-1 shrink-0 shadow-xs"
                              >
                                <Plus className="h-3 w-3" />
                                <span>Adicionar</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 text-center text-xs text-slate-400">
                      Nenhum ativo pré-cadastrado para "{searchQuery}"
                    </div>
                  )}

                  {/* Ação rápida para tickers customizados */}
                  <div className="pt-1.5 border-t border-slate-800 space-y-1">
                    <div className="text-[10px] text-slate-400 px-1">Adicionar diretamente:</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleAddTicker(searchQuery.trim().toUpperCase(), 'CRYPTO')}
                        disabled={addingTicker}
                        className="text-[11px] font-semibold text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg p-1.5 text-center transition-all truncate"
                      >
                        + {searchQuery.trim().toUpperCase()} (Cripto)
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleAddTicker(searchQuery.trim().toUpperCase(), 'STOCK')}
                        disabled={addingTicker}
                        className="text-[11px] font-semibold text-blue-400 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-lg p-1.5 text-center transition-all truncate"
                      >
                        + {searchQuery.trim().toUpperCase()} (B3)
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Seletor de Período da Variação (1D, 7D, 30D, 1Y) */}
            <div className="flex items-center bg-bg-surface border border-border-default/80 rounded-lg p-0.5 shrink-0" title="Escolha o período da variação">
              {(['1D', '7D', '30D', '1Y'] as WatchlistPeriod[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setSelectedPeriod(p)}
                  className={`px-2 py-1 rounded-md text-xs font-bold transition-all ${
                    selectedPeriod === p
                      ? 'bg-accent-gold text-black shadow-xs'
                      : 'text-text-muted hover:text-text-primary hover:bg-bg-elevated'
                  }`}
                  title={`Variação de ${
                    p === '1D'
                      ? '24 Horas / Diária'
                      : p === '7D'
                      ? '7 Dias (1 Semana)'
                      : p === '30D'
                      ? '30 Dias (1 Mês)'
                      : '1 Ano'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <button
              onClick={handleTogglePillMode}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-bg-surface border border-border-default/80 text-text-secondary hover:text-text-primary transition-all shrink-0"
              title="Alternar entre % Variação, R$/$ ou Valor de Mercado"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-accent-gold" />
              <span className="hidden sm:inline">Exibir:</span>
              <span className="font-semibold text-accent-gold uppercase">
                {pillMode === 'percent'
                  ? `% Var (${selectedPeriod})`
                  : pillMode === 'amount'
                  ? `Valor (${selectedPeriod})`
                  : 'Mercado'}
              </span>
            </button>

            <div className="flex items-center bg-bg-surface border border-border-default/80 rounded-lg p-0.5 shrink-0">
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === 'list'
                    ? 'bg-accent-gold text-black shadow-xs'
                    : 'text-text-muted hover:text-text-primary'
                }`}
                title="Modo Lista Compacta"
              >
                <List className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-md transition-all ${
                  viewMode === 'grid'
                    ? 'bg-accent-gold text-black shadow-xs'
                    : 'text-text-muted hover:text-text-primary'
                }`}
                title="Modo Grade de Cards"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Lista ou Grade de Ativos */}
      {(loading && !data) || (listTab !== 'CUSTOM' && portfolioLoading && investments.length === 0) ? (
        <div className="bg-bg-surface rounded-xl border border-border-default/60 p-12 text-center text-text-muted flex flex-col items-center justify-center gap-3">
          <RefreshCw className="h-7 w-7 animate-spin text-accent-gold" />
          <p className="text-sm font-medium">Carregando cotações em tempo real...</p>
        </div>
      ) : currentBaseItems.length === 0 ? (
        /* ESTADOS VAZIOS ESPECÍFICOS POR ABA */
        listTab === 'CUSTOM' ? (
          /* ESTADO VAZIO MINHA ESCOLHA */
          <div className="bg-bg-surface rounded-2xl border border-border-default/80 p-8 sm:p-12 text-center space-y-6">
            <div className="max-w-md mx-auto space-y-3">
              <div className="h-16 w-16 mx-auto rounded-2xl bg-accent-gold/10 border border-accent-gold/20 flex items-center justify-center text-accent-gold shadow-inner">
                <Sparkles className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-text-primary">Sua Lista de Acompanhamento está vazia</h3>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                Adicione apenas as Ações da B3 e Criptomoedas que você quer monitorar diariamente. Você também pode definir <strong>Alertas de Preço</strong> para ser notificado quando atingirem seu alvo.
              </p>

              <div className="pt-2">
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-black bg-accent-gold hover:bg-accent-gold/90 transition-all shadow-md active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                  <span>Adicionar Primeiro Ativo</span>
                </button>
              </div>
            </div>

            {/* Sugestões de 1 clique para agilizar */}
            <div className="max-w-lg mx-auto pt-4 border-t border-border-default/60 space-y-3">
              <span className="text-xs font-semibold text-text-muted">Adicione com 1 clique se desejar:</span>
              
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-blue-400 mr-1">B3:</span>
                  {SUGGESTED_B3.map((sug) => (
                    <button
                      key={sug.ticker}
                      onClick={() => void handleAddTicker(sug.ticker, sug.type)}
                      className="text-xs px-2.5 py-1 rounded-lg bg-bg-elevated hover:bg-blue-500/20 hover:text-blue-400 border border-border-default text-text-secondary transition-all"
                    >
                      + {sug.ticker.replace(/\.SA$/, '')}
                    </button>
                  ))}
                </div>

                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  <span className="text-[11px] font-bold text-amber-400 mr-1">Cripto:</span>
                  {SUGGESTED_CRYPTO.map((sug) => (
                    <button
                      key={sug.ticker}
                      onClick={() => void handleAddTicker(sug.ticker, sug.type)}
                      className="text-xs px-2.5 py-1 rounded-lg bg-bg-elevated hover:bg-amber-500/20 hover:text-amber-400 border border-border-default text-text-secondary transition-all"
                    >
                      + {sug.ticker}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : listTab === 'MY_B3' ? (
          /* ESTADO VAZIO MEUS ATIVOS B3 */
          <div className="bg-bg-surface rounded-2xl border border-border-default/80 p-8 sm:p-12 text-center space-y-5">
            <div className="max-w-md mx-auto space-y-3">
              <div className="h-16 w-16 mx-auto rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-inner">
                <Building2 className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-text-primary">Nenhum Ativo B3 na Carteira</h3>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                Você ainda não possui ações, FIIs ou ETFs cadastrados em sua carteira. Cadastre suas posições ou importe seu extrato para ver as cotações em tempo real e rentabilidade aqui.
              </p>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                <a
                  href="/investments?action=add"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 transition-all shadow-md active:scale-95"
                >
                  <Plus className="h-4 w-4" />
                  <span>Cadastrar Investimento B3</span>
                </a>
                <button
                  onClick={() => setListTab('CUSTOM')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-text-secondary bg-bg-elevated hover:text-text-primary border border-border-default transition-all"
                >
                  <Sparkles className="h-4 w-4 text-accent-gold" />
                  <span>Ir para Minha Escolha</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* ESTADO VAZIO MINHAS CRIPTOS */
          <div className="bg-bg-surface rounded-2xl border border-border-default/80 p-8 sm:p-12 text-center space-y-5">
            <div className="max-w-md mx-auto space-y-3">
              <div className="h-16 w-16 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shadow-inner">
                <Coins className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-text-primary">Nenhuma Criptomoeda na Carteira</h3>
              <p className="text-xs sm:text-sm text-text-muted leading-relaxed">
                Você ainda não possui criptomoedas registradas na sua carteira. Conecte sua conta da Binance ou adicione criptoativos manualmente para acompanhar cotações e saldo 24/7.
              </p>

              <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                <a
                  href="/investments?tab=BINANCE"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-black bg-amber-400 hover:bg-amber-300 transition-all shadow-md active:scale-95"
                >
                  <Coins className="h-4 w-4" />
                  <span>Sincronizar Binance</span>
                </a>
                <button
                  onClick={() => setListTab('CUSTOM')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-text-secondary bg-bg-elevated hover:text-text-primary border border-border-default transition-all"
                >
                  <Sparkles className="h-4 w-4 text-accent-gold" />
                  <span>Ir para Minha Escolha</span>
                </button>
              </div>
            </div>
          </div>
        )
      ) : filteredItems.length === 0 ? (
        <div className="bg-bg-surface rounded-2xl border border-border-default/80 p-6 sm:p-8 text-center space-y-4">
          <div className="h-12 w-12 mx-auto rounded-full bg-accent-gold/10 border border-accent-gold/20 flex items-center justify-center text-accent-gold">
            <Search className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h4 className="font-bold text-base text-text-primary">
              {searchQuery.trim()
                ? `"${searchQuery.trim().toUpperCase()}" não foi encontrado nesta lista`
                : 'Nenhum ativo corresponde aos filtros selecionados'}
            </h4>
            <p className="text-xs text-text-muted max-w-md mx-auto">
              {searchQuery.trim()
                ? `Você pode adicionar ${searchQuery.trim().toUpperCase()} à sua lista de escolha personalizada ou verificar em outra aba.`
                : 'Tente alterar os filtros ou pesquisar por outro ativo.'}
            </p>
          </div>

          {searchQuery.trim() && (
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                onClick={() => void handleAddTicker(searchQuery.trim().toUpperCase(), 'CRYPTO')}
                disabled={addingTicker}
                className="px-4 py-2 rounded-xl text-xs font-bold text-black bg-accent-gold hover:bg-amber-300 transition-all flex items-center gap-1.5 shadow-xs cursor-pointer active:scale-95"
              >
                <Coins className="h-4 w-4" />
                <span>Adicionar {searchQuery.trim().toUpperCase()} ao Radar</span>
              </button>

              <button
                onClick={() => setSearchQuery('')}
                className="px-3 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-text-primary border border-border-default/60 transition-all cursor-pointer"
              >
                Limpar busca
              </button>
            </div>
          )}
        </div>
      ) : viewMode === 'list' ? (
        /* MODO LISTA COMPACTA */
        <div className="bg-bg-surface rounded-xl border border-border-default/60 overflow-hidden divide-y divide-border-default/40 shadow-xs">
          {filteredItems.map((item) => {
            const varNum = parseFloat(getItemVariation(item));
            const isPositive = varNum >= 0;
            const displayTicker = item.ticker.replace(/\.SA$/, '');
            const itemAlerts = activeAlertsByTicker.get(displayTicker) || [];
            const hasActiveAlert = itemAlerts.some((a) => !a.triggered);
            const isDragging = draggedId === item.uniqueId;
            const isDragOver = dragOverId === item.uniqueId;
            const isCustomList = listTab === 'CUSTOM';

            return (
              <div
                key={item.uniqueId}
                draggable={true}
                onDragStart={(e) => handleDragStart(item.uniqueId, e)}
                onDragOver={(e) => handleDragOver(item.uniqueId, e)}
                onDragEnd={handleDragEnd}
                onDrop={(e) => void handleDrop(item.uniqueId, e)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  const matchedInv =
                    investments.find((i) => i.id === item.portfolio?.id) ||
                    investments.find(
                      (i) =>
                        (i.code_ticker || '').trim().toUpperCase() ===
                        item.ticker.replace(/\.SA$/, '').toUpperCase(),
                    );
                  if (matchedInv) {
                    setSellingInvestment(matchedInv);
                  }
                }}
                className={`group flex items-center justify-between px-3.5 py-3 transition-all cursor-pointer select-none ${
                  isDragging
                    ? 'opacity-40 bg-accent-gold/15 border-y-2 border-dashed border-accent-gold scale-[0.99]'
                    : isDragOver
                    ? 'bg-accent-gold/10 border-t-2 border-t-accent-gold shadow-md'
                    : 'hover:bg-bg-elevated/60'
                }`}
                title={item.portfolio ? "Dê 2 cliques para vender este ativo" : undefined}
                onClick={handleTogglePillMode}
              >
                <div className="flex items-center gap-2 sm:gap-3 min-w-0 pr-2">
                  {/* Handle para Segurar e Arrastar com o Mouse (Habilitado em Todas as Abas) */}
                  <div
                    className="cursor-grab active:cursor-grabbing text-text-muted hover:text-accent-gold p-1 -ml-1 transition-colors shrink-0"
                    title="Clique e arraste com o mouse para organizar a ordem deste ativo"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <GripVertical className="h-4 w-4" />
                  </div>

                  {/* Botão de Estrela nas abas de Carteira para favoritar no radar personalizado */}
                  {!isCustomList && (
                    <button
                      type="button"
                      onClick={(e) => void handleToggleFavorite(item, e)}
                      className={`p-1 -ml-1 transition-all rounded-md shrink-0 cursor-pointer ${
                        item.inWatchlist
                          ? 'text-accent-gold hover:text-accent-gold/80'
                          : 'text-text-muted hover:text-accent-gold'
                      }`}
                      title={
                        item.inWatchlist
                          ? 'No radar de escolha (clique para remover)'
                          : 'Fixar no radar de escolha'
                      }
                    >
                      <Star className={`h-4 w-4 ${item.inWatchlist ? 'fill-accent-gold text-accent-gold' : ''}`} />
                    </button>
                  )}

                  <AssetLogo
                    ticker={displayTicker}
                    name={item.name}
                    assetType={
                      item.type === 'CRYPTO'
                        ? 'CRYPTO'
                        : isTesouroAsset({ code_ticker: item.ticker, name: item.name })
                        ? 'FIXED_INCOME'
                        : 'STOCK'
                    }
                    institution={
                      item.type === 'CRYPTO'
                        ? 'Binance'
                        : isTesouroAsset({ code_ticker: item.ticker, name: item.name })
                        ? (item.portfolio?.institution || 'Tesouro Direto')
                        : 'B3'
                    }
                    sizeClassName="h-8 w-8"
                  />

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-sm text-text-primary tracking-tight">
                        {displayTicker}
                      </span>
                      <span
                        className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${
                          item.type === 'CRYPTO'
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : isTesouroAsset({ code_ticker: item.ticker, name: item.name })
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-blue-500/15 text-blue-400 border border-blue-500/30'
                        }`}
                      >
                        {item.type === 'CRYPTO'
                          ? 'BINANCE'
                          : isTesouroAsset({ code_ticker: item.ticker, name: item.name })
                          ? 'TESOURO'
                          : 'B3'}
                      </span>
                      {hasActiveAlert && (
                        <span
                          className="flex items-center gap-0.5 text-[10px] font-bold text-accent-gold bg-accent-gold/15 px-1.5 py-0.2 rounded"
                          title="Alerta de preço ativo neste ativo"
                        >
                          <BellRing className="h-3 w-3" />
                          <span>{itemAlerts.length}</span>
                        </span>
                      )}
                      {!isCustomList && item.inWatchlist && (
                        <span
                          className="hidden md:inline-flex items-center gap-1 text-[9px] font-bold text-accent-gold bg-accent-gold/10 px-1.5 py-0.2 rounded border border-accent-gold/20"
                          title="Presente no Radar Minha Escolha"
                        >
                          <Star className="h-2.5 w-2.5 fill-accent-gold" />
                          <span>Radar</span>
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-text-muted truncate max-w-[140px] sm:max-w-[200px]">
                      {item.name}
                    </p>
                  </div>
                </div>

                {/* Dados de Custódia da Carteira (quando disponível) */}
                {item.portfolio && (
                  <div className="hidden lg:flex flex-col text-right px-4 border-r border-border-default/40">
                    <div className="text-xs text-text-primary font-medium flex items-center justify-end gap-1.5">
                      <span className="text-text-muted text-[11px]">Qtd:</span>
                      <span className="font-mono font-bold">
                        {item.portfolio.quantity.toLocaleString(item.type === 'CRYPTO' ? 'en-US' : 'pt-BR', {
                          maximumFractionDigits: item.type === 'CRYPTO' ? 4 : 0,
                        })}
                      </span>
                      <span className="text-text-muted text-[11px] ml-1.5">PM:</span>
                      <span className="font-mono text-text-secondary">
                        {formatPrice({ ...item, price: item.portfolio.averagePrice })}
                      </span>
                    </div>
                    <div className="text-[11px] font-semibold flex items-center justify-end gap-1.5 mt-0.5">
                      <span className="text-text-muted">Total: {formatPrice({ ...item, price: item.portfolio.currentValue })}</span>
                      <span
                        className={`px-1 py-0.2 rounded font-mono text-[10px] ${
                          item.portfolio.profitLoss >= 0
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : 'text-rose-400 bg-rose-500/10'
                        }`}
                      >
                        {item.portfolio.profitLoss >= 0 ? '+' : ''}
                        {item.portfolio.profitLossPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                )}

                <div className="hidden sm:flex items-center justify-center px-4">
                  <WatchlistSparkline
                    data={getItemSparkline(item)}
                    isPositive={isPositive}
                    width={100}
                    height={32}
                  />
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
                  <div className="text-right">
                    <div className="font-semibold text-sm text-text-primary tabular-nums">
                      {formatPrice(item)}
                    </div>
                    <div className="text-[10px] text-text-muted sm:hidden">
                      {item.marketCap !== '--' ? item.marketCap : item.currency}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleTogglePillMode();
                    }}
                    className={`min-w-[76px] sm:min-w-[88px] text-center font-bold text-xs py-1.5 px-2.5 rounded-lg transition-transform active:scale-95 select-none shadow-xs ${
                      isPositive
                        ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                        : 'bg-rose-600 text-white hover:bg-rose-500'
                    }`}
                  >
                    {renderPillContent(item)}
                  </button>

                  {/* Botão de Alerta */}
                  <button
                    onClick={(e) => handleOpenCreateAlert(item, e)}
                    className={`p-1.5 rounded-lg transition-all ${
                      hasActiveAlert
                        ? 'text-accent-gold hover:bg-accent-gold/20'
                        : 'text-text-muted hover:text-accent-gold hover:bg-accent-gold/10'
                    }`}
                    title={hasActiveAlert ? 'Gerenciar alertas deste ativo' : 'Definir alerta de preço'}
                  >
                    <Bell className={`h-4 w-4 ${hasActiveAlert ? 'fill-accent-gold' : ''}`} />
                  </button>

                  {/* Ação primária (Excluir na customizada ou Estrela nas de carteira) */}
                  {isCustomList ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setTickerToDelete(item.ticker);
                      }}
                      className="p-1.5 text-text-muted hover:text-rose-400 hover:bg-rose-500/15 rounded-lg transition-all"
                      title={`Remover ${item.ticker} da lista de acompanhamento`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  ) : (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={(e) => void handleToggleFavorite(item, e)}
                        className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                          item.inWatchlist
                            ? 'text-accent-gold bg-accent-gold/15 hover:bg-accent-gold/25'
                            : 'text-text-muted hover:text-accent-gold hover:bg-accent-gold/10'
                        }`}
                        title={
                          item.inWatchlist
                            ? 'Remover do Radar de Escolha'
                            : 'Adicionar ao Radar de Escolha'
                        }
                      >
                        <Star className={`h-4 w-4 ${item.inWatchlist ? 'fill-accent-gold text-accent-gold' : ''}`} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* MODO GRADE DE CARDS */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {filteredItems.map((item) => {
            const varNum = parseFloat(getItemVariation(item));
            const isPositive = varNum >= 0;
            const displayTicker = item.ticker.replace(/\.SA$/, '');
            const itemAlerts = activeAlertsByTicker.get(displayTicker) || [];
            const hasActiveAlert = itemAlerts.some((a) => !a.triggered);
            const isDragging = draggedId === item.uniqueId;
            const isDragOver = dragOverId === item.uniqueId;
            const isCustomList = listTab === 'CUSTOM';

            return (
              <div
                key={item.uniqueId}
                draggable={true}
                onDragStart={(e) => handleDragStart(item.uniqueId, e)}
                onDragOver={(e) => handleDragOver(item.uniqueId, e)}
                onDragEnd={handleDragEnd}
                onDrop={(e) => void handleDrop(item.uniqueId, e)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  const matchedInv =
                    investments.find((i) => i.id === item.portfolio?.id) ||
                    investments.find(
                      (i) =>
                        (i.code_ticker || '').trim().toUpperCase() ===
                        item.ticker.replace(/\.SA$/, '').toUpperCase(),
                    );
                  if (matchedInv) {
                    setSellingInvestment(matchedInv);
                  }
                }}
                className={`group relative bg-bg-surface p-4 rounded-xl border transition-all shadow-xs flex flex-col justify-between cursor-pointer select-none ${
                  isDragging
                    ? 'opacity-40 bg-accent-gold/10 border-dashed border-accent-gold scale-[0.98]'
                    : isDragOver
                    ? 'ring-2 ring-accent-gold bg-accent-gold/10 border-accent-gold shadow-lg'
                    : 'border-border-default/60 hover:border-accent-gold/40 hover:bg-bg-elevated/70'
                }`}
                title={item.portfolio ? "Dê 2 cliques para vender este ativo" : undefined}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Handle para Arrastar com o Mouse (Em todas as abas) */}
                      <div
                        className="cursor-grab active:cursor-grabbing text-text-muted hover:text-accent-gold p-1 -ml-1 transition-colors shrink-0"
                        title="Clique e arraste com o mouse para organizar a ordem deste ativo"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <GripVertical className="h-4 w-4" />
                      </div>

                      {!isCustomList && (
                        <button
                          type="button"
                          onClick={(e) => void handleToggleFavorite(item, e)}
                          className={`p-1 -ml-1 transition-all rounded-md shrink-0 cursor-pointer ${
                            item.inWatchlist
                              ? 'text-accent-gold'
                              : 'text-text-muted hover:text-accent-gold'
                          }`}
                          title={
                            item.inWatchlist
                              ? 'No radar de escolha (clique para remover)'
                              : 'Fixar no radar de escolha'
                          }
                        >
                          <Star className={`h-4 w-4 ${item.inWatchlist ? 'fill-accent-gold text-accent-gold' : ''}`} />
                        </button>
                      )}

                      <AssetLogo
                        ticker={displayTicker}
                        name={item.name}
                        assetType={
                          item.type === 'CRYPTO'
                            ? 'CRYPTO'
                            : isTesouroAsset({ code_ticker: item.ticker, name: item.name })
                            ? 'FIXED_INCOME'
                            : 'STOCK'
                        }
                        institution={
                          item.type === 'CRYPTO'
                            ? 'Binance'
                            : isTesouroAsset({ code_ticker: item.ticker, name: item.name })
                            ? (item.portfolio?.institution || 'Tesouro Direto')
                            : 'B3'
                        }
                        sizeClassName="h-8 w-8"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-text-primary">{displayTicker}</span>
                          <span
                            className={`text-[9px] font-semibold px-1.5 py-0.2 rounded ${
                              item.type === 'CRYPTO'
                                ? 'bg-amber-500/15 text-amber-400'
                                : isTesouroAsset({ code_ticker: item.ticker, name: item.name })
                                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                : 'bg-blue-500/15 text-blue-400'
                            }`}
                          >
                            {item.type === 'CRYPTO'
                              ? 'BINANCE'
                              : isTesouroAsset({ code_ticker: item.ticker, name: item.name })
                              ? 'TESOURO'
                              : 'B3'}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted truncate">{item.name}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => handleOpenCreateAlert(item, e)}
                        className={`p-1.5 rounded-md transition-all ${
                          hasActiveAlert
                            ? 'text-accent-gold bg-accent-gold/15'
                            : 'text-text-muted hover:text-accent-gold hover:bg-accent-gold/10'
                        }`}
                        title="Criar alerta de preço"
                      >
                        <Bell className={`h-3.5 w-3.5 ${hasActiveAlert ? 'fill-accent-gold' : ''}`} />
                      </button>

                      {/* Botão Ação (Excluir na customizada ou Estrela nas de carteira) */}
                      {isCustomList ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setTickerToDelete(item.ticker);
                          }}
                          className="p-1.5 text-text-muted hover:text-rose-400 hover:bg-rose-500/15 rounded-md transition-all"
                          title="Remover da lista"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => void handleToggleFavorite(item, e)}
                            className={`p-1.5 rounded-md transition-all ${
                              item.inWatchlist
                                ? 'text-accent-gold bg-accent-gold/15'
                                : 'text-text-muted hover:text-accent-gold hover:bg-accent-gold/10'
                            }`}
                            title={
                              item.inWatchlist
                                ? 'Remover do Radar de Escolha'
                                : 'Fixar no Radar de Escolha'
                            }
                          >
                            <Star className={`h-3.5 w-3.5 ${item.inWatchlist ? 'fill-accent-gold' : ''}`} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-3.5 flex items-baseline justify-between">
                    <div>
                      <span className="text-xs text-text-muted">Preço Atual</span>
                      <div className="text-lg font-extrabold text-text-primary tabular-nums">
                        {formatPrice(item)}
                      </div>
                    </div>

                    <button
                      onClick={handleTogglePillMode}
                      className={`font-bold text-xs py-1 px-2.5 rounded-lg tabular-nums shadow-xs ${
                        isPositive ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                      }`}
                    >
                      {renderPillContent(item)}
                    </button>
                  </div>
                </div>

                <div className="my-3 py-1 flex items-center justify-center bg-bg-primary/40 rounded-lg p-2">
                  <WatchlistSparkline
                    data={getItemSparkline(item)}
                    isPositive={isPositive}
                    width={220}
                    height={46}
                    className="w-full"
                  />
                </div>

                {/* Bloco de Custódia da Carteira (quando disponível) */}
                {item.portfolio && (
                  <div className="mb-2 p-2 rounded-lg bg-bg-elevated/80 border border-border-default/50 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-text-muted">Em Carteira:</span>
                      <span className="font-mono font-bold text-text-primary">
                        {item.portfolio.quantity.toLocaleString(item.type === 'CRYPTO' ? 'en-US' : 'pt-BR', {
                          maximumFractionDigits: item.type === 'CRYPTO' ? 4 : 0,
                        })}{' '}
                        unid.
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-text-muted">Preço Médio:</span>
                      <span className="font-mono text-text-secondary">
                        {formatPrice({ ...item, price: item.portfolio.averagePrice })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border-default/40">
                      <span className="text-text-muted">Resultado:</span>
                      <span
                        className={`font-mono font-bold ${
                          item.portfolio.profitLoss >= 0 ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {item.portfolio.profitLoss >= 0 ? '+' : ''}
                        {formatPrice({ ...item, price: item.portfolio.profitLoss })} (
                        {item.portfolio.profitLoss >= 0 ? '+' : ''}
                        {item.portfolio.profitLossPct.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                )}

                <div className="pt-2 border-t border-border-default/40 grid grid-cols-2 gap-2 text-[11px] text-text-muted">
                  <div>
                    <span>Mín / Máx 24h:</span>
                    <p className="font-medium text-text-secondary tabular-nums">
                      {item.low24h > 0 ? (item.currency === 'USD' ? `$${item.low24h}` : `R$${item.low24h}`) : '--'} -{' '}
                      {item.high24h > 0 ? (item.currency === 'USD' ? `$${item.high24h}` : `R$${item.high24h}`) : '--'}
                    </p>
                  </div>

                  <div className="text-right">
                    <span>Mercado / Vol:</span>
                    <p className="font-medium text-text-secondary">{item.marketCap || '--'}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Modal para Criar Alerta de Preço */}
      {isAlertModalOpen && selectedAssetForAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-bg-surface border border-border-default rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border-default/60 pb-3">
              <div className="flex items-center gap-2">
                <BellRing className="h-5 w-5 text-accent-gold" />
                <h3 className="font-bold text-base text-text-primary">
                  Alerta de Preço: {selectedAssetForAlert.ticker}
                </h3>
              </div>
              <button
                onClick={() => setIsAlertModalOpen(false)}
                className="text-text-muted hover:text-text-primary p-1 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Informações do Ativo */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-bg-elevated border border-border-default/60">
              <div className="flex items-center gap-2.5">
                <AssetLogo
                  ticker={selectedAssetForAlert.ticker.replace(/\.SA$/, '')}
                  name={selectedAssetForAlert.name}
                  assetType={selectedAssetForAlert.type}
                  sizeClassName="h-8 w-8"
                />
                <div>
                  <span className="font-bold text-sm text-text-primary">{selectedAssetForAlert.ticker}</span>
                  <p className="text-xs text-text-muted">{selectedAssetForAlert.name}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-text-muted">Preço Atual</span>
                <p className="font-bold text-sm text-accent-gold tabular-nums">
                  {formatPrice(selectedAssetForAlert)}
                </p>
              </div>
            </div>

            {/* Condição do Alerta */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Disparar notificação quando o preço for:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAlertCondition('ABOVE')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                    alertCondition === 'ABOVE'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500'
                      : 'bg-bg-elevated text-text-muted border-border-default'
                  }`}
                >
                  <ArrowUpRight className="h-4 w-4" />
                  <span>Maior ou igual a (≥)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAlertCondition('BELOW')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                    alertCondition === 'BELOW'
                      ? 'bg-rose-500/20 text-rose-400 border-rose-500'
                      : 'bg-bg-elevated text-text-muted border-border-default'
                  }`}
                >
                  <ArrowDownRight className="h-4 w-4" />
                  <span>Menor ou igual a (≤)</span>
                </button>
              </div>
            </div>

            {/* Preço Alvo */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">
                Preço Alvo ({selectedAssetForAlert.currency === 'USD' ? 'USD $' : 'BRL R$'})
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-text-muted">
                  {selectedAssetForAlert.currency === 'USD' ? '$' : 'R$'}
                </span>
                <input
                  type="number"
                  step="any"
                  value={alertTargetPrice}
                  onChange={(e) => setAlertTargetPrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-lg text-sm bg-[#161F30] border border-slate-700 text-white placeholder:text-slate-400 font-bold tabular-nums focus:outline-none focus:border-accent-gold focus:bg-[#1A253A]"
                  autoFocus
                />
              </div>
            </div>

            {/* Observação Opcional */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Observação (Opcional)</label>
              <input
                type="text"
                value={alertNote}
                onChange={(e) => setAlertNote(e.target.value)}
                placeholder="Ex: Ponto de entrada, realizar lucro, stop..."
                className="w-full px-3.5 py-2 rounded-lg text-xs bg-[#161F30] border border-slate-700 text-white placeholder:text-slate-400 focus:outline-none focus:border-accent-gold focus:bg-[#1A253A]"
              />
            </div>

            <div className="p-3 rounded-xl bg-accent-gold/10 border border-accent-gold/20 text-[11px] text-text-secondary space-y-1">
              <p className="font-semibold text-accent-gold">🔔 Notificações Ativadas:</p>
              <p>Você receberá um aviso sonoro/visual no app e uma mensagem no WhatsApp quando o preço atingir o alvo.</p>
            </div>

            {/* Botões */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-default/60">
              <button
                type="button"
                onClick={() => setIsAlertModalOpen(false)}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-text-muted hover:text-text-primary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveAlert}
                disabled={!alertTargetPrice || savingAlert}
                className="px-4 py-2 rounded-lg text-xs font-bold text-black bg-accent-gold hover:bg-accent-gold/90 transition-all shadow-xs disabled:opacity-50"
              >
                {savingAlert ? 'Criando Alerta...' : 'Criar Alerta de Preço'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. Modal para Gerenciar Alertas Cadastrados */}
      {isManageAlertsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-lg bg-bg-surface border border-border-default rounded-2xl shadow-2xl p-5 space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-border-default/60 pb-3 shrink-0">
              <div className="flex items-center gap-2">
                <BellRing className="h-5 w-5 text-accent-gold" />
                <h3 className="font-bold text-base text-text-primary">Alertas de Preço</h3>
              </div>
              <button
                onClick={() => setIsManageAlertsOpen(false)}
                className="text-text-muted hover:text-text-primary p-1 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-2.5 flex-1 pr-1">
              {alertsList.length === 0 ? (
                <div className="py-8 text-center text-text-muted space-y-2">
                  <Bell className="h-8 w-8 mx-auto opacity-40 text-accent-gold" />
                  <p className="text-sm font-medium text-text-primary">Nenhum alerta cadastrado ainda</p>
                  <p className="text-xs">
                    Clique no ícone de sino ao lado de qualquer ativo para definir seu primeiro alerta de preço.
                  </p>
                </div>
              ) : (
                alertsList.map((alert) => {
                  const sym = alert.currency === 'USD' ? '$' : 'R$';
                  return (
                    <div
                      key={alert.id}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${
                        alert.triggered
                          ? 'bg-bg-elevated/40 border-border-default/50 opacity-70'
                          : 'bg-bg-elevated border-border-default'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-text-primary">{alert.ticker}</span>
                          <span
                            className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                              alert.condition === 'ABOVE'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-rose-500/15 text-rose-400'
                            }`}
                          >
                            {alert.condition === 'ABOVE' ? '≥ Maior que' : '≤ Menor que'} {sym} {alert.targetPrice.toFixed(2)}
                          </span>
                          {alert.triggered && (
                            <span className="text-[10px] font-semibold bg-amber-500/15 text-amber-400 px-1.5 py-0.2 rounded">
                              Disparado
                            </span>
                          )}
                        </div>

                        {alert.note && (
                          <p className="text-xs text-text-muted mt-0.5 truncate">{alert.note}</p>
                        )}
                        <p className="text-[10px] text-text-muted mt-0.5">
                          Criado em: {new Date(alert.createdAt).toLocaleDateString('pt-BR')}
                          {alert.triggeredAt && ` · Disparou às ${new Date(alert.triggeredAt).toLocaleTimeString('pt-BR')}`}
                        </p>
                      </div>

                      <button
                        onClick={() => handleDeleteAlert(alert.id)}
                        className="p-1.5 text-text-muted hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors shrink-0"
                        title="Excluir alerta"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="pt-2 border-t border-border-default/60 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsManageAlertsOpen(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-text-primary bg-bg-elevated hover:bg-bg-elevated/80 border border-border-default/80"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. Modal para Adicionar Novo Ativo */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-md bg-bg-surface border border-border-default rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border-default/60 pb-3">
              <div className="flex items-center gap-2">
                <Plus className="h-5 w-5 text-accent-gold" />
                <h3 className="font-bold text-base text-text-primary">Adicionar Ativo ao Radar</h3>
              </div>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-text-muted hover:text-text-primary p-1 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tipo de Ativo */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Mercado</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewTickerType('STOCK')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                    newTickerType === 'STOCK'
                      ? 'bg-blue-600/20 text-blue-400 border-blue-500'
                      : 'bg-bg-elevated text-text-muted border-border-default'
                  }`}
                >
                  <Building2 className="h-4 w-4" />
                  <span>🇧🇷 Bolsa B3 (Ação / FII)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setNewTickerType('CRYPTO')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all flex items-center justify-center gap-1.5 ${
                    newTickerType === 'CRYPTO'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500'
                      : 'bg-bg-elevated text-text-muted border-border-default'
                  }`}
                >
                  <Coins className="h-4 w-4" />
                  <span>🟡 Binance Cripto</span>
                </button>
              </div>
            </div>

            {/* Input do Ticker */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-text-secondary">Código / Ticker</label>
              <input
                type="text"
                value={newTickerInput}
                onChange={(e) => setNewTickerInput(e.target.value.toUpperCase())}
                placeholder={newTickerType === 'STOCK' ? 'Ex: PETR4, VALE3, WEGE3, BBAS3' : 'Ex: BTC, ETH, SOL, RENDER'}
                className="w-full px-3.5 py-2.5 rounded-lg text-sm bg-[#161F30] border border-slate-700 text-white placeholder:text-slate-400 focus:outline-none focus:border-accent-gold focus:bg-[#1A253A] font-bold"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleAddTicker();
                }}
              />
            </div>

            {/* Sugestões de Autocomplete ao Digitar */}
            {modalSuggestions.length > 0 && newTickerInput.trim().length >= 1 && (
              <div className="space-y-1 bg-[#0A0E1A] border border-slate-700 rounded-xl p-2 max-h-40 overflow-y-auto">
                <span className="text-[10px] font-bold text-accent-gold uppercase tracking-wider block px-1 pb-1">
                  Correspondências encontradas:
                </span>
                <div className="space-y-1">
                  {modalSuggestions.map((item) => (
                    <button
                      key={item.ticker}
                      type="button"
                      onClick={() => void handleAddTicker(item.ticker, item.type)}
                      className="w-full flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-800/80 text-left transition-colors group cursor-pointer"
                    >
                      <div className="truncate pr-2">
                        <span className="font-bold text-xs font-mono text-accent-gold group-hover:text-amber-300">
                          {item.ticker.replace(/\.SA$/, '')}
                        </span>
                        <span className="text-[10px] text-slate-400 ml-2 truncate">
                          {item.name}
                        </span>
                      </div>
                      <span className="text-[10px] font-bold text-black bg-accent-gold px-2 py-0.5 rounded shadow-xs shrink-0">
                        + Adicionar
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Sugestões Populares */}
            <div className="space-y-1.5">
              <span className="text-[11px] text-text-muted">Sugestões rápidas:</span>
              <div className="flex flex-wrap gap-1.5">
                {(newTickerType === 'STOCK' ? SUGGESTED_B3 : SUGGESTED_CRYPTO).map((sug) => (
                  <button
                    key={sug.ticker}
                    type="button"
                    onClick={() => void handleAddTicker(sug.ticker, sug.type)}
                    className="text-xs px-2.5 py-1 rounded-md bg-bg-elevated hover:bg-accent-gold/20 hover:text-accent-gold border border-border-default/80 text-text-secondary transition-all"
                  >
                    + {sug.ticker.replace(/\.SA$/, '')}
                  </button>
                ))}
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-default/60">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-text-muted hover:text-text-primary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleAddTicker()}
                disabled={!newTickerInput.trim() || addingTicker}
                className="px-4 py-2 rounded-lg text-xs font-bold text-black bg-accent-gold hover:bg-accent-gold/90 transition-all disabled:opacity-50"
              >
                {addingTicker ? 'Adicionando...' : 'Adicionar ao Radar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Remoção de Ativo */}
      {tickerToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => {
            if (!deletingTicker) setTickerToDelete(null);
          }}
        >
          <div
            className="bg-[#0E1524] border border-border-default/80 rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-base text-text-primary">Remover do Radar?</h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Deseja remover <strong className="text-text-primary">{tickerToDelete}</strong> da sua lista de acompanhamento?
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-default/60">
              <button
                type="button"
                disabled={deletingTicker}
                onClick={() => setTickerToDelete(null)}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingTicker}
                onClick={() => void handleRemoveTicker(tickerToDelete)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 active:scale-95 transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50"
              >
                {deletingTicker ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Removendo...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Remover</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Venda de Ativo */}
      <SellInvestmentModal
        open={!!sellingInvestment}
        investment={sellingInvestment}
        availableInvestments={investments}
        onClose={() => setSellingInvestment(null)}
        onSuccess={() => {
          void loadPortfolio();
          void loadWatchlist(true);
        }}
      />
    </div>
  );
}
