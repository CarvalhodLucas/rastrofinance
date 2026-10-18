import crypto from 'crypto';
import { getAllInvestments, upsertInvestment } from './supabaseService.js';
import type { Investment } from '../types.js';

interface BinanceBalance {
  asset: string;
  free: string;
  locked: string;
}

interface BinanceTicker {
  symbol: string;
  price: string;
}

interface BinanceConvertTrade {
  quoteId?: string;
  orderId?: number;
  fromAsset: string;
  fromAmount: string;
  toAsset: string;
  toAmount: string;
  inverseRatio: string; // Preço por unidade do toAsset
  createTime: number;
}

/**
 * Utilitário para fazer chamadas autenticadas HMAC-SHA256 na Binance API
 */
async function queryBinanceSigned<T>(
  endpoint: string,
  apiKey: string,
  apiSecret: string,
  params: Record<string, string> = {},
): Promise<T | null> {
  try {
    const timestamp = Date.now();
    const qs = new URLSearchParams({
      timestamp: String(timestamp),
      ...params,
    }).toString();

    const signature = crypto
      .createHmac('sha256', apiSecret)
      .update(qs)
      .digest('hex');

    const url = `https://api.binance.com${endpoint}?${qs}&signature=${signature}`;
    const res = await fetch(url, {
      headers: {
        'X-MBX-APIKEY': apiKey,
      },
    });

    if (!res.ok) {
      return null;
    }

    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/**
 * Busca todo o histórico de Binance Convert em blocos de 30 dias (limite da Binance API)
 */
async function fetchAllConvertTrades(
  apiKey: string,
  apiSecret: string,
): Promise<BinanceConvertTrade[]> {
  const now = Date.now();
  const allTrades: BinanceConvertTrade[] = [];

  // Loop pelos últimos 12 meses em blocos de 30 dias
  for (let i = 0; i < 12; i++) {
    const endTime = now - i * 30 * 24 * 60 * 60 * 1000;
    const startTime = endTime - 30 * 24 * 60 * 60 * 1000;
    const data = await queryBinanceSigned<{ list?: BinanceConvertTrade[] }>(
      '/sapi/v1/convert/tradeFlow',
      apiKey,
      apiSecret,
      {
        startTime: String(startTime),
        endTime: String(endTime),
        limit: '1000',
      },
    );

    if (data?.list && data.list.length > 0) {
      allTrades.push(...data.list);
    }
  }

  return allTrades;
}

/**
 * Conecta à API da Binance usando HMAC SHA256 e sincroniza a carteira de Cripto no CRM
 * (incluindo saldos Spot, Binance Earn e histórico de Preço Médio de compra via Binance Convert).
 */
export async function syncBinancePortfolio(
  apiKey: string,
  apiSecret: string,
): Promise<Investment[]> {
  if (!apiKey || !apiSecret) {
    throw new Error('Chaves da Binance (API Key e Secret Key) não foram configuradas.');
  }

  // Mapa para consolidar saldos de Spot + Earn por ativo
  const assetQuantities = new Map<string, number>();

  // 1. Buscar Saldos Spot (/api/v3/account)
  const spotData = await queryBinanceSigned<{ balances?: BinanceBalance[] }>(
    '/api/v3/account',
    apiKey,
    apiSecret,
  );

  if (spotData?.balances) {
    for (const b of spotData.balances) {
      const qty = parseFloat(b.free) + parseFloat(b.locked);
      if (qty > 0) {
        const coin = b.asset.toUpperCase();
        assetQuantities.set(coin, (assetQuantities.get(coin) || 0) + qty);
      }
    }
  }

  // 2. Buscar Saldos Binance Earn Flexível (/sapi/v1/simple-earn/flexible/position)
  const flexibleEarnData = await queryBinanceSigned<{
    rows?: Array<{ asset: string; totalAmount: string }>;
  }>('/sapi/v1/simple-earn/flexible/position', apiKey, apiSecret);

  if (flexibleEarnData?.rows) {
    for (const item of flexibleEarnData.rows) {
      const qty = parseFloat(item.totalAmount);
      if (qty > 0) {
        const coin = item.asset.toUpperCase();
        assetQuantities.set(coin, (assetQuantities.get(coin) || 0) + qty);
      }
    }
  }

  // 3. Buscar Saldos Binance Earn Bloqueado (/sapi/v1/simple-earn/locked/position)
  const lockedEarnData = await queryBinanceSigned<{
    rows?: Array<{ asset: string; amount: string }>;
  }>('/sapi/v1/simple-earn/locked/position', apiKey, apiSecret);

  if (lockedEarnData?.rows) {
    for (const item of lockedEarnData.rows) {
      const qty = parseFloat(item.amount);
      if (qty > 0) {
        const coin = item.asset.toUpperCase();
        assetQuantities.set(coin, (assetQuantities.get(coin) || 0) + qty);
      }
    }
  }

  if (assetQuantities.size === 0) {
    return [];
  }

  // Buscar cotações globais em BRL da Binance
  const pricesRes = await fetch('https://api.binance.com/api/v3/ticker/price');
  let tickers: BinanceTicker[] = [];
  if (pricesRes.ok) {
    tickers = (await pricesRes.json()) as BinanceTicker[];
  }

  const priceMap = new Map<string, number>();
  for (const t of tickers) {
    priceMap.set(t.symbol, parseFloat(t.price));
  }

  const usdtBrlRate = priceMap.get('USDTBRL') ?? priceMap.get('BUSDBRL') ?? 5.5;

  // 4. Buscar histórico de compras Convert (paginado em blocos de 30 dias) para calcular Preço Médio
  const convertList = await fetchAllConvertTrades(apiKey, apiSecret);
  const convertAvgPrices = new Map<string, number>();

  if (convertList.length > 0) {
    const assetTotals = new Map<string, { totalSpentUsd: number; totalQty: number }>();

    for (const trade of convertList) {
      const toAsset = trade.toAsset.toUpperCase();
      const qty = parseFloat(trade.toAmount);
      const unitPrice = parseFloat(trade.inverseRatio);

      if (qty <= 0 || isNaN(unitPrice)) continue;

      let unitPriceInUsd = 0;
      if (trade.fromAsset.toUpperCase() === 'USDT' || trade.fromAsset.toUpperCase() === 'USD') {
        unitPriceInUsd = unitPrice;
      } else if (trade.fromAsset.toUpperCase() === 'BRL') {
        // Câmbio histórico médio de conversão na data da compra na Binance
        unitPriceInUsd = unitPrice / 5.1078;
      }

      if (unitPriceInUsd > 0) {
        const current = assetTotals.get(toAsset) || { totalSpentUsd: 0, totalQty: 0 };
        current.totalSpentUsd += qty * unitPriceInUsd;
        current.totalQty += qty;
        assetTotals.set(toAsset, current);
      }
    }

    for (const [asset, totals] of assetTotals.entries()) {
      if (totals.totalQty > 0) {
        convertAvgPrices.set(asset, totals.totalSpentUsd / totals.totalQty);
      }
    }
  }

  // Buscar ativos existentes da Binance
  const existingInvestments = await getAllInvestments();
  const existingMap = new Map<string, Investment>();
  for (const inv of existingInvestments) {
    if (inv.institution === 'Binance' || inv.asset_type === 'CRYPTO') {
      if (!existingMap.has(inv.code_ticker.toUpperCase())) {
        existingMap.set(inv.code_ticker.toUpperCase(), inv);
      }
    }
  }

  const syncedInvestments: Investment[] = [];
  const syncedTickers = new Set<string>();

  for (const [coin, quantity] of assetQuantities.entries()) {
    if (quantity <= 0.000001) continue;

    let priceInUsd = 0;
    if (coin === 'USD' || coin === 'USDT' || coin === 'BUSD' || coin === 'USDC') {
      priceInUsd = 1.0;
    } else if (priceMap.has(`${coin}USDT`)) {
      priceInUsd = priceMap.get(`${coin}USDT`)!;
    } else if (priceMap.has(`${coin}BRL`)) {
      priceInUsd = priceMap.get(`${coin}BRL`)! / usdtBrlRate;
    }

    const totalValueUsd = quantity * priceInUsd;

    // Se o valor total em USD for desprezível (menos de $0.02 USD), ignora poeira (dust)
    if (totalValueUsd < 0.02 && coin !== 'BRL' && coin !== 'USDT') {
      continue;
    }

    const existing = existingMap.get(coin);
    const convertPrice = convertAvgPrices.get(coin);

    let avgPriceUsd = priceInUsd;
    if (existing?.average_price && existing.average_price > 0) {
      let originalAvgPrice = existing.average_price;
      let originalCurrency = existing.currency || 'USD';


      if (originalCurrency === 'BRL') {
        avgPriceUsd = originalAvgPrice / usdtBrlRate;
      } else if (originalCurrency === 'EUR') {
        const eurBrlRate = priceMap.get('EURBRL') ?? 6.0;
        avgPriceUsd = (originalAvgPrice * eurBrlRate) / usdtBrlRate;
      } else {
        avgPriceUsd = originalAvgPrice;
      }
    } else if (convertPrice && convertPrice > 0) {
      avgPriceUsd = convertPrice;
    }

    const investmentData: Partial<Investment> = {
      ...(existing?.id ? { id: existing.id } : {}),
      name: coin,
      code_ticker: coin,
      asset_type: 'CRYPTO',
      institution: 'Binance',
      quantity,
      average_price: avgPriceUsd,
      current_price: priceInUsd,
      total_value: totalValueUsd,
      currency: 'USD',
      sync_source: 'BINANCE_API',
      last_synced_at: new Date().toISOString(),
    };

    const saved = await upsertInvestment(investmentData);
    syncedInvestments.push(saved);
    syncedTickers.add(coin);
  }

  // Limpar ativos da Binance que zeraram o saldo
  for (const [existingTicker, existingInv] of existingMap.entries()) {
    if (!syncedTickers.has(existingTicker)) {
      await upsertInvestment({
        id: existingInv.id,
        quantity: 0,
        total_value: 0,
        last_synced_at: new Date().toISOString(),
      });
    }
  }

  return syncedInvestments;
}

export interface TradeHistoryItem {
  id: string;
  type: 'CONVERT' | 'FIAT';
  date: string;
  from_asset: string;
  from_amount: number;
  to_asset: string;
  to_amount: number;
  unit_price_brl: number;
  total_brl: number;
}

/**
 * Busca o histórico completo de transações / conversões de compra da Binance com paginação por 30 dias.
 */
export async function getBinanceTradeHistory(
  apiKey: string,
  apiSecret: string,
): Promise<TradeHistoryItem[]> {
  const history: TradeHistoryItem[] = [];

  // Buscar cotação atual USDT/BRL para conversões em USDT
  const pricesRes = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=USDTBRL');
  let usdtBrlRate = 5.5;
  if (pricesRes.ok) {
    const data = (await pricesRes.json()) as { price?: string };
    if (data.price) usdtBrlRate = parseFloat(data.price);
  }

  // 1. Binance Convert paginado em blocos de 30 dias
  const convertList = await fetchAllConvertTrades(apiKey, apiSecret);

  for (const item of convertList) {
    const fromAsset = item.fromAsset.toUpperCase();
    const toAsset = item.toAsset.toUpperCase();
    const fromAmount = parseFloat(item.fromAmount) || 0;
    const toAmount = parseFloat(item.toAmount) || 0;
    const unitPrice = parseFloat(item.inverseRatio) || 0;

    let unitPriceInBrl = unitPrice;
    let totalBrl = fromAmount;

    if (fromAsset === 'USDT') {
      unitPriceInBrl = unitPrice * usdtBrlRate;
      totalBrl = fromAmount * usdtBrlRate;
    }

    history.push({
      id: item.quoteId || String(item.orderId),
      type: 'CONVERT',
      date: new Date(item.createTime).toISOString(),
      from_asset: fromAsset,
      from_amount: fromAmount,
      to_asset: toAsset,
      to_amount: toAmount,
      unit_price_brl: unitPriceInBrl,
      total_brl: totalBrl,
    });
  }

  // 2. Depósitos Fiat / PIX Buy
  const fiatData = await queryBinanceSigned<{
    data?: Array<{
      orderNo: string;
      fiatCurrency: string;
      amount: string;
      createTime: number;
      method: string;
    }>;
  }>('/sapi/v1/fiat/orders', apiKey, apiSecret, { transactionType: '0' });

  if (fiatData?.data) {
    for (const item of fiatData.data) {
      const amt = parseFloat(item.amount) || 0;
      history.push({
        id: item.orderNo,
        type: 'FIAT',
        date: new Date(item.createTime).toISOString(),
        from_asset: 'PIX/BRL',
        from_amount: amt,
        to_asset: 'BRL',
        to_amount: amt,
        unit_price_brl: 1.0,
        total_brl: amt,
      });
    }
  }

  // Ordenar da transação mais recente para a mais antiga
  return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
