import fs from 'fs';
import path from 'path';
import { getAllInvestments } from '../services/supabaseService';

async function main() {
  const invs = await getAllInvestments();
  const cryptos = invs.filter(i => i.asset_type === 'CRYPTO' || i.institution === 'Binance');
  console.log('--- CURRENT DB CRYPTOS ---');
  for (const c of cryptos) {
    console.log(`${c.code_ticker} (${c.name}): qty=${c.quantity}, avg_price=${c.average_price}, current_price=${c.current_price}, total_val=${c.total_value}, currency=${c.currency}`);
  }

  const csvPath = path.resolve(process.cwd(), 'src/data/binance_history.csv');
  const raw = fs.readFileSync(csvPath, 'utf8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
  console.log(`\nTotal CSV lines: ${lines.length}`);

  // Find all operations
  const opCounts: Record<string, number> = {};
  const converts: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    const op = parts[3];
    opCounts[op] = (opCounts[op] || 0) + 1;
    if (op === 'Binance Convert') {
      converts.push(lines[i]);
    }
  }

  console.log('\nOperation counts:', opCounts);
  console.log(`\nTotal Binance Convert lines: ${converts.length}`);
  console.log('\nConvert sample / all:');
  converts.forEach(c => console.log(c));
}

main().catch(console.error);
