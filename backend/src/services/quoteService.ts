import yahooFinance from 'yahoo-finance2';
import { isLucasUser, getUserSettingKey } from './userScopeService.js';
import type { UserSessionPayload } from './authService.js';

// Instância do Yahoo Finance v2.x
const yf = typeof yahooFinance === 'function' ? new (yahooFinance as any)() : (yahooFinance as any).default ? new ((yahooFinance as any).default)() : yahooFinance;

interface CacheEntry {
  data: any;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000; // Cache de 30 minutos para respostas com sucesso
const ERROR_CACHE_TTL_MS = 10 * 1000; // Cache de 10 segundos para falhas (evita overload)

const formatCap = (rawMarketCap: number) => {
  if (!rawMarketCap) return '--';
  if (rawMarketCap >= 1e12) return `${(rawMarketCap / 1e12).toFixed(1)}T`;
  if (rawMarketCap >= 1e9) return `${(rawMarketCap / 1e9).toFixed(0)}B`;
  if (rawMarketCap >= 1e6) return `${(rawMarketCap / 1e6).toFixed(0)}M`;
  return '--';
};

/**
 * Obtém a cotação atualizada do Dólar Comercial (USD/BRL).
 */
export async function getUsdBrlRate(): Promise<number> {
  const cacheKey = 'USD_BRL_RATE';
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 15 * 60 * 1000) {
    return cached.data;
  }
  try {
    const q: any = await yf.quote('USDBRL=X');
    const rate = q?.regularMarketPrice || q?.price || 5.20;
    memoryCache.set(cacheKey, { data: rate, timestamp: Date.now() });
    return rate;
  } catch {
    return 5.20;
  }
}

/**
 * Obtém a cotação atualizada do Euro Comercial (EUR/BRL).
 */
export async function getEurBrlRate(): Promise<number> {
  const cacheKey = 'EUR_BRL_RATE';
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 15 * 60 * 1000) {
    return cached.data;
  }
  try {
    const q: any = await yf.quote('EURBRL=X');
    const rate = q?.regularMarketPrice || q?.price || 5.50;
    memoryCache.set(cacheKey, { data: rate, timestamp: Date.now() });
    return rate;
  } catch {
    return 5.50;
  }
}

interface CryptoDetails {
  price: number;
  currency: string;
  variation: string;
  high24h?: number;
  low24h?: number;
  volume?: number;
  changeAmount?: number;
}

const KNOWN_CRYPTO_NAMES: Record<string, string> = {
  RENDER: 'Render',
  XRP: 'XRP',
  LINK: 'ChainLink',
  ROSE: 'Oasis Network',
  VIRTUAL: 'Virtuals Protocol',
  SOL: 'Solana',
  ONDO: 'Ondo',
  ETH: 'Ethereum',
  BTC: 'Bitcoin',
  ADA: 'Cardano',
  AVAX: 'Avalanche',
  DOT: 'Polkadot',
  BNB: 'BNB',
  NEAR: 'NEAR Protocol',
  SUI: 'Sui',
  PEPE: 'Pepe',
  DOGE: 'Dogecoin',
};

const KNOWN_STOCK_NAMES: Record<string, string> = {
  'CXSE3.SA': 'Caixa Seguridade',
  'BBSE3.SA': 'BB Seguridade',
  'WEGE3.SA': 'WEG S.A.',
  'WEGE3F.SA': 'WEG S.A.',
  'KLBN11.SA': 'Klabin S.A.',
  'BBAS3.SA': 'Banco do Brasil',
  'VULC3.SA': 'Vulcabras',
  'PETR4.SA': 'Petrobras PN',
  'ITSA4.SA': 'Itaúsa',
  'VALE3.SA': 'Vale S.A.',
  'B3SA3.SA': 'B3 S.A.',
  'ABEV3.SA': 'Ambev',
  'RENT3.SA': 'Localiza',
  'MGLU3.SA': 'Magazine Luiza',
  'PRIO3.SA': 'PRIO',
  'CEAB3.SA': 'C&A Modas (C&A Brasil)',
  'CEAB3': 'C&A Modas (C&A Brasil)',
};

export const DEFAULT_WATCHLIST_ITEMS: WatchlistItem[] = [];

/**
 * Busca preço spot oficial e em tempo real de Criptomoedas diretamente da API pública da Binance.
 */
async function getCryptoPriceFromBinance(symbol: string): Promise<CryptoDetails | null> {
  const clean = symbol.trim().toUpperCase().replace(/-USD$/, '').replace(/\.SA$/, '');

  // Ações da B3 (terminam em números como PETR4, XPML11) não são criptomoedas na Binance
  if (/^[A-Z]{4}[0-9]{1,2}F?$/.test(clean)) return null;

  try {
    // 1. Tenta buscar o par USDT com 24hr ticker completo
    const resUsdt = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${clean}USDT`);
    if (resUsdt.ok) {
      const data: any = await resUsdt.json();
      const price = parseFloat(data?.lastPrice);
      if (price > 0) {
        return {
          price,
          currency: 'USD',
          variation: parseFloat(data.priceChangePercent || '0').toFixed(2),
          high24h: parseFloat(data.highPrice || '0'),
          low24h: parseFloat(data.lowPrice || '0'),
          volume: parseFloat(data.volume || '0'),
          changeAmount: parseFloat(data.priceChange || '0'),
        };
      }
    }

    // 2. Tenta buscar o par BRL
    const resBrl = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${clean}BRL`);
    if (resBrl.ok) {
      const data: any = await resBrl.json();
      const price = parseFloat(data?.lastPrice);
      if (price > 0) {
        return {
          price,
          currency: 'BRL',
          variation: parseFloat(data.priceChangePercent || '0').toFixed(2),
          high24h: parseFloat(data.highPrice || '0'),
          low24h: parseFloat(data.lowPrice || '0'),
          volume: parseFloat(data.volume || '0'),
          changeAmount: parseFloat(data.priceChange || '0'),
        };
      }
    }
  } catch (err) {
    console.warn(`[binance-public] Erro ao consultar preço de ${clean}:`, err);
  }
  return null;
}

/**
 * Busca velas horárias recentes para gerar sparkline suave de Criptomoeda.
 */
async function getCryptoSparkline(cleanSymbol: string): Promise<number[]> {
  try {
    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${cleanSymbol}USDT&interval=1h&limit=16`);
    if (!res.ok) return [];
    const arr = (await res.json()) as any[];
    if (!Array.isArray(arr)) return [];
    return arr.map((k) => Number(parseFloat(k[4]).toFixed(cleanSymbol === 'ROSE' ? 5 : 4)));
  } catch {
    return [];
  }
}

/**
 * Busca histórico recente para gerar sparkline de Ações B3.
 */
async function getStockSparkline(yahooSymbol: string): Promise<number[]> {
  try {
    const d = new Date();
    d.setDate(d.getDate() - 3);
    const chartRes: any = await yf.chart(yahooSymbol, { period1: d, interval: '60m' });
    const quotes = chartRes?.quotes || [];
    return quotes
      .filter((q: any) => q.close != null)
      .slice(-16)
      .map((q: any) => Number(Number(q.close).toFixed(2)));
  } catch {
    return [];
  }
}

/**
 * Busca e calcula variações em múltiplos períodos (1D, 7D, 30D, 1Y) para Criptomoedas na Binance.
 */
async function getCryptoPeriodData(
  cleanSymbol: string,
  currentPrice: number,
  var24h: string,
  chg24h: number,
  sparkline1d: number[],
) {
  const cacheKey = `CRYPTO_PERIODS_${cleanSymbol}`;
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 15 * 60 * 1000) {
    return {
      ...cached.data,
      variations: { ...cached.data.variations, '1D': var24h },
      changeAmounts: { ...cached.data.changeAmounts, '1D': chg24h },
      sparklines: { ...cached.data.sparklines, '1D': sparkline1d },
    };
  }

  try {
    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${cleanSymbol}USDT&interval=1d&limit=365`);
    if (!res.ok) throw new Error('Binance klines failed');
    const arr = (await res.json()) as any[];
    if (!Array.isArray(arr) || arr.length === 0) throw new Error('Empty klines');

    const closes = arr.map((k) => parseFloat(k[4]));

    // 7D
    let var7d: string | undefined;
    let chg7d: number | undefined;
    let spark7d: number[] = [];
    if (arr.length >= 8) {
      const p7 = parseFloat(arr[arr.length - 8][4]);
      if (p7 > 0 && currentPrice > 0) {
        var7d = (((currentPrice - p7) / p7) * 100).toFixed(2);
        chg7d = currentPrice - p7;
      }
      spark7d = closes.slice(-7);
    }

    // 30D
    let var30d: string | undefined;
    let chg30d: number | undefined;
    let spark30d: number[] = [];
    if (arr.length >= 31) {
      const p30 = parseFloat(arr[arr.length - 31][4]);
      if (p30 > 0 && currentPrice > 0) {
        var30d = (((currentPrice - p30) / p30) * 100).toFixed(2);
        chg30d = currentPrice - p30;
      }
      spark30d = closes.slice(-30).filter((_, idx) => idx % 2 === 0);
    }

    // 1Y
    let var1y: string | undefined;
    let chg1y: number | undefined;
    let spark1y: number[] = [];
    if (arr.length >= 50) {
      const p1y = parseFloat(arr[0][4]);
      if (p1y > 0 && currentPrice > 0) {
        var1y = (((currentPrice - p1y) / p1y) * 100).toFixed(2);
        chg1y = currentPrice - p1y;
      }
      const step = Math.max(1, Math.floor(arr.length / 20));
      spark1y = closes.filter((_, idx) => idx % step === 0);
    }

    const periodData = {
      variations: {
        '1D': var24h,
        ...(var7d ? { '7D': var7d } : {}),
        ...(var30d ? { '30D': var30d } : {}),
        ...(var1y ? { '1Y': var1y } : {}),
      },
      changeAmounts: {
        '1D': chg24h,
        ...(chg7d !== undefined ? { '7D': chg7d } : {}),
        ...(chg30d !== undefined ? { '30D': chg30d } : {}),
        ...(chg1y !== undefined ? { '1Y': chg1y } : {}),
      },
      sparklines: {
        '1D': sparkline1d,
        ...(spark7d.length > 0 ? { '7D': spark7d } : {}),
        ...(spark30d.length > 0 ? { '30D': spark30d } : {}),
        ...(spark1y.length > 0 ? { '1Y': spark1y } : {}),
      },
    };

    memoryCache.set(cacheKey, { data: periodData, timestamp: Date.now() });
    return periodData;
  } catch {
    return {
      variations: { '1D': var24h },
      changeAmounts: { '1D': chg24h },
      sparklines: { '1D': sparkline1d },
    };
  }
}

/**
 * Busca e calcula variações em múltiplos períodos (1D, 7D, 30D, 1Y) para Ações B3 no Yahoo Finance.
 */
async function getStockPeriodData(
  yahooSymbol: string,
  currentPrice: number,
  var1d: string,
  chg1d: number,
  sparkline1d: number[],
) {
  const cacheKey = `STOCK_PERIODS_${yahooSymbol}`;
  const cached = memoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 15 * 60 * 1000) {
    return {
      ...cached.data,
      variations: { ...cached.data.variations, '1D': var1d },
      changeAmounts: { ...cached.data.changeAmounts, '1D': chg1d },
      sparklines: { ...cached.data.sparklines, '1D': sparkline1d },
    };
  }

  try {
    const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const chartRes: any = await yf.chart(yahooSymbol, { period1: oneYearAgo, interval: '1d' });
    const quotes = (chartRes?.quotes || []).filter((q: any) => q.close != null && q.close > 0);

    if (quotes.length === 0) throw new Error('No historical quotes');

    const closes = quotes.map((q: any) => Number(Number(q.close).toFixed(2)));

    // 7D (~5 pregões)
    let var7d: string | undefined;
    let chg7d: number | undefined;
    let spark7d: number[] = [];
    if (quotes.length >= 6) {
      const q7 = quotes[quotes.length - 6];
      const p7 = q7.close;
      if (p7 > 0 && currentPrice > 0) {
        var7d = (((currentPrice - p7) / p7) * 100).toFixed(2);
        chg7d = currentPrice - p7;
      }
      spark7d = closes.slice(-7);
    }

    // 30D (~22 pregões)
    let var30d: string | undefined;
    let chg30d: number | undefined;
    let spark30d: number[] = [];
    if (quotes.length >= 22) {
      const q30 = quotes[quotes.length - 22];
      const p30 = q30.close;
      if (p30 > 0 && currentPrice > 0) {
        var30d = (((currentPrice - p30) / p30) * 100).toFixed(2);
        chg30d = currentPrice - p30;
      }
      spark30d = closes.slice(-25).filter((_: any, idx: number) => idx % 2 === 0);
    }

    // 1Y (~250 pregões)
    let var1y: string | undefined;
    let chg1y: number | undefined;
    let spark1y: number[] = [];
    if (quotes.length >= 40) {
      const q1y = quotes[0];
      const p1y = q1y.close;
      if (p1y > 0 && currentPrice > 0) {
        var1y = (((currentPrice - p1y) / p1y) * 100).toFixed(2);
        chg1y = currentPrice - p1y;
      }
      const step = Math.max(1, Math.floor(quotes.length / 20));
      spark1y = closes.filter((_: any, idx: number) => idx % step === 0);
    }

    const periodData = {
      variations: {
        '1D': var1d,
        ...(var7d ? { '7D': var7d } : {}),
        ...(var30d ? { '30D': var30d } : {}),
        ...(var1y ? { '1Y': var1y } : {}),
      },
      changeAmounts: {
        '1D': chg1d,
        ...(chg7d !== undefined ? { '7D': chg7d } : {}),
        ...(chg30d !== undefined ? { '30D': chg30d } : {}),
        ...(chg1y !== undefined ? { '1Y': chg1y } : {}),
      },
      sparklines: {
        '1D': sparkline1d,
        ...(spark7d.length > 0 ? { '7D': spark7d } : {}),
        ...(spark30d.length > 0 ? { '30D': spark30d } : {}),
        ...(spark1y.length > 0 ? { '1Y': spark1y } : {}),
      },
    };

    memoryCache.set(cacheKey, { data: periodData, timestamp: Date.now() });
    return periodData;
  } catch {
    return {
      variations: { '1D': var1d },
      changeAmounts: { '1D': chg1d },
      sparklines: { '1D': sparkline1d },
    };
  }
}

/**
 * Normaliza nomes longos ou truncados de ações da B3.
 */
function cleanStockName(rawName?: string, ticker?: string): string {
  if (ticker) {
    const known = KNOWN_STOCK_NAMES[ticker.toUpperCase()];
    if (known) return known;
  }
  if (!rawName) return ticker || '';
  return rawName
    .replace(/\s+(ON|PN|UNT|NM|N1|N2|EJ|ED|EB).*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * De-para de tickers renomeados ou incorporados na B3.
 */
const B3_TICKER_ALIASES: Record<string, string> = {
  'ELET3': 'AXIA3.SA',
  'ELET6': 'AXIA6.SA',
  'ELET3.SA': 'AXIA3.SA',
  'ELET6.SA': 'AXIA6.SA',
  'BRML3': 'ALOS3.SA',
  'BRML3.SA': 'ALOS3.SA',
};

/**
 * Normaliza o ticker adicionando `.SA` se for mercado brasileiro e não tiver sufixo.
 */
function normalizeSymbol(ticker: string): string {
  const clean = ticker.trim().toUpperCase();

  // Verifica se há alias conhecido (rebranding ou troca de código na B3)
  if (B3_TICKER_ALIASES[clean]) {
    return B3_TICKER_ALIASES[clean];
  }

  if (clean.includes('.') || clean.includes('-')) return clean;

  const commonCryptos = ['BTC', 'ETH', 'SOL', 'ONDO', 'SXT', 'LINK', 'RENDER', 'ROSE', 'VIRTUAL'];
  if (commonCryptos.includes(clean)) {
    return `${clean}-USD`;
  }

  // Ações e FIIs B3 (ex: PETR4, VULC3, XPML11)
  if (
    /^[A-Z]{4}[0-9]{1,2}$/.test(clean) ||
    /^[A-Z]{4}[0-9]{1,2}F$/.test(clean)
  ) {
    return `${clean}.SA`;
  }
  return clean;
}

/**
 * Processa um único ticker e aplica a lógica de cache em memória do RASTRO.
 */
export async function processQuoteTicker(
  rawTicker: string,
  mode: 'compact' | 'full' = 'full',
  bypassCache = false,
) {
  const originalSymbol = rawTicker.trim().toUpperCase();
  const yahooSymbol = normalizeSymbol(originalSymbol);
  const cacheKey = `${originalSymbol}_${mode}`;

  if (!bypassCache) {
    const cached = memoryCache.get(cacheKey);
    const isError = cached?.data && 'error' in cached.data;
    const ttl = isError ? ERROR_CACHE_TTL_MS : CACHE_TTL_MS;

    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }
  }

  // 1. Tentar obter preço spot em tempo real da Binance para Criptomoedas
  const binanceQuote = await getCryptoPriceFromBinance(originalSymbol);
  if (binanceQuote && binanceQuote.price > 0) {
    const resBinance = {
      symbol: originalSymbol,
      yahooSymbol: `${originalSymbol}-USD`,
      price: binanceQuote.price,
      name: KNOWN_CRYPTO_NAMES[originalSymbol] || originalSymbol,
      variation: binanceQuote.variation || '0.00',
      changeAmount: binanceQuote.changeAmount,
      high24h: binanceQuote.high24h,
      low24h: binanceQuote.low24h,
      volume: binanceQuote.volume,
      marketCap: '--',
      currency: binanceQuote.currency,
    };
    memoryCache.set(cacheKey, { data: resBinance, timestamp: Date.now() });
    return resBinance;
  }

  try {
    if (mode === 'compact') {
      const quote: any = await yf.quote(yahooSymbol);
      const resCompact = {
        symbol: originalSymbol,
        yahooSymbol,
        price: quote?.regularMarketPrice || quote?.price || 0,
        name: cleanStockName(quote?.longName || quote?.shortName, originalSymbol),
        variation: quote?.regularMarketChangePercent?.toFixed(2) || '0.00',
        changeAmount: quote?.regularMarketChange ?? 0,
        high24h: quote?.regularMarketDayHigh ?? 0,
        low24h: quote?.regularMarketDayLow ?? 0,
        volume: quote?.regularMarketVolume ?? 0,
        marketCap: quote?.marketCap ? formatCap(quote.marketCap) : '--',
        currency: quote?.currency || 'BRL',
      };
      memoryCache.set(cacheKey, { data: resCompact, timestamp: Date.now() });
      return resCompact;
    }

    const [quote, summary] = await Promise.all([
      yf.quote(yahooSymbol),
      yf.quoteSummary(yahooSymbol, {
        modules: ['defaultKeyStatistics', 'summaryDetail', 'financialData'],
      }).catch((summaryError: any) => {
        console.log(`⚠️ Aviso nos fundamentos para ${yahooSymbol}:`, summaryError.message);
        return {};
      }),
    ]);

    const lpa =
      summary?.defaultKeyStatistics?.trailingEps ||
      quote?.epsTrailingTwelveMonths ||
      quote?.epsCurrentYear ||
      0;
    let vpa = summary?.defaultKeyStatistics?.bookValue || quote?.bookValue || 0;
    const dyRaw =
      summary?.summaryDetail?.dividendYield ||
      summary?.summaryDetail?.trailingAnnualDividendYield ||
      quote?.trailingAnnualDividendYield ||
      quote?.dividendYield ||
      0;
    const dy = dyRaw * 100;
    const p_l =
      summary?.summaryDetail?.trailingPE ||
      quote?.trailingPE ||
      summary?.summaryDetail?.forwardPE ||
      quote?.forwardPE ||
      0;
    const priceToBook =
      summary?.defaultKeyStatistics?.priceToBook || quote?.priceToBook || 0;

    const priceValue = quote?.regularMarketPrice || quote?.price || 0;
    if (vpa === 0 && priceToBook > 0 && priceValue > 0) {
      vpa = priceValue / priceToBook;
    }

    let roeRaw = summary?.financialData?.returnOnEquity || 0;
    let roe = roeRaw * 100;
    if (roe === 0 && lpa !== 0 && vpa !== 0) roe = (lpa / vpa) * 100;

    const resFull = {
      symbol: originalSymbol,
      yahooSymbol,
      price: quote?.regularMarketPrice || quote?.price || 0,
      name: cleanStockName(quote?.longName || quote?.shortName, originalSymbol),
      currency: quote?.currency || 'BRL',
      variation: quote?.regularMarketChangePercent?.toFixed(2) || '0.00',
      changeAmount: quote?.regularMarketChange ?? 0,
      exchange: quote?.fullExchangeName || '',
      marketCap: formatCap(quote?.marketCap || 0),
      high24h: quote?.regularMarketDayHigh ?? 0,
      low24h: quote?.regularMarketDayLow ?? 0,
      volume: quote?.regularMarketVolume ?? 0,
      lpa,
      vpa,
      dy,
      p_l,
      roe,
      priceToBook,
      avgVolume:
        summary?.summaryDetail?.averageDailyVolume10Day ||
        quote?.averageDailyVolume10Day ||
        0,
      totalAssets: summary?.summaryDetail?.totalAssets || 0,
      defaultKeyStatistics: summary?.defaultKeyStatistics || {},
      summaryDetail: summary?.summaryDetail || {},
      financialData: summary?.financialData || {},
    };
    memoryCache.set(cacheKey, { data: resFull, timestamp: Date.now() });
    return resFull;
  } catch (err: any) {
    console.error(`❌ Erro no ticker ${originalSymbol} (${yahooSymbol}):`, err.message);
    const resError = { symbol: originalSymbol, yahooSymbol, error: err.message, price: 0 };
    memoryCache.set(cacheKey, { data: resError, timestamp: Date.now() });
    return resError;
  }
}

export interface WatchlistItem {
  ticker: string;
  type?: 'STOCK' | 'CRYPTO';
  name?: string;
}

export type WatchlistPeriod = '1D' | '7D' | '30D' | '1Y';

export interface WatchlistQuoteResult {
  ticker: string;
  yahooSymbol?: string;
  name: string;
  type: 'STOCK' | 'CRYPTO';
  price: number;
  currency: 'BRL' | 'USD';
  variation: string;
  changeAmount: number;
  variations?: Partial<Record<WatchlistPeriod, string>>;
  changeAmounts?: Partial<Record<WatchlistPeriod, number>>;
  sparklines?: Partial<Record<WatchlistPeriod, number[]>>;
  high24h: number;
  low24h: number;
  volume: number;
  marketCap: string;
  sparkline: number[];
  category: string;
}

export interface PriceAlert {
  id: string;
  ticker: string;
  targetPrice: number;
  condition: 'ABOVE' | 'BELOW';
  currency: 'BRL' | 'USD';
  createdAt: string;
  triggered: boolean;
  triggeredAt?: string;
  lastCheckedPrice?: number;
  note?: string;
}

export interface WatchlistResponse {
  items: WatchlistQuoteResult[];
  alerts?: PriceAlert[];
  triggeredAlerts?: PriceAlert[];
  b3Status: { isOpen: boolean; label: string; nextEvent: string };
  cryptoStatus: { isOpen: boolean; label: string };
  topGainer?: WatchlistQuoteResult;
  topLoser?: WatchlistQuoteResult;
  lastUpdated: string;
}

export function getB3MarketStatus(): { isOpen: boolean; label: string; nextEvent: string } {
  try {
    const now = new Date();
    const spTimeStr = now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' });
    const spDate = new Date(spTimeStr);
    const day = spDate.getDay(); // 0 = Sun, 6 = Sat
    const hour = spDate.getHours();
    const min = spDate.getMinutes();
    const totalMin = hour * 60 + min;

    const isWeekday = day >= 1 && day <= 5;
    const isOpenTime = totalMin >= 10 * 60 && totalMin < 18 * 60;

    if (isWeekday && isOpenTime) {
      return { isOpen: true, label: 'Aberto', nextEvent: 'Fecha às 18:00' };
    } else if (isWeekday && totalMin < 10 * 60) {
      return { isOpen: false, label: 'Fechado', nextEvent: 'Abre às 10:00' };
    } else {
      return { isOpen: false, label: 'Fechado', nextEvent: 'Abre segunda às 10:00' };
    }
  } catch {
    return { isOpen: false, label: 'Fechado', nextEvent: 'Horário B3' };
  }
}

export async function getPriceAlerts(user?: UserSessionPayload | null): Promise<PriceAlert[]> {
  try {
    const { getSetting } = await import('./supabaseService.js');
    const alertKey = getUserSettingKey('price_alerts', user);
    const alerts = await getSetting<PriceAlert[]>(alertKey);
    return Array.isArray(alerts) ? alerts : [];
  } catch {
    return [];
  }
}

export async function savePriceAlert(
  newAlert: Omit<PriceAlert, 'id' | 'createdAt' | 'triggered'>,
  user?: UserSessionPayload | null,
): Promise<PriceAlert> {
  const { getSetting, updateSetting } = await import('./supabaseService.js');
  const alertKey = getUserSettingKey('price_alerts', user);
  const current = (await getSetting<PriceAlert[]>(alertKey)) || [];
  const alert: PriceAlert = {
    ...newAlert,
    id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
    triggered: false,
  };
  const updated = [alert, ...current];
  await updateSetting(alertKey, updated);
  return alert;
}

export async function deletePriceAlert(id: string, user?: UserSessionPayload | null): Promise<void> {
  const { getSetting, updateSetting } = await import('./supabaseService.js');
  const alertKey = getUserSettingKey('price_alerts', user);
  const current = (await getSetting<PriceAlert[]>(alertKey)) || [];
  const updated = current.filter((a) => a.id !== id);
  await updateSetting(alertKey, updated);
}

export async function checkAndTriggerPriceAlerts(
  quotes: WatchlistQuoteResult[],
  user?: UserSessionPayload | null,
): Promise<PriceAlert[]> {
  try {
    const { getSetting, updateSetting } = await import('./supabaseService.js');
    const alertKey = getUserSettingKey('price_alerts', user);
    const alerts = await getSetting<PriceAlert[]>(alertKey);
    if (!Array.isArray(alerts) || alerts.length === 0) return [];

    const quotesMap = new Map<string, WatchlistQuoteResult>();
    for (const q of quotes) {
      quotesMap.set(q.ticker.toUpperCase(), q);
      quotesMap.set(q.ticker.replace(/\.SA$/, '').toUpperCase(), q);
      if (q.yahooSymbol) quotesMap.set(q.yahooSymbol.toUpperCase(), q);
    }

    let hasUpdates = false;
    const newlyTriggered: PriceAlert[] = [];

    const updatedAlerts = alerts.map((alert) => {
      if (alert.triggered) return alert;

      const q =
        quotesMap.get(alert.ticker.toUpperCase()) ||
        quotesMap.get(alert.ticker.replace(/\.SA$/, '').toUpperCase());
      if (!q || !q.price || q.price <= 0) return alert;

      const currentPrice = q.price;
      const isMet =
        alert.condition === 'ABOVE'
          ? currentPrice >= alert.targetPrice
          : currentPrice <= alert.targetPrice;

      if (isMet) {
        hasUpdates = true;
        const triggeredAlert: PriceAlert = {
          ...alert,
          triggered: true,
          triggeredAt: new Date().toISOString(),
          lastCheckedPrice: currentPrice,
        };
        newlyTriggered.push(triggeredAlert);
        return triggeredAlert;
      }
      return alert;
    });

    if (hasUpdates) {
      await updateSetting(alertKey, updatedAlerts);

      // Notificação via WhatsApp caso configurado
      for (const t of newlyTriggered) {
        try {
          const { sendText } = await import('./whatsappService.js');
          const condText = t.condition === 'ABOVE' ? 'atingiu ou superou' : 'caiu para ou abaixo de';
          const symbolStr = t.currency === 'USD' ? '$' : 'R$';
          const msg = `🔔 *ALERTA DE PREÇO DISPARADO!*\n\nO ativo *${t.ticker}* ${condText} o seu preço alvo!\n\n🎯 *Preço Alvo:* ${symbolStr} ${t.targetPrice.toFixed(2)}\n📈 *Preço Atual:* ${symbolStr} ${t.lastCheckedPrice?.toFixed(2)}\n🕒 *Horário:* ${new Date().toLocaleTimeString('pt-BR')}`;
          await sendText(msg).catch(() => {});
        } catch (e) {
          console.warn('[alerts] Erro ao enviar WhatsApp do alerta:', e);
        }
      }
    }

    return newlyTriggered;
  } catch (err) {
    console.error('[alerts] Erro ao verificar alertas:', err);
    return [];
  }
}

export async function getWatchlistData(
  overrideItems?: WatchlistItem[],
  bypassCache = false,
  user?: UserSessionPayload | null,
): Promise<WatchlistResponse> {
  const cacheKey = isLucasUser(user) || !user?.id ? 'UNIFIED_WATCHLIST_DATA' : `WATCHLIST_DATA_${user.id}`;
  const WATCHLIST_TTL_MS = 25 * 1000;

  if (!bypassCache && !overrideItems) {
    const cached = memoryCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < WATCHLIST_TTL_MS) {
      return cached.data;
    }
  }

  let itemsToFetch: WatchlistItem[] = overrideItems !== undefined ? overrideItems : [];
  if (overrideItems === undefined) {
    try {
      const { getSetting } = await import('./supabaseService.js');
      const watchlistKey = getUserSettingKey('watchlist_items', user);
      const saved = await getSetting<WatchlistItem[]>(watchlistKey);
      if (Array.isArray(saved)) {
        itemsToFetch = saved;
      } else {
        itemsToFetch = [];
      }
    } catch {
      itemsToFetch = [];
    }
  }

  const results = await Promise.all(
    itemsToFetch.map(async (item): Promise<WatchlistQuoteResult> => {
      const rawTicker = item.ticker.trim().toUpperCase();
      const isKnownCrypto =
        item.type === 'CRYPTO' ||
        ['BTC', 'ETH', 'SOL', 'ONDO', 'SXT', 'LINK', 'RENDER', 'ROSE', 'VIRTUAL', 'XRP', 'ADA', 'DOGE', 'PEPE', 'SUI', 'NEAR', 'BNB', 'AVAX'].includes(rawTicker);

      if (isKnownCrypto) {
        const clean = rawTicker.replace(/-USD$/, '').replace(/\.SA$/, '');
        const [cryptoQuote, sparkline] = await Promise.all([
          getCryptoPriceFromBinance(clean),
          getCryptoSparkline(clean),
        ]);

        const price = cryptoQuote?.price || 0;
        const variation = cryptoQuote?.variation || '0.00';
        const changeAmount = cryptoQuote?.changeAmount || 0;
        const high24h = cryptoQuote?.high24h || price;
        const low24h = cryptoQuote?.low24h || price;
        const volume = cryptoQuote?.volume || 0;

        const periodData = await getCryptoPeriodData(
          clean,
          price,
          variation,
          changeAmount,
          sparkline.length > 0 ? sparkline : [price * 0.98, price * 1.01, price],
        );

        return {
          ticker: clean,
          name: item.name || KNOWN_CRYPTO_NAMES[clean] || clean,
          type: 'CRYPTO',
          price,
          currency: 'USD',
          variation,
          changeAmount,
          ...periodData,
          high24h,
          low24h,
          volume,
          marketCap: formatCap(volume * price),
          sparkline: sparkline.length > 0 ? sparkline : [price * 0.98, price * 1.01, price],
          category: 'Binance Cripto',
        };
      }

      // Stock / B3
      const yahooSymbol = normalizeSymbol(rawTicker);

      try {
        const [q, sparkline]: [any, number[]] = await Promise.all([
          yf.quote(yahooSymbol),
          getStockSparkline(yahooSymbol),
        ]);

        const price = q?.regularMarketPrice || q?.price || 0;
        const variation = (q?.regularMarketChangePercent ?? 0).toFixed(2);
        const changeAmount = q?.regularMarketChange ?? 0;
        const high24h = q?.regularMarketDayHigh ?? price;
        const low24h = q?.regularMarketDayLow ?? price;
        const volume = q?.regularMarketVolume ?? 0;
        const rawCap = q?.marketCap || 0;

        const periodData = await getStockPeriodData(
          yahooSymbol,
          price,
          variation,
          changeAmount,
          sparkline.length > 0 ? sparkline : [price * 0.99, price * 1.005, price],
        );

        return {
          ticker: rawTicker,
          yahooSymbol,
          name: item.name || cleanStockName(q?.shortName || q?.longName, rawTicker),
          type: 'STOCK',
          price,
          currency: (q?.currency as 'BRL' | 'USD') || 'BRL',
          variation,
          changeAmount,
          ...periodData,
          high24h,
          low24h,
          volume,
          marketCap: formatCap(rawCap),
          sparkline: sparkline.length > 0 ? sparkline : [price * 0.99, price * 1.005, price],
          category: 'Bolsa B3',
        };
      } catch (err: any) {
        console.warn(`[watchlist] Erro ao buscar cotação de ${rawTicker}:`, err.message);
        return {
          ticker: rawTicker,
          yahooSymbol,
          name: item.name || cleanStockName(undefined, rawTicker),
          type: 'STOCK',
          price: 0,
          currency: 'BRL',
          variation: '0.00',
          changeAmount: 0,
          high24h: 0,
          low24h: 0,
          volume: 0,
          marketCap: '--',
          sparkline: [],
          category: 'Bolsa B3',
        };
      }
    }),
  );

  const sortedByVar = [...results].sort(
    (a, b) => parseFloat(b.variation) - parseFloat(a.variation),
  );
  const topGainer = sortedByVar[0];
  const topLoser = sortedByVar[sortedByVar.length - 1];

  // Verificar alertas de preço
  const [alerts, triggeredAlerts] = await Promise.all([
    getPriceAlerts(user),
    checkAndTriggerPriceAlerts(results, user),
  ]);

  const response: WatchlistResponse = {
    items: results,
    alerts,
    triggeredAlerts,
    b3Status: getB3MarketStatus(),
    cryptoStatus: { isOpen: true, label: '24/7 Ativo' },
    topGainer: topGainer && parseFloat(topGainer.variation) > 0 ? topGainer : undefined,
    topLoser: topLoser && parseFloat(topLoser.variation) < 0 ? topLoser : undefined,
    lastUpdated: new Date().toISOString(),
  };

  if (!overrideItems) {
    memoryCache.set(cacheKey, { data: response, timestamp: Date.now() });
  }

  return response;
}
