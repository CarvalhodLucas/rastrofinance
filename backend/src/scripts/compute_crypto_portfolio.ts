import fs from 'fs';
import path from 'path';
import yahooFinance from 'yahoo-finance2';

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

async function main() {
  const csvPath = path.resolve(process.cwd(), 'src/data/binance_history.csv');
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

  // Sort chronologically (oldest first)
  rows.sort((a, b) => a.timestamp - b.timestamp);

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

  // Cache for Binance klines
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

  // Pre-fetch klines for all Ref purchases
  console.log('Pre-fetching historical crypto prices for Ref purchases...');
  const refPurchases = rows.filter(r => r.operation === 'Buy Crypto With Fiat' && r.remark.includes('Ref') && r.change > 0);
  for (const r of refPurchases) {
    if (r.coin !== 'USDT') {
      await getCryptoPrice(r.coin, r.timestamp);
    }
  }

  // Portfolio tracking
  const portfolio: Record<string, AssetBalance> = {};
  function getAsset(coin: string): AssetBalance {
    if (!portfolio[coin]) {
      portfolio[coin] = { coin, qty: 0, totalCostUsd: 0, totalCostBrl: 0, avgPriceUsd: 0, avgPriceBrl: 0 };
    }
    return portfolio[coin];
  }

  // Process rows
  const processedIndices = new Set<number>();
  const tradeEvents: any[] = [];

  for (let i = 0; i < rows.length; i++) {
    if (processedIndices.has(i)) continue;
    const r = rows[i];

    // Interest/Staking: adds to quantity, costs 0 additional fiat
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
      tradeEvents.push({
        time: r.time,
        type: 'AIRDROP',
        coin: r.coin,
        qty: r.change,
        costUsd: 0,
        costBrl: 0,
      });
      continue;
    }

    // Subscriptions/Redemptions (Earn <-> Spot transfers, balance remains in Earn)
    if (r.operation === 'Simple Earn Flexible Subscription' || r.operation === 'Simple Earn Flexible Redemption') {
      processedIndices.add(i);
      continue;
    }

    // Binance Convert
    if (r.operation === 'Binance Convert') {
      // Find matching counterpart within 15 seconds
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
          // SWAP (Troca entre criptomoedas! ex: XLM -> SOL/ONDO/ROSE, TAO -> LINK/RENDER, ROSE -> XRP)
          const sourceAsset = getAsset(outCoin);
          // Preço médio do ativo de origem no momento da troca
          const sourceAvgCostUsd = sourceAsset.qty > 0 ? sourceAsset.totalCostUsd / sourceAsset.qty : 0;
          const sourceAvgCostBrl = sourceAsset.qty > 0 ? sourceAsset.totalCostBrl / sourceAsset.qty : 0;

          costUsd = outAmt * sourceAvgCostUsd;
          costBrl = outAmt * sourceAvgCostBrl;

          // Baixa quantidade e custo do ativo de origem
          sourceAsset.qty -= outAmt;
          sourceAsset.totalCostUsd -= costUsd;
          sourceAsset.totalCostBrl -= costBrl;
          if (sourceAsset.qty <= 0.00000001) {
            sourceAsset.qty = 0;
            sourceAsset.totalCostUsd = 0;
            sourceAsset.totalCostBrl = 0;
          }
        }

        // Adiciona ao ativo de destino
        const destAsset = getAsset(inCoin);
        destAsset.qty += inAmt;
        destAsset.totalCostUsd += costUsd;
        destAsset.totalCostBrl += costBrl;

        tradeEvents.push({
          time: outItem.time,
          dateStr: outItem.dateStr,
          type: 'CONVERT',
          usdBrl,
          outCoin,
          outAmt,
          inCoin,
          inAmt,
          costUsd,
          costBrl,
          unitPriceUsd: costUsd / inAmt,
          unitPriceBrl: costBrl / inAmt,
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

          tradeEvents.push({
            time: r.time,
            dateStr: r.dateStr,
            type: 'BUY_FIAT_DEDUCT',
            usdBrl,
            fiatCoin: r.coin,
            fiatAmt,
            cryptoCoin: matchCrypto.coin,
            cryptoAmt: matchCrypto.change,
            costUsd,
            costBrl,
            unitPriceUsd: costUsd / matchCrypto.change,
            unitPriceBrl: costBrl / matchCrypto.change,
          });
        }
      } else {
        // Crypto addition without matching negative line in loop yet
        // Check if there was a fiat deduction
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

          tradeEvents.push({
            time: r.time,
            dateStr: r.dateStr,
            type: 'BUY_FIAT_DEDUCT',
            usdBrl,
            fiatCoin: matchFiat.coin,
            fiatAmt,
            cryptoCoin: r.coin,
            cryptoAmt: r.change,
            costUsd,
            costBrl,
            unitPriceUsd: costUsd / r.change,
            unitPriceBrl: costBrl / r.change,
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

          tradeEvents.push({
            time: r.time,
            dateStr: r.dateStr,
            type: 'BUY_REF_CARD',
            usdBrl,
            cryptoCoin: r.coin,
            cryptoAmt: r.change,
            costUsd,
            costBrl,
            unitPriceUsd: priceUsd,
            unitPriceBrl: priceUsd * usdBrl,
          });
        }
      }
      continue;
    }
  }

  // Calculate final average prices
  console.log('\n====================== FINAL CRYPTO PORTFOLIO ======================');
  const result: Record<string, any> = {};
  for (const [coin, data] of Object.entries(portfolio)) {
    if (['BRL', 'EUR', 'USDT'].includes(coin)) continue;
    data.avgPriceUsd = data.qty > 0 ? data.totalCostUsd / data.qty : 0;
    data.avgPriceBrl = data.qty > 0 ? data.totalCostBrl / data.qty : 0;
    result[coin] = data;

    console.log(
      `${coin.padEnd(8)} | Qtd: ${data.qty.toFixed(8).padStart(16)} | Total USD: $${data.totalCostUsd.toFixed(2).padStart(8)} | Ticket Médio USD: $${data.avgPriceUsd.toFixed(4).padStart(10)} | Ticket Médio BRL: R$ ${data.avgPriceBrl.toFixed(2).padStart(10)}`
    );
  }

  console.log('\n--- KEY SWAP EVENTS AUDIT ---');
  tradeEvents.filter(e => e.type === 'CONVERT' && !['BRL', 'USDT'].includes(e.outCoin)).forEach(e => {
    console.log(`${e.time} | USD/BRL=${e.usdBrl.toFixed(4)} | SWAP: ${e.outAmt} ${e.outCoin} => ${e.inAmt} ${e.inCoin} | Cost USD: $${e.costUsd.toFixed(2)} | Unit Price USD: $${e.unitPriceUsd.toFixed(4)} (R$ ${e.unitPriceBrl.toFixed(2)})`);
  });
}

main().catch(console.error);
