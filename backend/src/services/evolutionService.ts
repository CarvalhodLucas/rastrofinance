import yahooFinance from 'yahoo-finance2';
import { getAllInvestments } from './supabaseService.js';
import { getAllInvestmentTrades } from './tradeService.js';
import { getUsdBrlRate } from './quoteService.js';
import type { UserSessionPayload } from './authService.js';

// Instância do Yahoo Finance
const YahooFinanceClass = typeof yahooFinance === 'function' ? yahooFinance : (yahooFinance as any).default || yahooFinance;
const yf = new (YahooFinanceClass as any)({ suppressNotices: ['ripHistorical', 'yahooSurvey'] });

export interface MonthlyEvolution {
  month: string; // YYYY-MM
  appliedValue: number;
  marketValue: number;
  capitalGain: number;
}

/**
 * Normaliza o ticker para busca no Yahoo Finance.
 */
function normalizeSymbol(ticker: string): string {
  const clean = ticker.trim().toUpperCase();
  if (clean.includes('.') || clean.includes('-')) return clean;

  const cryptoMap: Record<string, string> = {
    BTC: 'BTC-USD',
    ETH: 'ETH-USD',
    SOL: 'SOL-USD',
    ONDO: 'ONDO-USD',
    VIRTUAL: 'VIRTUAL-USD',
    ROSE: 'ROSE-USD',
    XRP: 'XRP-USD',
    LINK: 'LINK-USD',
    RENDER: 'RENDER-USD',
    SXT: 'SXT-USD',
    XLM: 'XLM-USD',
  };
  if (cryptoMap[clean]) return cryptoMap[clean];

  if (clean === 'EMBJ3') return 'EMBR3.SA';
  if (clean === 'AXIA3') return 'ELET3.SA';
  if (clean === 'AXIA7') return 'ELET6.SA';

  if (/^[A-Z]{4}[0-9]{1,2}$/.test(clean) || /^[A-Z]{4}[0-9]{1,2}F$/.test(clean)) {
    return `${clean}.SA`;
  }
  return clean;
}

/**
 * Retorna os últimos 12 meses no formato YYYY-MM ordenados cronologicamente.
 */
function getLast12Months(): string[] {
  const months: string[] = [];
  const d = new Date();
  for (let i = 11; i >= 0; i--) {
    const temp = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const y = temp.getFullYear();
    const m = String(temp.getMonth() + 1).padStart(2, '0');
    months.push(`${y}-${m}`);
  }
  return months;
}

/**
 * Calcula a evolução do patrimônio mês a mês com:
 * 1. Conversão cambial USD -> BRL rigorosa para ativos em dólar (Cripto e Wise).
 * 2. Inclusão de ativos fechados no passado (PRIO3, EMBJ3, etc.) nos meses em que estiveram em custódia.
 * 3. Trocas de cripto (ex: 31.347 ROSE trocados para 153.37 XRP em 17/09/2026 com câmbio do dia).
 */
export async function getPortfolioEvolution(user?: UserSessionPayload | null): Promise<MonthlyEvolution[]> {
  const [investments, trades] = await Promise.all([
    getAllInvestments(user),
    getAllInvestmentTrades(user),
  ]);

  const monthsList = getLast12Months();
  if (investments.length === 0 && trades.length === 0) {
    return monthsList.map((m) => ({
      month: m,
      appliedValue: 0,
      marketValue: 0,
      capitalGain: 0,
    }));
  }

  const startDateStr = `${monthsList[0]}-01`;
  const endDateStr = new Date().toISOString().split('T')[0];
  const currentUsdBrl = await getUsdBrlRate();

  // 1. Câmbio histórico mensal do Dólar (USD/BRL)
  const usdBrlHistory: Record<string, number> = {};
  try {
    const usdChart = await yf.chart('USDBRL=X', {
      period1: startDateStr,
      period2: endDateStr,
      interval: '1mo',
    });
    if (usdChart && Array.isArray(usdChart.quotes)) {
      for (const q of usdChart.quotes) {
        if (q.date && q.close) {
          const m = new Date(q.date).toISOString().substring(0, 7);
          usdBrlHistory[m] = q.close;
        }
      }
    }
  } catch (err) {
    console.warn('[evolutionService] Usando taxa de dólar atual:', err);
  }

  // 2. Mapeamento de cotações históricas mensais
  const tickersToFetch = new Set<string>();
  for (const inv of investments) {
    if (inv.code_ticker) tickersToFetch.add(inv.code_ticker.toUpperCase());
  }
  for (const t of trades) {
    if (t.ticker) tickersToFetch.add(t.ticker.toUpperCase());
  }

  const historicalPrices: Record<string, Record<string, number>> = {};
  await Promise.all(
    Array.from(tickersToFetch).map(async (ticker) => {
      const symbol = normalizeSymbol(ticker);
      if (symbol.includes('TESOURO') || symbol.includes('CDB') || symbol.includes('WISE')) {
        return;
      }
      try {
        const chartRes = await yf.chart(symbol, {
          period1: startDateStr,
          period2: endDateStr,
          interval: '1mo',
        });
        if (chartRes && Array.isArray(chartRes.quotes)) {
          historicalPrices[ticker] = {};
          for (const q of chartRes.quotes) {
            if (q.date && q.close) {
              const m = new Date(q.date).toISOString().substring(0, 7);
              historicalPrices[ticker][m] = q.close;
            }
          }
        }
      } catch {
        // Ignora erros para ativos não cotados no Yahoo
      }
    })
  );

  // 3. Montar a carteira e calcular patrimônio em cada mês
  const evolution: MonthlyEvolution[] = [];

  for (let idx = 0; idx < monthsList.length; idx++) {
    const month = monthsList[idx];
    if (!month) continue;
    const isCurrentMonth = idx === monthsList.length - 1;
    const [year, mStr] = month.split('-');
    const limitDate = new Date(Number(year), Number(mStr), 0, 23, 59, 59);
    const usdBrlRate = usdBrlHistory[month] || currentUsdBrl;

    let appliedTotal = 0;
    let marketTotal = 0;

    // A. Ativos Ativos na Carteira Atual
    for (const inv of investments.filter((i) => i.quantity > 0 && i.sync_source !== 'GORILA_CLOSED')) {
      const ticker = inv.code_ticker.toUpperCase();
      const firstDate = inv.created_at ? new Date(inv.created_at) : new Date();

      // Se foi criado/comprado após este mês, não constava na carteira ainda
      if (firstDate > limitDate) {
        continue;
      }

      let qty = inv.quantity;

      // Ajuste de trocas históricas de Criptomoeda (ex: Troca ROSE -> XRP em 17/09/2026)
      if (ticker === 'ROSE' && limitDate < new Date('2026-09-17T00:00:00Z')) {
        // Antes da troca de 17/09, o usuário possuía as 31.347 ROSE que foram convertidas
        qty += 31347;
      } else if (ticker === 'XRP' && limitDate < new Date('2026-09-17T00:00:00Z')) {
        // Antes da troca de 17/09, não possuía XRP
        qty = 0;
      }

      if (qty <= 0) continue;

      const isUsd = inv.currency === 'USD' || inv.asset_type === 'CRYPTO' || ticker.includes('WISE_USD');
      const currencyMultiplier = isUsd ? usdBrlRate : 1.0;

      // Custo de Aquisição (Preço Médio) convertido para BRL
      const unitCost = (inv.average_price || inv.current_price || 0) * currencyMultiplier;
      appliedTotal += qty * unitCost;

      // Preço de Mercado Histórico convertido para BRL
      let unitPrice = inv.current_price;
      const tickerHist = historicalPrices[ticker];
      const yfPrice = tickerHist ? tickerHist[month] : undefined;
      if (yfPrice !== undefined && yfPrice > 0) {
        unitPrice = yfPrice;
      }
      marketTotal += qty * (unitPrice * currencyMultiplier);
    }

    // B. Ativos Encerrados / Vendidos no Passado (ex: PRIO3, EMBJ3, CXSE3, WEGE3, PETR4, etc.)
    // Nos meses anteriores à venda, eles devem compor o patrimônio e valor aplicado
    for (const inv of investments.filter((i) => i.quantity === 0 || i.sync_source === 'GORILA_CLOSED')) {
      const ticker = inv.code_ticker.toUpperCase();
      const sellTrade = trades.find((t) => t.ticker.toUpperCase() === ticker && t.trade_type === 'SELL');
      const buyTrades = trades.filter((t) => t.ticker.toUpperCase() === ticker && t.trade_type === 'BUY')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      if (!sellTrade) continue;

      const firstBuy = buyTrades[0];
      const buyDate = firstBuy ? new Date(firstBuy.date) : (inv.created_at ? new Date(inv.created_at) : new Date(0));
      const sellDate = new Date(sellTrade.date);

      // Se o mês está entre a compra e a venda, o ativo estava em custódia!
      if (buyDate <= limitDate && limitDate < sellDate) {
        const qty = sellTrade.quantity || 1;
        const avgPrice = inv.average_price || firstBuy?.unit_price || sellTrade.unit_price;
        const isUsd = inv.currency === 'USD' || inv.asset_type === 'CRYPTO';
        const currencyMultiplier = isUsd ? usdBrlRate : 1.0;

        appliedTotal += qty * (avgPrice * currencyMultiplier);

        let unitPrice = sellTrade.unit_price;
        const tickerHist = historicalPrices[ticker];
        const yfPrice = tickerHist ? tickerHist[month] : undefined;
        if (yfPrice !== undefined && yfPrice > 0) {
          unitPrice = yfPrice;
        }
        marketTotal += qty * (unitPrice * currencyMultiplier);
      }
    }

    const capitalGain = marketTotal - appliedTotal;

    evolution.push({
      month,
      appliedValue: Math.round(appliedTotal * 100) / 100,
      marketValue: Math.round(marketTotal * 100) / 100,
      capitalGain: Math.round(capitalGain * 100) / 100,
    });
  }

  return evolution;
}
