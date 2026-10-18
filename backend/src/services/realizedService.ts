import yahooFinance from 'yahoo-finance2';
import { getAllInvestments } from './supabaseService.js';
import { getAllInvestmentTrades, type InvestmentTrade } from './tradeService.js';
import { getUsdBrlRate } from './quoteService.js';
import type { UserSessionPayload } from './authService.js';

const yf = typeof yahooFinance === 'function'
  ? new (yahooFinance as any)({ suppressNotices: ['yahooSurvey'] })
  : (yahooFinance as any).default
  ? new ((yahooFinance as any).default)({ suppressNotices: ['yahooSurvey'] })
  : yahooFinance;

export interface RealizedOperation {
  id: string;
  kind: 'SELL' | 'SWAP' | 'LEGACY';
  date: string | null;
  ticker: string;
  asset_type: string;
  institution: string;
  quantity: number;
  currency: 'BRL' | 'USD';
  avg_cost: number;        // custo médio unitário (moeda nativa)
  sell_price: number;      // preço unitário de venda / troca (moeda nativa)
  cost_total: number;      // custo total (moeda nativa)
  proceeds_total: number;  // valor recebido (moeda nativa)
  usd_brl: number;         // câmbio usado (1 para BRL)
  result_brl: number;
  result_pct: number;
  cost_missing?: boolean;
  to_ticker?: string;
  to_quantity?: number;
  notes?: string;
  investment_id?: string;
  trade_id?: string;
}

// Mapeamento de símbolos especiais no Yahoo Finance
const CRYPTO_YAHOO: Record<string, string> = {
  TAO: 'TAO22974-USD',
  RENDER: 'RENDER-USD',
  ONDO: 'ONDO-USD',
  VIRTUAL: 'VIRTUAL-USD',
  SXT: 'SXT-USD',
};

// Aliases entre o nome usado no extrato B3 e o cadastro antigo (Gorila)
const TICKER_ALIASES: Record<string, string[]> = {
  'TESOURO PREFIXADO 2028': ['LTN - 01/01/2028'],
};

const priceCache = new Map<string, number | null>();

async function getHistoricalClose(symbol: string, dateIso: string): Promise<number | null> {
  const day = dateIso.substring(0, 10);
  const key = `${symbol}|${day}`;
  if (priceCache.has(key)) return priceCache.get(key)!;

  const start = new Date(`${day}T00:00:00Z`);
  const end = new Date(start.getTime() + 4 * 86400000);
  let price: number | null = null;
  try {
    const res: any = await yf.chart(symbol, {
      period1: start.toISOString().substring(0, 10),
      period2: end.toISOString().substring(0, 10),
      interval: '1d',
    });
    const quotes = res?.quotes || [];
    const first = quotes.find((q: any) => q?.close);
    if (first) price = Number(first.close);
  } catch {
    try {
      const quotes: any = await yf.historical(symbol, {
        period1: start.toISOString().substring(0, 10),
        period2: end.toISOString().substring(0, 10),
        interval: '1d',
      });
      const first = Array.isArray(quotes) ? quotes.find((q: any) => q?.close) : null;
      if (first) price = Number(first.close);
    } catch {
      price = null;
    }
  }
  priceCache.set(key, price);
  return price;
}

function cryptoSymbol(ticker: string): string {
  const t = ticker.toUpperCase();
  return CRYPTO_YAHOO[t] || `${t}-USD`;
}

function parseNoteRate(notes?: string): number | null {
  if (!notes) return null;
  const m = notes.match(/USD\/BRL:\s*R\$\s*([\d.,]+)/i);
  if (!m || !m[1]) return null;
  const v = parseFloat(m[1].replace(',', '.'));
  return v > 0 ? v : null;
}

async function getUsdBrlOn(dateIso: string, notes: string | undefined, fallback: number): Promise<number> {
  const fromNote = parseNoteRate(notes);
  if (fromNote) return fromNote;
  const yfRate = await getHistoricalClose('USDBRL=X', dateIso);
  return yfRate && yfRate > 0 ? yfRate : fallback;
}

/**
 * Calcula todas as operações realizadas (vendas e trocas) a partir do histórico unificado,
 * usando o método do custo médio ponderado por ativo.
 */
export async function getRealizedOperations(user?: UserSessionPayload | null): Promise<RealizedOperation[]> {
  const [trades, investments, currentUsdBrl] = await Promise.all([
    getAllInvestmentTrades(user),
    getAllInvestments(user),
    getUsdBrlRate(),
  ]);

  if (trades.length === 0 && investments.length === 0) {
    return [];
  }

  // Custo médio de fallback (cadastro antigo) quando a compra é anterior ao extrato
  const instKey = (s: string) => {
    const u = (s || '').toUpperCase();
    if (u.includes('NU')) return 'NU';
    if (u.includes('XP')) return 'XP';
    return u;
  };
  const fallbackAvg: Record<string, Array<{ avg: number; institution: string }>> = {};
  for (const inv of investments) {
    const t = inv.code_ticker.toUpperCase();
    if (inv.average_price > 0) {
      (fallbackAvg[t] ||= []).push({ avg: inv.average_price, institution: inv.institution });
    }
  }
  const getFallback = (ticker: string, institution: string) => {
    const t = ticker.toUpperCase();
    const keys = [t, ...(TICKER_ALIASES[t] || []).map((a) => a.toUpperCase())];
    for (const k of keys) {
      const list = fallbackAvg[k];
      if (!list?.length) continue;
      return list.find((x) => instKey(x.institution) === instKey(institution)) || list[0];
    }
    return null;
  };

  const sorted = [...trades].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const positions: Record<string, { qty: number; cost: number }> = {};
  const pos = (t: string) => (positions[t] ||= { qty: 0, cost: 0 });

  const realized: RealizedOperation[] = [];

  for (const tr of sorted) {
    const ticker = tr.ticker.toUpperCase();
    const isCrypto = tr.asset_type === 'CRYPTO';
    const currency: 'BRL' | 'USD' = isCrypto ? 'USD' : 'BRL';
    const qty = Number(tr.quantity) || 0;

    switch (tr.trade_type) {
      case 'BUY':
      case 'DEPOSIT': {
        const p = pos(ticker);
        p.qty += qty;
        p.cost += Number(tr.total_value) || qty * (Number(tr.unit_price) || 0);
        break;
      }
      case 'AIRDROP': {
        // Apenas bonificações reais adicionam quantidade (custo zero).
        // "Atualização"/"Fração" do extrato B3 são apenas registros de posição.
        const isB3 = tr.source === 'B3_IMPORT';
        if (!isB3 || (tr.notes || '').startsWith('Bonificação')) {
          pos(ticker).qty += qty;
        }
        break;
      }
      case 'EARN_INTEREST': {
        // Rendimentos em cripto (Earn) aumentam a quantidade com custo zero; na B3 são proventos em dinheiro
        if (isCrypto) pos(ticker).qty += qty;
        break;
      }
      case 'SELL': {
        await registerSale(tr, ticker, qty, Number(tr.total_value) || qty * (Number(tr.unit_price) || 0), currency);
        break;
      }
      case 'SWAP': {
        const fromTicker = (tr.from_ticker || '').toUpperCase();
        const fromQty = Number(tr.from_quantity) || 0;
        const toTicker = (tr.to_ticker || ticker).toUpperCase();
        const toQty = Number(tr.to_quantity) || qty;
        if (!fromTicker || fromQty <= 0) {
          pos(toTicker).qty += toQty;
          pos(toTicker).cost += Number(tr.total_value) || 0;
          break;
        }

        // Valor de mercado (USD) recebido na troca: preço do ativo recebido no dia
        let proceedsUsd: number | null = null;
        const toPrice = await getHistoricalClose(cryptoSymbol(toTicker), tr.date);
        if (toPrice && toPrice > 0) proceedsUsd = toQty * toPrice;
        if (proceedsUsd === null) {
          const fromPrice = await getHistoricalClose(cryptoSymbol(fromTicker), tr.date);
          if (fromPrice && fromPrice > 0) proceedsUsd = fromQty * fromPrice;
        }

        const costCarried = Number(tr.total_value) || 0;
        const proceeds = proceedsUsd ?? costCarried;

        await registerSale(tr, fromTicker, fromQty, proceeds, 'USD', {
          to_ticker: toTicker,
          to_quantity: toQty,
          costHint: costCarried,
          priceMissing: proceedsUsd === null,
        });

        // O ativo recebido entra com custo = valor de mercado na data da troca
        const p = pos(toTicker);
        p.qty += toQty;
        p.cost += proceeds;
        break;
      }
      default:
        break;
    }
  }

  async function registerSale(
    tr: InvestmentTrade,
    ticker: string,
    qty: number,
    proceeds: number,
    currency: 'BRL' | 'USD',
    extra?: { to_ticker?: string; to_quantity?: number; costHint?: number; priceMissing?: boolean },
  ) {
    if (qty <= 0) return;
    const p = pos(ticker);
    let cost = 0;
    let costMissing = false;

    const trackedAvg = p.qty > 0 ? p.cost / p.qty : 0;
    // Diferenças mínimas de arredondamento (< 1%) usam o próprio custo médio rastreado
    const trackedQty = p.qty >= qty * 0.99 ? qty : Math.min(p.qty, qty);
    cost += trackedQty * trackedAvg;

    const untracked = qty - trackedQty;
    if (untracked > 1e-9) {
      const fb = getFallback(ticker, tr.institution);
      if (extra?.costHint && trackedQty === 0) {
        cost = extra.costHint;
      } else if (fb) {
        cost += untracked * fb.avg;
      } else {
        // Sem informação de custo: assume custo = valor de venda (resultado neutro)
        cost += untracked * (proceeds / qty);
        costMissing = true;
      }
    }

    // Baixa da posição
    const removedQty = Math.min(p.qty, trackedQty);
    p.cost -= removedQty * trackedAvg;
    p.qty -= removedQty;
    if (p.qty < 1e-9) { p.qty = 0; p.cost = 0; }

    const usdBrl = currency === 'USD' ? await getUsdBrlOn(tr.date, tr.notes, currentUsdBrl) : 1;
    const resultNative = proceeds - cost;

    realized.push({
      id: `realized_${tr.id}`,
      kind: extra?.to_ticker ? 'SWAP' : 'SELL',
      date: tr.date,
      ticker,
      asset_type: tr.asset_type,
      institution: tr.institution,
      quantity: qty,
      currency,
      avg_cost: cost / qty,
      sell_price: proceeds / qty,
      cost_total: cost,
      proceeds_total: proceeds,
      usd_brl: usdBrl,
      result_brl: resultNative * usdBrl,
      result_pct: cost > 0 ? (resultNative / cost) * 100 : 0,
      cost_missing: costMissing || extra?.priceMissing || undefined,
      to_ticker: extra?.to_ticker,
      to_quantity: extra?.to_quantity,
      notes: tr.notes,
      trade_id: tr.id,
    });
  }

  // Encerramentos antigos (cadastro Gorila) de ativos sem venda registrada no histórico
  const soldTickers = new Set<string>();
  for (const r of realized) {
    soldTickers.add(r.ticker.toUpperCase());
    for (const alias of TICKER_ALIASES[r.ticker.toUpperCase()] || []) soldTickers.add(alias.toUpperCase());
  }
  for (const inv of investments) {
    const isClosed = inv.quantity === 0 || (inv.sync_source || '').startsWith('GORILA_CLOSED');
    if (!isClosed || inv.asset_type === 'CRYPTO') continue;
    if (soldTickers.has(inv.code_ticker.toUpperCase())) continue;
    if (!inv.total_value) continue;

    let legacyDate: string | null = null;
    if (inv.sync_source && inv.sync_source.includes('#date=')) {
      const m = inv.sync_source.match(/#date=([0-9]{4}-[0-9]{2}-[0-9]{2})/);
      if (m) legacyDate = `${m[1]}T12:00:00.000Z`;
    }

    realized.push({
      id: `legacy_${inv.id}`,
      investment_id: inv.id,
      kind: 'LEGACY',
      date: legacyDate,
      ticker: inv.code_ticker,
      asset_type: inv.asset_type,
      institution: inv.institution,
      quantity: 0,
      currency: 'BRL',
      avg_cost: inv.average_price || 0,
      sell_price: inv.current_price || 0,
      cost_total: 0,
      proceeds_total: 0,
      usd_brl: 1,
      result_brl: inv.total_value,
      result_pct: inv.average_price > 0 ? ((inv.current_price - inv.average_price) / inv.average_price) * 100 : 0,
    });
  }

  return realized.sort((a, b) => {
    if (!a.date && !b.date) return b.result_brl - a.result_brl;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}
