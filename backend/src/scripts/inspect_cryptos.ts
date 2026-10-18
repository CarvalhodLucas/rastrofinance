import { getAllInvestments } from '../services/supabaseService.js';

async function run() {
  const invs = await getAllInvestments();
  const cryptos = invs.filter(i => i.asset_type === 'CRYPTO' || (i.institution || '').toUpperCase().includes('BINANCE'));
  console.log('Total cryptos:', cryptos.length);
  for (const c of cryptos) {
    console.log({
      id: c.id,
      ticker: c.code_ticker,
      name: c.name,
      qty: c.quantity,
      avg: c.average_price,
      cur: c.current_price,
      total: c.total_value,
      sync_source: c.sync_source,
      currency: c.currency
    });
  }
}

run().catch(console.error);
