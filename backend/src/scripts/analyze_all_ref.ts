import fs from 'fs';
import path from 'path';

async function getHistoricalCryptoPrice(symbol: string, timestamp: number): Promise<number> {
  const clean = symbol.toUpperCase().replace(/USDT$/, '');
  const url = `https://api.binance.com/api/v3/klines?symbol=${clean}USDT&interval=1d&startTime=${timestamp - 86400000}&endTime=${timestamp + 86400000}&limit=3`;
  try {
    const res = await fetch(url);
    if (!res.ok) return 0;
    const data: any = await res.json();
    if (data && data.length > 0) {
      return parseFloat(data[0][4]);
    }
  } catch (e) {
    return 0;
  }
  return 0;
}

async function analyzeRef() {
  const csvPath = path.resolve(process.cwd(), 'src/data/binance_history.csv');
  const raw = fs.readFileSync(csvPath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);

  const rows = lines.slice(1).map(l => {
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

  const refRows = rows.filter(r => r.operation === 'Buy Crypto With Fiat' && r.remark.includes('Ref') && r.change > 0);
  console.log(`Analyzing ${refRows.length} Ref purchases...`);

  for (const r of refRows) {
    const p = await getHistoricalCryptoPrice(r.coin, r.timestamp);
    const usdVal = r.change * p;
    console.log(`${r.time} | ${r.coin}: ${r.change} @ ~$${p.toFixed(4)} = ~$${usdVal.toFixed(2)} USD`);
  }
}

analyzeRef().catch(console.error);
