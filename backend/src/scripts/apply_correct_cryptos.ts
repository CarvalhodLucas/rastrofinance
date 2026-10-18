import { getAllInvestments, upsertInvestment } from '../services/supabaseService.js';

interface CryptoTarget {
  ticker: string;
  name: string;
  quantity: number;
  current_price: number;
  average_price: number;
  total_value: number;
}

const TARGETS: CryptoTarget[] = [
  {
    ticker: 'BTC',
    name: 'Bitcoin',
    quantity: 0.0277202735,
    current_price: 81322.66,
    average_price: 93890.22,
    total_value: 2254.29,
  },
  {
    ticker: 'ONDO',
    name: 'Ondo',
    quantity: 3999.0919331652,
    current_price: 0.4402,
    average_price: 0.38754077,
    total_value: 1760.40,
  },
  {
    ticker: 'SOL',
    name: 'Solana',
    quantity: 12.7058165741,
    current_price: 103.46,
    average_price: 117.12,
    total_value: 1314.54,
  },
  {
    ticker: 'VIRTUAL',
    name: 'Virtuals Protocol',
    quantity: 931.6916807697,
    current_price: 0.655,
    average_price: 0.69622137,
    total_value: 610.26,
  },
  {
    ticker: 'ROSE',
    name: 'Oasis Network',
    quantity: 69931.5828015487,
    current_price: 0.00766,
    average_price: 0.01477392,
    total_value: 535.68,
  },
  {
    ticker: 'ETH',
    name: 'Ethereum',
    quantity: 0.1896558216,
    current_price: 2408.44,
    average_price: 3346.00,
    total_value: 456.77,
  },
  {
    ticker: 'LINK',
    name: 'ChainLink',
    quantity: 27.9397292449,
    current_price: 11.94,
    average_price: 9.30,
    total_value: 333.52,
  },
  {
    ticker: 'XRP',
    name: 'XRP',
    quantity: 153.37156008,
    current_price: 1.29,
    average_price: 1.30,
    total_value: 198.26,
  },
  {
    ticker: 'RENDER',
    name: 'Render',
    quantity: 75.0480362118,
    current_price: 1.84,
    average_price: 1.77,
    total_value: 138.01,
  },
];

async function main() {
  console.log('--- Applying exact crypto portfolio from user ---');
  const allInvs = await getAllInvestments();

  for (const t of TARGETS) {
    const existing = allInvs.find(
      (i) =>
        (i.code_ticker || '').toUpperCase() === t.ticker ||
        (i.name || '').toUpperCase() === t.name.toUpperCase()
    );

    const syncSource = `BINANCE_REPORT#${t.average_price}#${t.current_price}`;

    if (existing) {
      console.log(`Updating ${t.ticker} (ID: ${existing.id})...`);
      await upsertInvestment({
        id: existing.id,
        code_ticker: t.ticker,
        name: t.name,
        quantity: t.quantity,
        average_price: t.average_price,
        current_price: t.current_price,
        total_value: t.total_value,
        asset_type: 'CRYPTO',
        currency: 'USD',
        institution: 'Binance',
        sync_source: syncSource as any,
        last_synced_at: new Date().toISOString(),
      });
    } else {
      console.log(`Creating new ${t.ticker}...`);
      await upsertInvestment({
        code_ticker: t.ticker,
        name: t.name,
        quantity: t.quantity,
        average_price: t.average_price,
        current_price: t.current_price,
        total_value: t.total_value,
        asset_type: 'CRYPTO',
        currency: 'USD',
        institution: 'Binance',
        sync_source: syncSource as any,
        last_synced_at: new Date().toISOString(),
      });
    }
  }

  // Desativar SXT se existir
  const sxt = allInvs.find((i) => (i.code_ticker || '').toUpperCase() === 'SXT');
  if (sxt) {
    console.log('Closing SXT...');
    await upsertInvestment({
      id: sxt.id,
      quantity: 0,
      total_value: 0,
      sync_source: 'MANUAL_CLOSED' as any,
    });
  }

  console.log('--- Update Complete! Verifying ---');
  const updated = await getAllInvestments();
  const cryptos = updated.filter(
    (i) => (i.asset_type === 'CRYPTO' || i.institution === 'Binance') && i.quantity > 0
  );

  console.log(`\nActive Cryptos Count: ${cryptos.length}`);
  let sumTotal = 0;
  for (const c of cryptos) {
    sumTotal += c.total_value || 0;
    console.log(
      `${c.code_ticker.padEnd(8)} | Qty: ${String(c.quantity).padEnd(16)} | Avg: $${String(c.average_price).padEnd(10)} | Cur: $${String(c.current_price).padEnd(10)} | Total: $${c.total_value?.toFixed(2)}`
    );
  }
  console.log(`Total Cryptos Value: $${sumTotal.toFixed(2)}`);
}

main().catch(console.error);
