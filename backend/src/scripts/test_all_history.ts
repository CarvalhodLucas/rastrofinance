import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const apiKey = process.env.BINANCE_API_KEY || '';
const apiSecret = process.env.BINANCE_SECRET_KEY || '';

async function queryTrades(symbol: string) {
  const timestamp = Date.now();
  const queryString = `symbol=${symbol}&startTime=0&timestamp=${timestamp}`;
  const signature = crypto
    .createHmac('sha256', apiSecret)
    .update(queryString)
    .digest('hex');

  const url = `https://api.binance.com/api/v3/myTrades?${queryString}&signature=${signature}`;
  const res = await fetch(url, {
    headers: { 'X-MBX-APIKEY': apiKey },
  });
  return await res.json();
}

async function run() {
  const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'ONDOUSDT', 'ROSEUSDT', 'VIRTUALUSDT', 'LINKUSDT', 'RENDERUSDT', 'SXTUSDT', 'BTCBRL', 'ETHBRL'];
  for (const s of symbols) {
    const res = await queryTrades(s);
    if (Array.isArray(res) && res.length > 0) {
      console.log(`=== Trades for ${s} (Count: ${res.length}) ===`);
      console.dir(res, { depth: null });
    }
  }
}

run();
