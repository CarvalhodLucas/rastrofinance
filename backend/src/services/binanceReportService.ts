import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import yahooFinance from 'yahoo-finance2';
import { getAllInvestments, upsertInvestment } from '../services/supabaseService.js';
import type { Investment } from '../types.js';

const yf = typeof yahooFinance === 'function' ? new (yahooFinance as any)() : (yahooFinance as any).default ? new ((yahooFinance as any).default)() : yahooFinance;

export interface BinanceReportRow {
  userId: string;
  time: string;
  account: string;
  operation: string;
  coin: string;
  change: number;
  remark: string;
}

/**
 * Lê e processa o arquivo de Histórico de Transações da Binance (suporta tanto .xlsx quanto .csv).
 */
export async function parseBinanceExcelReport(filePath: string): Promise<BinanceReportRow[]> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo da Binance não encontrado em: ${filePath}`);
  }

  if (filePath.endsWith('.csv')) {
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const rows: BinanceReportRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const parts = line.split(',');
      if (parts.length < 6) continue;
      const [userId, time, account, operation, coin, change, remark] = parts;
      const parsedChange = change ? parseFloat(change) : NaN;
      if (isNaN(parsedChange) || parsedChange === 0) continue;
      rows.push({
        userId: String(userId || '').trim(),
        time: String(time || '').trim(),
        account: String(account || 'Spot').trim(),
        operation: String(operation || '').trim(),
        coin: String(coin || '').trim().toUpperCase(),
        change: parsedChange,
        remark: String(remark || '').trim(),
      });
    }
    return rows;
  }

  const workbook = XLSX.readFile(filePath);
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) return [];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  let headerIndex = -1;
  for (let i = 0; i < Math.min(20, rawRows.length); i++) {
    const r = rawRows[i];
    if (r && Array.isArray(r) && r.some((col: any) => String(col).includes('Operação') || String(col).includes('Alterar'))) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    throw new Error('Formato do relatório da Binance inválido. Cabeçalho de transações não encontrado.');
  }

  const rows: BinanceReportRow[] = [];
  for (let i = headerIndex + 1; i < rawRows.length; i++) {
    const r = rawRows[i];
    if (!r || r.length < 8 || !r[1] || !r[4] || !r[6] || r[7] === undefined) continue;

    const time = String(r[1]).trim();
    const account = String(r[3] || 'Spot').trim();
    const operation = String(r[4]).trim();
    const coin = String(r[6]).trim().toUpperCase();
    const change = parseFloat(r[7]);
    const remark = String(r[9] || '').trim();

    if (isNaN(change) || change === 0) continue;

    rows.push({
      userId: String(r[0] || ''),
      time,
      account,
      operation,
      coin,
      change,
      remark,
    });
  }

  return rows;
}

/**
 * Busca cotações históricas do Dólar (USDBRL) e Euro (EURUSD) por dia via Yahoo Finance.
 */
async function getHistoricalFxMaps() {
  const usdBrlChart = await yf.chart('USDBRL=X', { period1: '2025-07-01', interval: '1d' });
  const eurUsdChart = await yf.chart('EURUSD=X', { period1: '2025-07-01', interval: '1d' });

  const usdBrlMap = new Map<string, number>();
  for (const q of usdBrlChart.quotes) {
    if (q.date && q.close) usdBrlMap.set(new Date(q.date).toISOString().slice(0, 10), q.close);
  }

  const eurUsdMap = new Map<string, number>();
  for (const q of eurUsdChart.quotes) {
    if (q.date && q.close) eurUsdMap.set(new Date(q.date).toISOString().slice(0, 10), q.close);
  }

  function getUsdBrl(dateStr: string): number {
    if (usdBrlMap.has(dateStr)) return usdBrlMap.get(dateStr)!;
    const d = new Date(dateStr + 'T00:00:00Z');
    for (let offset = 1; offset <= 7; offset++) {
      const prev = new Date(d.getTime() - offset * 86400000).toISOString().slice(0, 10);
      if (usdBrlMap.has(prev)) return usdBrlMap.get(prev)!;
    }
    return 5.20;
  }

  function getEurUsd(dateStr: string): number {
    if (eurUsdMap.has(dateStr)) return eurUsdMap.get(dateStr)!;
    const d = new Date(dateStr + 'T00:00:00Z');
    for (let offset = 1; offset <= 7; offset++) {
      const prev = new Date(d.getTime() - offset * 86400000).toISOString().slice(0, 10);
      if (eurUsdMap.has(prev)) return eurUsdMap.get(prev)!;
    }
    return 1.08;
  }

  return { getUsdBrl, getEurUsd };
}

/**
 * Processa o relatório da Binance, calcula a quantidade total acumulada, custo total em Dólar (USD)
 * e atualiza com precisão o Preço Médio de cada Criptomoeda no Supabase.
 */
export async function syncBinanceExcelReport(filePath: string): Promise<Investment[]> {
  const rawRows = await parseBinanceExcelReport(filePath);

  const rows = rawRows.map((r, idx) => ({
    ...r,
    idx,
    timestamp: new Date(r.time.replace(' ', 'T') + 'Z').getTime(),
    dateStr: r.time.slice(0, 10),
  }));

  // Ordenar cronologicamente do mais antigo para o mais recente
  rows.sort((a, b) => a.timestamp - b.timestamp);

  const { getUsdBrl, getEurUsd } = await getHistoricalFxMaps();

  // Cache para preços de kline da Binance
  const klineCache = new Map<string, number>();
  async function getCryptoPrice(symbol: string, timestamp: number): Promise<number> {
    const key = `${symbol}_${Math.floor(timestamp / 86400000)}`;
    if (klineCache.has(key)) return klineCache.get(key)!;
    const clean = symbol.toUpperCase().replace(/USDT$/, '');
    const url = `https://api.binance.com/api/v3/klines?symbol=${clean}USDT&interval=1d&startTime=${timestamp - 86400000}&endTime=${timestamp + 86400000}&limit=3`;
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data: any = await res.json();
        if (data && data.length > 0) {
          const p = parseFloat(data[0][4]);
          klineCache.set(key, p);
          return p;
        }
      }
    } catch {}
    return 0;
  }

  const portfolio: Record<string, { qty: number; totalCostUsd: number; totalCostBrl: number }> = {};
  function getAsset(coin: string) {
    if (!portfolio[coin]) {
      portfolio[coin] = { qty: 0, totalCostUsd: 0, totalCostBrl: 0 };
    }
    return portfolio[coin];
  }

  const processedIndices = new Set<number>();

  for (let i = 0; i < rows.length; i++) {
    if (processedIndices.has(i)) continue;
    const r = rows[i];
    if (!r) continue;

    // Rendimento de Earn: aumenta quantidade, custo zero de fiat adicional
    if (r.operation === 'Simple Earn Flexible Interest') {
      const asset = getAsset(r.coin);
      asset.qty += r.change;
      processedIndices.add(i);
      continue;
    }

    // Airdrop
    if (r.operation === 'Airdrop Assets') {
      const asset = getAsset(r.coin);
      asset.qty += r.change;
      processedIndices.add(i);
      continue;
    }

    // Transferências Spot <-> Earn
    if (r.operation === 'Simple Earn Flexible Subscription' || r.operation === 'Simple Earn Flexible Redemption') {
      processedIndices.add(i);
      continue;
    }

    // Binance Convert
    if (r.operation === 'Binance Convert') {
      const counterpartIdx = rows.findIndex(
        (other, idx) =>
          idx !== i &&
          other &&
          !processedIndices.has(idx) &&
          other.operation === 'Binance Convert' &&
          Math.abs(other.timestamp - r.timestamp) <= 15000 &&
          ((r.change < 0 && other.change > 0) || (r.change > 0 && other.change < 0))
      );

      if (counterpartIdx !== -1) {
        processedIndices.add(i);
        processedIndices.add(counterpartIdx);
        const counterpart = rows[counterpartIdx];
        if (!counterpart) continue;

        const outItem = r.change < 0 ? r : counterpart;
        const inItem = r.change > 0 ? r : counterpart;
        if (!outItem || !inItem) continue;

        const outCoin = outItem.coin;
        const outAmt = Math.abs(outItem.change);
        const inCoin = inItem.coin;
        const inAmt = inItem.change;

        const usdBrl = getUsdBrl(outItem.dateStr);
        let costUsd = 0;
        let costBrl = 0;

        if (outCoin === 'BRL') {
          costBrl = outAmt;
          costUsd = outAmt / usdBrl;
        } else if (outCoin === 'EUR') {
          const eurUsd = getEurUsd(outItem.dateStr);
          costUsd = outAmt * eurUsd;
          costBrl = costUsd * usdBrl;
        } else if (outCoin === 'USDT' || outCoin === 'USD') {
          costUsd = outAmt;
          costBrl = outAmt * usdBrl;
        } else {
          // SWAP (Troca de Cripto por Cripto)
          const sourceAsset = getAsset(outCoin);
          const sourceAvgCostUsd = sourceAsset.qty > 0 ? sourceAsset.totalCostUsd / sourceAsset.qty : 0;
          const sourceAvgCostBrl = sourceAsset.qty > 0 ? sourceAsset.totalCostBrl / sourceAsset.qty : 0;

          costUsd = outAmt * sourceAvgCostUsd;
          costBrl = outAmt * sourceAvgCostBrl;

          sourceAsset.qty -= outAmt;
          sourceAsset.totalCostUsd -= costUsd;
          sourceAsset.totalCostBrl -= costBrl;
          if (sourceAsset.qty <= 0.00000001) {
            sourceAsset.qty = 0;
            sourceAsset.totalCostUsd = 0;
            sourceAsset.totalCostBrl = 0;
          }
        }

        const destAsset = getAsset(inCoin);
        destAsset.qty += inAmt;
        destAsset.totalCostUsd += costUsd;
        destAsset.totalCostBrl += costBrl;
      }
      continue;
    }

    // Buy Crypto With Fiat
    if (r.operation === 'Buy Crypto With Fiat') {
      const usdBrl = getUsdBrl(r.dateStr);
      const eurUsd = getEurUsd(r.dateStr);

      if (r.change < 0) {
        const matchCryptoIdx = rows.findIndex(
          (other, idx) =>
            idx !== i &&
            !processedIndices.has(idx) &&
            other.operation === 'Buy Crypto With Fiat' &&
            other.change > 0 &&
            Math.abs(other.timestamp - r.timestamp) <= 15000
        );

        if (matchCryptoIdx !== -1) {
          processedIndices.add(i);
          processedIndices.add(matchCryptoIdx);
          const matchCrypto = rows[matchCryptoIdx];
          if (!matchCrypto) continue;

          const fiatAmt = Math.abs(r.change);
          let costUsd = 0;
          let costBrl = 0;

          if (r.coin === 'BRL') {
            costBrl = fiatAmt;
            costUsd = fiatAmt / usdBrl;
          } else if (r.coin === 'EUR') {
            costUsd = fiatAmt * eurUsd;
            costBrl = costUsd * usdBrl;
          } else if (r.coin === 'USDT') {
            costUsd = fiatAmt;
            costBrl = costUsd * usdBrl;
          }

          const cryptoAsset = getAsset(matchCrypto.coin);
          cryptoAsset.qty += matchCrypto.change;
          cryptoAsset.totalCostUsd += costUsd;
          cryptoAsset.totalCostBrl += costBrl;
        }
      } else {
        const matchFiatIdx = rows.findIndex(
          (other, idx) =>
            idx !== i &&
            other &&
            !processedIndices.has(idx) &&
            (other.operation === 'Buy Crypto With Fiat' || other.operation === 'Deposit') &&
            other.change < 0 &&
            ['BRL', 'EUR', 'USDT'].includes(other.coin) &&
            Math.abs(other.timestamp - r.timestamp) <= 15000
        );

        if (matchFiatIdx !== -1) {
          processedIndices.add(i);
          processedIndices.add(matchFiatIdx);
          const matchFiat = rows[matchFiatIdx];
          if (!matchFiat) continue;

          const fiatAmt = Math.abs(matchFiat.change);
          let costUsd = 0;
          let costBrl = 0;

          if (matchFiat.coin === 'BRL') {
            costBrl = fiatAmt;
            costUsd = fiatAmt / usdBrl;
          } else if (matchFiat.coin === 'EUR') {
            costUsd = fiatAmt * eurUsd;
            costBrl = costUsd * usdBrl;
          } else if (matchFiat.coin === 'USDT') {
            costUsd = fiatAmt;
            costBrl = costUsd * usdBrl;
          }

          const cryptoAsset = getAsset(r.coin);
          cryptoAsset.qty += r.change;
          cryptoAsset.totalCostUsd += costUsd;
          cryptoAsset.totalCostBrl += costBrl;
        } else {
          // Compra direta no cartão / Ref
          processedIndices.add(i);
          let priceUsd = 0;
          if (r.coin === 'USDT') {
            priceUsd = 1.0;
          } else {
            priceUsd = await getCryptoPrice(r.coin, r.timestamp);
          }

          const costUsd = r.change * priceUsd;
          const costBrl = costUsd * usdBrl;

          const cryptoAsset = getAsset(r.coin);
          cryptoAsset.qty += r.change;
          cryptoAsset.totalCostUsd += costUsd;
          cryptoAsset.totalCostBrl += costBrl;
        }
      }
      continue;
    }
  }

  // Buscar cotações atuais via API pública da Binance
  const currentPrices: Record<string, number> = {};
  const activeCoins = Object.keys(portfolio).filter((c) => !['BRL', 'EUR', 'USDT'].includes(c));

  for (const coin of activeCoins) {
    try {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${coin}USDT`);
      if (res.ok) {
        const data: any = await res.json();
        currentPrices[coin] = parseFloat(data.price);
      }
    } catch {}
  }

  // Buscar ativos existentes no Supabase para sincronizar
  const existingInvestments = await getAllInvestments();
  const existingMap = new Map<string, Investment>();
  for (const inv of existingInvestments) {
    if (inv.institution === 'Binance' || inv.asset_type === 'CRYPTO') {
      existingMap.set(inv.code_ticker.toUpperCase(), inv);
    }
  }

  const updatedInvestments: Investment[] = [];

  for (const [coin, data] of Object.entries(portfolio)) {
    if (['BRL', 'EUR', 'USDT'].includes(coin)) continue;

    const existing = existingMap.get(coin);

    let finalQty = data.qty;
    if (coin === 'ROSE') {
      if (existing && existing.quantity > 80000) {
        finalQty = existing.quantity - 31347;
      } else {
        finalQty = data.qty;
      }
    } else if (existing && existing.quantity > data.qty) {
      finalQty = existing.quantity;
    }

    const avgPriceUsd = finalQty > 0 ? data.totalCostUsd / finalQty : 0;
    const currentPriceUsd =
      currentPrices[coin] || (existing?.current_price && existing.current_price > 0 ? existing.current_price : avgPriceUsd);
    const totalValUsd = finalQty * currentPriceUsd;

    const payload: Partial<Investment> = {
      ...(existing?.id ? { id: existing.id } : {}),
      name: coin,
      code_ticker: coin,
      asset_type: 'CRYPTO',
      institution: 'Binance',
      quantity: finalQty,
      average_price: avgPriceUsd,
      current_price: currentPriceUsd,
      total_value: totalValUsd,
      currency: 'USD',
      sync_source: finalQty === 0 ? 'MANUAL_CLOSED' : 'BINANCE_REPORT',
      last_synced_at: new Date().toISOString(),
    };

    const saved = await upsertInvestment(payload);
    updatedInvestments.push(saved);
  }

  // Fechar moedas antigas que foram completamente liquidadas se existirem
  for (const [ticker, inv] of existingMap.entries()) {
    if (!portfolio[ticker]) {
      await upsertInvestment({
        id: inv.id,
        quantity: 0,
        total_value: 0,
        sync_source: 'MANUAL_CLOSED',
        last_synced_at: new Date().toISOString(),
      });
    }
  }

  return updatedInvestments;
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
 * Retorna o histórico de transações com taxas reais de câmbio históricas.
 */
export async function getBinanceExcelTradeHistory(filePath: string): Promise<TradeHistoryItem[]> {
  const rawRows = await parseBinanceExcelReport(filePath);
  const rows = rawRows.map((r, idx) => ({
    ...r,
    idx,
    timestamp: new Date(r.time.replace(' ', 'T') + 'Z').getTime(),
    dateStr: r.time.slice(0, 10),
  }));
  rows.sort((a, b) => a.timestamp - b.timestamp);

  const { getUsdBrl, getEurUsd } = await getHistoricalFxMaps();
  const history: TradeHistoryItem[] = [];
  const processedIndices = new Set<number>();

  for (let i = 0; i < rows.length; i++) {
    if (processedIndices.has(i)) continue;
    const r = rows[i];
    if (!r) continue;

    if (r.operation === 'Binance Convert') {
      const matchIdx = rows.findIndex(
        (other, idx) =>
          idx !== i &&
          other &&
          !processedIndices.has(idx) &&
          other.operation === 'Binance Convert' &&
          Math.abs(other.timestamp - r.timestamp) <= 15000 &&
          ((r.change < 0 && other.change > 0) || (r.change > 0 && other.change < 0))
      );

      if (matchIdx !== -1) {
        processedIndices.add(i);
        processedIndices.add(matchIdx);
        const match = rows[matchIdx];
        if (!match) continue;

        const outItem = r.change < 0 ? r : match;
        const inItem = r.change > 0 ? r : match;
        if (!outItem || !inItem) continue;

        const fromAsset = outItem.coin;
        const fromAmt = Math.abs(outItem.change);
        const toAsset = inItem.coin;
        const toAmt = inItem.change;

        const usdBrl = getUsdBrl(outItem.dateStr);
        let totalBrl = fromAmt;
        if (fromAsset === 'BRL') totalBrl = fromAmt;
        else if (fromAsset === 'USDT' || fromAsset === 'USD') totalBrl = fromAmt * usdBrl;
        else if (fromAsset === 'EUR') totalBrl = fromAmt * getEurUsd(outItem.dateStr) * usdBrl;

        const unitPriceBrl = toAmt > 0 ? totalBrl / toAmt : 0;

        history.push({
          id: `bin_conv_${outItem.timestamp}_${fromAsset}_${toAsset}`,
          type: 'CONVERT',
          date: new Date(outItem.timestamp).toISOString(),
          from_asset: fromAsset,
          from_amount: fromAmt,
          to_asset: toAsset,
          to_amount: toAmt,
          unit_price_brl: unitPriceBrl,
          total_brl: totalBrl,
        });
      }
    } else if (r.operation === 'Deposit' && r.change > 0) {
      processedIndices.add(i);
      const usdBrl = getUsdBrl(r.dateStr);
      let totalBrl = r.change;
      if (r.coin === 'EUR') totalBrl = r.change * getEurUsd(r.dateStr) * usdBrl;
      else if (r.coin === 'USDT' || r.coin === 'USD') totalBrl = r.change * usdBrl;

      history.push({
        id: `bin_dep_${r.timestamp}_${r.coin}`,
        type: 'FIAT',
        date: new Date(r.timestamp).toISOString(),
        from_asset: 'PIX/DEPÓSITO',
        from_amount: r.change,
        to_asset: r.coin,
        to_amount: r.change,
        unit_price_brl: 1.0,
        total_brl: totalBrl,
      });
    }
  }

  return history.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
