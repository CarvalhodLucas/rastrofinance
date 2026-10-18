import crypto from 'crypto';
import type { InvestmentTrade } from './tradeService.js';
import { getUsdBrlRate } from './quoteService.js';

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

    const signature = crypto.createHmac('sha256', apiSecret).update(qs).digest('hex');
    const url = `https://api.binance.com${endpoint}?${qs}&signature=${signature}`;
    const res = await fetch(url, { headers: { 'X-MBX-APIKEY': apiKey } });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function fetchPaginated<T>(
  endpoint: string,
  apiKey: string,
  apiSecret: string,
  extraParams: Record<string, string> = {},
  listKey: string = 'list'
): Promise<T[]> {
  const now = Date.now();
  const allItems: T[] = [];
  // Busca em blocos de 30 dias para os últimos 12 meses
  for (let i = 0; i < 12; i++) {
    const endTime = now - i * 30 * 24 * 60 * 60 * 1000;
    const startTime = endTime - 30 * 24 * 60 * 60 * 1000;
    const data = await queryBinanceSigned<any>(endpoint, apiKey, apiSecret, {
      startTime: String(startTime),
      endTime: String(endTime),
      limit: '1000',
      ...extraParams,
    });
    const list = data?.[listKey] || data?.data || data || [];
    if (Array.isArray(list) && list.length > 0) {
      allItems.push(...list);
    }
  }
  return allItems;
}

export async function fetchFullBinanceHistoryAPI(
  apiKey: string,
  apiSecret: string,
  activeTickers: string[] = []
): Promise<InvestmentTrade[]> {
  const trades: InvestmentTrade[] = [];
  const usdtBrlRate = await getUsdBrlRate();

  // 1. Convert History
  const converts = await fetchPaginated<any>('/sapi/v1/convert/tradeFlow', apiKey, apiSecret, {}, 'list');
  for (const item of converts) {
    const fromAsset = item.fromAsset.toUpperCase();
    const toAsset = item.toAsset.toUpperCase();
    const fromAmount = parseFloat(item.fromAmount);
    const toAmount = parseFloat(item.toAmount);
    const date = new Date(item.createTime).toISOString();
    
    const isFiatFrom = fromAsset === 'BRL' || fromAsset === 'USDT' || fromAsset === 'USD';
    let totalBrl = fromAmount;
    if (fromAsset === 'USDT' || fromAsset === 'USD') totalBrl = fromAmount * usdtBrlRate;
    const unitPriceBrl = toAmount > 0 ? totalBrl / toAmount : 0;

    if (isFiatFrom) {
      trades.push({
        id: `api_bin_conv_${item.quoteId || item.orderId}`,
        trade_type: 'BUY',
        asset_type: 'CRYPTO',
        ticker: toAsset,
        asset_name: toAsset,
        institution: 'Binance',
        quantity: toAmount,
        unit_price: unitPriceBrl,
        total_value: totalBrl,
        from_ticker: fromAsset,
        from_quantity: fromAmount,
        date,
        source: 'BINANCE_API',
        notes: `Conversão API: ${fromAsset} ➔ ${toAsset}`,
      });
    } else {
      trades.push({
        id: `api_bin_swap_${item.quoteId || item.orderId}`,
        trade_type: 'SWAP',
        asset_type: 'CRYPTO',
        ticker: toAsset,
        asset_name: toAsset,
        institution: 'Binance',
        quantity: toAmount,
        unit_price: unitPriceBrl,
        total_value: totalBrl,
        from_ticker: fromAsset,
        from_quantity: fromAmount,
        to_ticker: toAsset,
        to_quantity: toAmount,
        date,
        source: 'BINANCE_API',
        notes: `Swap API: ${fromAmount} ${fromAsset} ➔ ${toAmount} ${toAsset}`,
      });
    }
  }

  // 2. Fiat Payments (Buy Crypto with PIX/Card)
  const fiatPayments = await fetchPaginated<any>('/sapi/v1/fiat/payments', apiKey, apiSecret, { transactionType: '0' }, 'data');
  for (const item of fiatPayments) {
    if (item.status !== 'Completed') continue;
    const toAmt = parseFloat(item.obtainAmount);
    const fiatAmt = parseFloat(item.sourceAmount);
    const date = new Date(item.createTime).toISOString();
    trades.push({
      id: `api_bin_fiat_pay_${item.orderNo}`,
      trade_type: 'BUY',
      asset_type: 'CRYPTO',
      ticker: item.cryptoCurrency,
      asset_name: item.cryptoCurrency,
      institution: 'Binance',
      quantity: toAmt,
      unit_price: toAmt > 0 ? fiatAmt / toAmt : 0,
      total_value: fiatAmt,
      from_ticker: item.fiatCurrency,
      from_quantity: fiatAmt,
      date,
      source: 'BINANCE_API',
      notes: `Compra Direta API: ${fiatAmt} ${item.fiatCurrency} ➔ ${item.cryptoCurrency}`,
    });
  }

  // 3. Fiat Deposits (BRL Deposit)
  const fiatDeposits = await fetchPaginated<any>('/sapi/v1/fiat/orders', apiKey, apiSecret, { transactionType: '0' }, 'data');
  for (const item of fiatDeposits) {
    if (item.status !== 'Successful' && item.status !== 'Completed') continue;
    const amt = parseFloat(item.amount);
    const date = new Date(item.createTime).toISOString();
    trades.push({
      id: `api_bin_dep_${item.orderNo}`,
      trade_type: 'DEPOSIT',
      asset_type: 'OTHER',
      ticker: item.fiatCurrency,
      asset_name: `Depósito ${item.fiatCurrency}`,
      institution: 'Binance',
      quantity: amt,
      unit_price: 1,
      total_value: amt,
      date,
      source: 'BINANCE_API',
      notes: `Depósito API (${item.method})`,
    });
  }

  // 4. Earn Flexible Rewards
  const earnRewards = await fetchPaginated<any>('/sapi/v1/simple-earn/flexible/history/rewards', apiKey, apiSecret, {}, 'rows');
  for (const item of earnRewards) {
    const amt = parseFloat(item.rewards);
    if (amt <= 0) continue;
    const date = new Date(item.time).toISOString();
    trades.push({
      id: `api_bin_earn_${item.time}_${item.asset}`,
      trade_type: 'EARN_INTEREST',
      asset_type: 'CRYPTO',
      ticker: item.asset,
      asset_name: `Rendimento ${item.asset}`,
      institution: 'Binance',
      quantity: amt,
      unit_price: 0,
      total_value: 0,
      date,
      source: 'BINANCE_API',
      notes: `Rendimento Flexível API`,
    });
  }
  
  // 5. Crypto Deposits
  const cryptoDeposits = await fetchPaginated<any>('/sapi/v1/capital/deposit/hisrec', apiKey, apiSecret, {}, 'data');
  for (const item of cryptoDeposits) {
    if (item.status !== 1) continue; // 1 = success
    const amt = parseFloat(item.amount);
    const date = new Date(item.insertTime).toISOString();
    trades.push({
      id: `api_bin_cdep_${item.txId || item.insertTime}`,
      trade_type: 'DEPOSIT',
      asset_type: 'CRYPTO',
      ticker: item.coin,
      asset_name: `Depósito ${item.coin}`,
      institution: 'Binance',
      quantity: amt,
      unit_price: 0,
      total_value: 0,
      date,
      source: 'BINANCE_API',
      notes: `Depósito Cripto API (Rede: ${item.network})`,
    });
  }

  // 6. Spot Trades (Para os ativos ativos)
  for (const ticker of activeTickers) {
    if (ticker === 'BRL' || ticker === 'USDT') continue;
    
    // Tentar com BRL
    const tradesBrl = await queryBinanceSigned<any[]>('/api/v3/myTrades', apiKey, apiSecret, { symbol: `${ticker}BRL` });
    if (Array.isArray(tradesBrl)) {
      for (const t of tradesBrl) {
        const qty = parseFloat(t.qty);
        const quoteQty = parseFloat(t.quoteQty); // total em BRL
        const date = new Date(t.time).toISOString();
        trades.push({
          id: `api_bin_spot_${t.id}`,
          trade_type: t.isBuyer ? 'BUY' : 'SELL',
          asset_type: 'CRYPTO',
          ticker,
          asset_name: ticker,
          institution: 'Binance',
          quantity: qty,
          unit_price: quoteQty / qty,
          total_value: quoteQty,
          from_ticker: t.isBuyer ? 'BRL' : ticker,
          from_quantity: t.isBuyer ? quoteQty : qty,
          date,
          source: 'BINANCE_API',
          notes: `Spot Trade API: ${ticker}/BRL`,
        });
      }
    }
    
    // Tentar com USDT
    const tradesUsdt = await queryBinanceSigned<any[]>('/api/v3/myTrades', apiKey, apiSecret, { symbol: `${ticker}USDT` });
    if (Array.isArray(tradesUsdt)) {
      for (const t of tradesUsdt) {
        const qty = parseFloat(t.qty);
        const quoteQty = parseFloat(t.quoteQty); // total em USDT
        const totalBrl = quoteQty * usdtBrlRate;
        const date = new Date(t.time).toISOString();
        trades.push({
          id: `api_bin_spot_${t.id}`,
          trade_type: t.isBuyer ? 'BUY' : 'SELL',
          asset_type: 'CRYPTO',
          ticker,
          asset_name: ticker,
          institution: 'Binance',
          quantity: qty,
          unit_price: totalBrl / qty,
          total_value: totalBrl,
          from_ticker: t.isBuyer ? 'USDT' : ticker,
          from_quantity: t.isBuyer ? quoteQty : qty,
          date,
          source: 'BINANCE_API',
          notes: `Spot Trade API: ${ticker}/USDT`,
        });
      }
    }
  }

  return trades.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
