import fs from 'fs';
import path from 'path';

const csvPath = path.resolve(process.cwd(), 'src/data/binance_history.csv');
const lines = fs.readFileSync(csvPath, 'utf8').split(/\r?\n/).filter(l => l.trim().length > 0);

const rows = lines.slice(1).map(l => {
  const [userId, time, account, operation, coin, change, remark] = l.split(',');
  return { time, operation, coin, change: parseFloat(change), remark: remark || '' };
});

const nonInterest = rows.filter(r => r.operation !== 'Simple Earn Flexible Interest' && r.operation !== 'Simple Earn Flexible Subscription' && r.operation !== 'Simple Earn Flexible Redemption');

console.log('=== ALL BUYS AND CONVERTS (NON-EARN) ===');
nonInterest.forEach(r => {
  console.log(`${r.time} | ${r.operation.padEnd(20)} | ${r.coin.padEnd(6)} | change=${String(r.change).padEnd(14)} | remark=${r.remark}`);
});
