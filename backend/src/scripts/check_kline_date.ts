async function checkKline() {
  const ts = new Date('2025-09-25T04:49:01Z').getTime();
  const url = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&startTime=${ts}&limit=1`;
  const res = await fetch(url);
  const data: any = await res.json();
  console.log('Timestamp sent:', ts, new Date(ts).toISOString());
  console.log('Kline returned:', new Date(data[0][0]).toISOString(), 'Close:', data[0][4]);
}

checkKline().catch(console.error);
