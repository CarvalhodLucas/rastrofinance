async function getHistoricalCryptoPrice(symbol: string, timestamp: number): Promise<number> {
  const clean = symbol.toUpperCase().replace(/USDT$/, '');
  const url = `https://api.binance.com/api/v3/klines?symbol=${clean}USDT&interval=1d&startTime=${timestamp - 86400000}&endTime=${timestamp + 86400000}&limit=3`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: any = await res.json();
    if (data && data.length > 0) {
      // Return open price or close price of that day
      // kline: [openTime, open, high, low, close, ...]
      return parseFloat(data[0][4]); // close
    }
  } catch (e: any) {
    console.error(`Error fetching historical ${symbol}:`, e.message);
  }
  return 0;
}

async function testCryptoPrices() {
  const dates = [
    { coin: 'BTC', time: '2025-09-25 04:49:01', amt: 0.00201068 },
    { coin: 'BTC', time: '2025-10-04 20:52:37', amt: 0.00466308 },
    { coin: 'SOL', time: '2025-10-31 02:20:44', amt: 0.6049982 },
    { coin: 'ONDO', time: '2025-11-23 21:09:20', amt: 465.35879506 },
    { coin: 'XLM', time: '2025-12-31 22:03:32', amt: 209.41444594 },
    { coin: 'XLM', time: '2026-01-02 15:52:40', amt: 713.82171086 },
    { coin: 'VIRTUAL', time: '2026-01-26 01:37:09', amt: 310.92855259 },
    { coin: 'ROSE', time: '2026-01-29 08:54:10', amt: 5896.98161282 },
  ];

  for (const d of dates) {
    const ts = new Date(d.time.replace(' ', 'T') + 'Z').getTime();
    const p = await getHistoricalCryptoPrice(d.coin, ts);
    const usdVal = d.amt * p;
    console.log(`${d.time} | ${d.coin}: ${d.amt} @ ~$${p.toFixed(4)} = ~$${usdVal.toFixed(2)} USD`);
  }
}

testCryptoPrices().catch(console.error);
