import fs from 'fs';
import path from 'path';

const csvPath = path.resolve(process.cwd(), 'src/data/binance_history.csv');
const raw = fs.readFileSync(csvPath, 'utf8');
const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);

const rows = lines.slice(1).map(l => {
  const [userId, time, account, operation, coin, change, remark] = l.split(',');
  return { time, operation, coin, change: parseFloat(change), remark: remark || '' };
});

console.log('=== XLM TRANSACTIONS ===');
rows.filter(r => r.coin === 'XLM' && r.operation !== 'Simple Earn Flexible Interest').forEach(r => {
  console.log(`${r.time} | ${r.operation} | change=${r.change} | remark=${r.remark}`);
});

console.log('\n=== TAO TRANSACTIONS ===');
rows.filter(r => r.coin === 'TAO' && r.operation !== 'Simple Earn Flexible Interest').forEach(r => {
  console.log(`${r.time} | ${r.operation} | change=${r.change} | remark=${r.remark}`);
});

console.log('\n=== ALL CRYPTO-TO-CRYPTO CONVERTS ===');
const converts = rows.filter(r => r.operation === 'Binance Convert');
const times = Array.from(new Set(converts.map(c => c.time)));
for (const t of times) {
  const group = converts.filter(c => c.time === t);
  const outCoin = group.find(g => g.change < 0);
  const inCoin = group.find(g => g.change > 0);
  if (outCoin && inCoin) {
    console.log(`${t} -> OUT: ${outCoin.change} ${outCoin.coin} ==> IN: ${inCoin.change} ${inCoin.coin}`);
  }
}
