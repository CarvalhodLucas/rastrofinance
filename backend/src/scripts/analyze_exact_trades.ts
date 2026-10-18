import fs from 'fs';
import path from 'path';
import yahooFinance from 'yahoo-finance2';

const yf = typeof yahooFinance === 'function' ? new (yahooFinance as any)() : (yahooFinance as any).default ? new ((yahooFinance as any).default)() : yahooFinance;

async function analyze() {
  const csvPath = path.resolve(process.cwd(), 'src/data/binance_history.csv');
  const raw = fs.readFileSync(csvPath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);

  const rows = lines.slice(1).map((l, idx) => {
    const [userId, time, account, operation, coin, change, remark] = l.split(',');
    return {
      idx,
      time: time.trim(),
      timestamp: new Date(time.trim().replace(' ', 'T') + 'Z').getTime(),
      dateStr: time.trim().slice(0, 10),
      account: (account || '').trim(),
      operation: (operation || '').trim(),
      coin: (coin || '').trim().toUpperCase(),
      change: parseFloat(change),
      remark: (remark || '').trim(),
    };
  });

  // Sort chronologically (oldest first)
  rows.sort((a, b) => a.timestamp - b.timestamp);

  console.log(`Loaded ${rows.length} rows chronologically from ${rows[0].time} to ${rows[rows.length - 1].time}`);

  // Fetch USDBRL and EURUSD historical daily charts
  console.log('Fetching historical FX charts...');
  const usdBrlChart = await yf.chart('USDBRL=X', { period1: '2025-07-01', interval: '1d' });
  const eurUsdChart = await yf.chart('EURUSD=X', { period1: '2025-07-01', interval: '1d' });

  const usdBrlMap = new Map<string, number>();
  for (const q of usdBrlChart.quotes) {
    if (q.date && q.close) {
      usdBrlMap.set(new Date(q.date).toISOString().slice(0, 10), q.close);
    }
  }

  const eurUsdMap = new Map<string, number>();
  for (const q of eurUsdChart.quotes) {
    if (q.date && q.close) {
      eurUsdMap.set(new Date(q.date).toISOString().slice(0, 10), q.close);
    }
  }

  function getUsdBrl(dateStr: string): number {
    if (usdBrlMap.has(dateStr)) return usdBrlMap.get(dateStr)!;
    // Check previous days (weekends/holidays)
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

  console.log('\n--- 1. PAIRED BINANCE CONVERT OPERATIONS ---');
  const convertRows = rows.filter(r => r.operation === 'Binance Convert');
  const usedConverts = new Set<number>();
  const pairedConverts: any[] = [];

  for (let i = 0; i < convertRows.length; i++) {
    if (usedConverts.has(convertRows[i].idx)) continue;
    const itemA = convertRows[i];
    // Find counterpart within +/- 15 seconds
    const counterpart = convertRows.find(itemB => 
      !usedConverts.has(itemB.idx) &&
      itemB.idx !== itemA.idx &&
      Math.abs(itemB.timestamp - itemA.timestamp) <= 15000 &&
      ((itemA.change < 0 && itemB.change > 0) || (itemA.change > 0 && itemB.change < 0))
    );

    if (counterpart) {
      usedConverts.add(itemA.idx);
      usedConverts.add(counterpart.idx);
      const outItem = itemA.change < 0 ? itemA : counterpart;
      const inItem = itemA.change > 0 ? itemA : counterpart;
      pairedConverts.push({
        time: outItem.time,
        dateStr: outItem.dateStr,
        outCoin: outItem.coin,
        outAmt: Math.abs(outItem.change),
        inCoin: inItem.coin,
        inAmt: inItem.change,
        usdBrl: getUsdBrl(outItem.dateStr),
      });
    } else {
      console.warn('Unpaired convert row:', itemA);
    }
  }

  pairedConverts.forEach(p => {
    console.log(`${p.time} (${p.dateStr}) | USD/BRL=${p.usdBrl.toFixed(4)} | OUT: ${p.outAmt} ${p.outCoin} => IN: ${p.inAmt} ${p.inCoin}`);
  });

  console.log('\n--- 2. BUY CRYPTO WITH FIAT (CASH BALANCE & REF) ---');
  const buyRows = rows.filter(r => r.operation === 'Buy Crypto With Fiat');
  const pairedBuys: any[] = [];
  const usedBuys = new Set<number>();

  for (let i = 0; i < buyRows.length; i++) {
    if (usedBuys.has(buyRows[i].idx)) continue;
    const item = buyRows[i];

    if (item.change < 0) {
      // It's a fiat deduction, find matching crypto addition
      const match = buyRows.find(b => 
        !usedBuys.has(b.idx) &&
        b.change > 0 &&
        Math.abs(b.timestamp - item.timestamp) <= 15000
      );
      if (match) {
        usedBuys.add(item.idx);
        usedBuys.add(match.idx);
        pairedBuys.push({
          type: 'FIAT_DEDUCTION',
          time: item.time,
          dateStr: item.dateStr,
          fiatCoin: item.coin,
          fiatAmt: Math.abs(item.change),
          cryptoCoin: match.coin,
          cryptoAmt: match.change,
          remark: match.remark,
          usdBrl: getUsdBrl(item.dateStr),
          eurUsd: getEurUsd(item.dateStr),
        });
      }
    } else {
      // It's a crypto addition
      // Check if there was a fiat deduction
      const matchFiat = rows.find(r => 
        (r.operation === 'Buy Crypto With Fiat' || r.operation === 'Deposit') &&
        r.change < 0 &&
        ['BRL', 'EUR', 'USDT'].includes(r.coin) &&
        Math.abs(r.timestamp - item.timestamp) <= 15000 &&
        !usedBuys.has(r.idx)
      );

      if (matchFiat) {
        usedBuys.add(item.idx);
        usedBuys.add(matchFiat.idx);
        pairedBuys.push({
          type: 'FIAT_DEDUCTION',
          time: item.time,
          dateStr: item.dateStr,
          fiatCoin: matchFiat.coin,
          fiatAmt: Math.abs(matchFiat.change),
          cryptoCoin: item.coin,
          cryptoAmt: item.change,
          remark: item.remark,
          usdBrl: getUsdBrl(item.dateStr),
          eurUsd: getEurUsd(item.dateStr),
        });
      } else {
        // Direct Ref purchase without explicit deduction line
        usedBuys.add(item.idx);
        pairedBuys.push({
          type: 'REF_CARD',
          time: item.time,
          dateStr: item.dateStr,
          cryptoCoin: item.coin,
          cryptoAmt: item.change,
          remark: item.remark,
          usdBrl: getUsdBrl(item.dateStr),
          eurUsd: getEurUsd(item.dateStr),
        });
      }
    }
  }

  console.log(`Total paired buys: ${pairedBuys.length}`);
  const refBuys = pairedBuys.filter(b => b.type === 'REF_CARD');
  console.log(`\nRef (Card/Recurring) purchases count: ${refBuys.length}`);
  refBuys.forEach(b => {
    console.log(`${b.time} (${b.dateStr}) | ${b.cryptoCoin}: +${b.cryptoAmt} | remark=${b.remark} | USDBRL=${b.usdBrl.toFixed(4)}`);
  });
}

analyze().catch(console.error);
