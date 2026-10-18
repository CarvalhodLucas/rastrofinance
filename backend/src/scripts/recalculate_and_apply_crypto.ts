import fs from 'fs';
import path from 'path';
import yahooFinance from 'yahoo-finance2';
import { getAllInvestments, upsertInvestment, updateSetting } from '../services/supabaseService.js';
import type { Investment } from '../types.js';

const yf = typeof yahooFinance === 'function' ? new (yahooFinance as any)() : (yahooFinance as any).default ? new ((yahooFinance as any).default)() : yahooFinance;

interface Transaction {
  time: string;
  timestamp: number;
  dateStr: string;
  operation: string;
  coin: string;
  change: number;
  remark: string;
}

interface AssetBalance {
  coin: string;
  qty: number;
  totalCostUsd: number;
  totalCostBrl: number;
  avgPriceUsd: number;
  avgPriceBrl: number;
}

export async function recalculateAndApplyCryptoPortfolio() {
  console.log('=== STARTING COMPLETE CRYPTO RECALCULATION WITH HISTORICAL FX & SWAPS ===');

  let csvPath = path.resolve(process.cwd(), 'src/data/binance_history.csv');
  if (!fs.existsSync(csvPath)) {
    csvPath = path.resolve(process.cwd(), 'backend/src/data/binance_history.csv');
  }
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV file not found at ${csvPath}`);
  }

  const raw = fs.readFileSync(csvPath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);

  const rows: Transaction[] = lines.slice(1).map(l => {
    const [userId, time, account, operation, coin, change, remark] = l.split(',');
    return {
      time: time.trim(),
      timestamp: new Date(time.trim().replace(' ', 'T') + 'Z').getTime(),
      dateStr: time.trim().slice(0, 10),
      operation: (operation || '').trim(),
      coin: (coin || '').trim().toUpperCase(),
      change: parseFloat(change),
      remark: (remark || '').trim(),
    };
  });

  rows.sort((a, b) => a.timestamp - b.timestamp);
  console.log(`Loaded ${rows.length} rows chronologically (${rows[0].dateStr} to ${rows[rows.length - 1].dateStr})`);

  // Fetch FX charts
  console.log('Fetching historical daily USDBRL and EURUSD charts...');
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

  // Kline spot price cache
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

  // Pre-fetch klines for Ref purchases
  console.log('Pre-fetching historical spot prices for Ref purchases...');
  const refPurchases = rows.filter(r => r.operation === 'Buy Crypto With Fiat' && r.remark.includes('Ref') && r.change > 0);
  for (const r of refPurchases) {
    if (r.coin !== 'USDT') {
      await getCryptoPrice(r.coin, r.timestamp);
    }
  }

  const portfolio: Record<string, AssetBalance> = {};
  function getAsset(coin: string): AssetBalance {
    if (!portfolio[coin]) {
      portfolio[coin] = { coin, qty: 0, totalCostUsd: 0, totalCostBrl: 0, avgPriceUsd: 0, avgPriceBrl: 0 };
    }
    return portfolio[coin];
  }

  const processedIndices = new Set<number>();
  const allTradeRecords: any[] = [];

  for (let i = 0; i < rows.length; i++) {
    if (processedIndices.has(i)) continue;
    const r = rows[i];

    // Earn Flexible Interest
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
      allTradeRecords.push({
        id: `bin_airdrop_${r.timestamp}_${r.coin}`,
        trade_type: 'AIRDROP',
        asset_type: 'CRYPTO',
        ticker: r.coin,
        asset_name: r.coin,
        institution: 'Binance',
        quantity: r.change,
        unit_price: 0,
        total_value: 0,
        date: new Date(r.timestamp).toISOString(),
        source: 'BINANCE_REPORT',
        notes: `Airdrop ${r.change} ${r.coin}`,
      });
      continue;
    }

    // Transfers
    if (r.operation === 'Simple Earn Flexible Subscription' || r.operation === 'Simple Earn Flexible Redemption') {
      processedIndices.add(i);
      continue;
    }

    // Binance Convert
    if (r.operation === 'Binance Convert') {
      const counterpartIdx = rows.findIndex((other, idx) => 
        idx !== i &&
        !processedIndices.has(idx) &&
        other.operation === 'Binance Convert' &&
        Math.abs(other.timestamp - r.timestamp) <= 15000 &&
        ((r.change < 0 && other.change > 0) || (r.change > 0 && other.change < 0))
      );

      if (counterpartIdx !== -1) {
        processedIndices.add(i);
        processedIndices.add(counterpartIdx);
        const counterpart = rows[counterpartIdx];

        const outItem = r.change < 0 ? r : counterpart;
        const inItem = r.change > 0 ? r : counterpart;

        const outCoin = outItem.coin;
        const outAmt = Math.abs(outItem.change);
        const inCoin = inItem.coin;
        const inAmt = inItem.change;

        const usdBrl = getUsdBrl(outItem.dateStr);

        let costUsd = 0;
        let costBrl = 0;
        const isFiatFrom = ['BRL', 'EUR', 'USDT', 'USD'].includes(outCoin);

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
          // SWAP
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

        allTradeRecords.push({
          id: `bin_conv_${outItem.timestamp}_${outCoin}_${inCoin}`,
          trade_type: isFiatFrom ? 'BUY' : 'SWAP',
          asset_type: 'CRYPTO',
          ticker: inCoin,
          asset_name: inCoin,
          institution: 'Binance',
          quantity: inAmt,
          unit_price: inAmt > 0 ? costUsd / inAmt : 0,
          total_value: costUsd,
          from_ticker: outCoin,
          from_quantity: outAmt,
          to_ticker: inCoin,
          to_quantity: inAmt,
          date: new Date(outItem.timestamp).toISOString(),
          source: 'BINANCE_REPORT',
          notes: isFiatFrom 
            ? `Conversão ${outAmt} ${outCoin} ➔ ${inAmt} ${inCoin} (Câmbio USD/BRL: R$ ${usdBrl.toFixed(2)})`
            : `Troca: ${outAmt} ${outCoin} ➔ ${inAmt} ${inCoin} (Câmbio USD/BRL: R$ ${usdBrl.toFixed(2)}, Custo transferido: $${costUsd.toFixed(2)})`,
        });
      }
      continue;
    }

    // Buy Crypto With Fiat
    if (r.operation === 'Buy Crypto With Fiat') {
      const usdBrl = getUsdBrl(r.dateStr);
      const eurUsd = getEurUsd(r.dateStr);

      if (r.change < 0) {
        // Fiat deduction line
        const matchCryptoIdx = rows.findIndex((other, idx) => 
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

          allTradeRecords.push({
            id: `bin_fiat_${r.timestamp}_${matchCrypto.coin}`,
            trade_type: 'BUY',
            asset_type: 'CRYPTO',
            ticker: matchCrypto.coin,
            asset_name: matchCrypto.coin,
            institution: 'Binance',
            quantity: matchCrypto.change,
            unit_price: costUsd / matchCrypto.change,
            total_value: costUsd,
            from_ticker: r.coin,
            from_quantity: fiatAmt,
            date: new Date(r.timestamp).toISOString(),
            source: 'BINANCE_REPORT',
            notes: `Compra via saldo Fiat: ${fiatAmt} ${r.coin} ➔ ${matchCrypto.change} ${matchCrypto.coin}`,
          });
        }
      } else {
        // Crypto addition
        const matchFiatIdx = rows.findIndex((other, idx) => 
          idx !== i &&
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

          allTradeRecords.push({
            id: `bin_fiat_${r.timestamp}_${r.coin}`,
            trade_type: 'BUY',
            asset_type: 'CRYPTO',
            ticker: r.coin,
            asset_name: r.coin,
            institution: 'Binance',
            quantity: r.change,
            unit_price: costUsd / r.change,
            total_value: costUsd,
            from_ticker: matchFiat.coin,
            from_quantity: fiatAmt,
            date: new Date(r.timestamp).toISOString(),
            source: 'BINANCE_REPORT',
            notes: `Compra via saldo Fiat: ${fiatAmt} ${matchFiat.coin} ➔ ${r.change} ${r.coin}`,
          });
        } else {
          // Direct Ref purchase
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

          allTradeRecords.push({
            id: `bin_ref_${r.timestamp}_${r.coin}`,
            trade_type: 'BUY',
            asset_type: 'CRYPTO',
            ticker: r.coin,
            asset_name: r.coin,
            institution: 'Binance',
            quantity: r.change,
            unit_price: priceUsd,
            total_value: costUsd,
            date: new Date(r.timestamp).toISOString(),
            source: 'BINANCE_REPORT',
            notes: `Compra direta / Auto-Invest (${r.remark}): ${r.change} ${r.coin} @ $${priceUsd.toFixed(4)}`,
          });
        }
      }
      continue;
    }
  }

  // Fetch current spot prices from Binance API
  console.log('\nFetching current spot prices from Binance API...');
  const currentPrices: Record<string, number> = {};
  const coinsToQuote = Object.keys(portfolio).filter(c => !['BRL', 'EUR', 'USDT'].includes(c));

  for (const coin of coinsToQuote) {
    try {
      const res = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${coin}USDT`);
      if (res.ok) {
        const data: any = await res.json();
        currentPrices[coin] = parseFloat(data.price);
      }
    } catch (e) {
      console.warn(`Could not fetch live price for ${coin}`);
    }
  }

  // Existing DB investments
  const existingInvestments = await getAllInvestments();
  const existingMap = new Map<string, Investment>();
  for (const inv of existingInvestments) {
    if (inv.institution === 'Binance' || inv.asset_type === 'CRYPTO') {
      existingMap.set(inv.code_ticker.toUpperCase(), inv);
    }
  }

  console.log('\n=== UPDATING INVESTMENTS IN SUPABASE ===');
  const updatedList: Investment[] = [];

  for (const [coin, data] of Object.entries(portfolio)) {
    if (['BRL', 'EUR', 'USDT'].includes(coin)) continue;

    const existing = existingMap.get(coin);

    // If existing in DB has extra staking yield (Earn), preserve the higher quantity:
    // (except for ROSE where existing DB had the un-deducted 31,347 swap)
    let finalQty = data.qty;
    if (coin === 'ROSE') {
      if (existing && existing.quantity > 80000) {
        // Correct previous missing deduction in DB:
        finalQty = existing.quantity - 31347;
      } else {
        finalQty = data.qty;
      }
    } else if (existing && existing.quantity > data.qty) {
      finalQty = existing.quantity;
    }

    const avgPriceUsd = finalQty > 0 ? data.totalCostUsd / finalQty : 0;
    const currentPriceUsd = currentPrices[coin] || (existing?.current_price && existing.current_price > 0 ? existing.current_price : avgPriceUsd);
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
    updatedList.push(saved);

    console.log(
      `✓ ${coin.padEnd(8)} | Qtd: ${finalQty.toFixed(8).padStart(16)} | Ticket Médio: $${avgPriceUsd.toFixed(4).padStart(10)} | Preço Atual: $${currentPriceUsd.toFixed(4).padStart(10)} | Total: $${totalValUsd.toFixed(2).padStart(9)}`
    );
  }

  // Also check if XRP was in existingMap, if not it was already added above in portfolio!
  // If TAO or XLM were in existingMap and not in portfolio, ensure they are 0
  for (const [ticker, inv] of existingMap.entries()) {
    if (!portfolio[ticker]) {
      await upsertInvestment({
        id: inv.id,
        quantity: 0,
        total_value: 0,
        sync_source: 'MANUAL_CLOSED',
        last_synced_at: new Date().toISOString(),
      });
      console.log(`✓ Closed inactive/untracked coin: ${ticker}`);
    }
  }

  // Update TRADES_STORAGE_KEY in settings table
  console.log(`\nCompiling ${allTradeRecords.length} Binance trade records to Extrato/Histórico...`);
  const TRADES_STORAGE_KEY = 'investment_all_trades_history';
  await updateSetting(TRADES_STORAGE_KEY, allTradeRecords);
  console.log('✓ Trade history successfully saved to Supabase settings.');

  console.log('\n=== ALL DONE! CRYPTO PORTFOLIO FULLY UPDATED ===');
  return updatedList;
}

recalculateAndApplyCryptoPortfolio().catch(console.error);
