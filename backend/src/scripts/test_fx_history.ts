import yahooFinance from 'yahoo-finance2';

async function testFx() {
  const yf = typeof yahooFinance === 'function' ? new (yahooFinance as any)() : (yahooFinance as any).default ? new ((yahooFinance as any).default)() : yahooFinance;
  const usdBrlChart = await yf.chart('USDBRL=X', {
    period1: '2025-07-01',
    interval: '1d'
  });

  console.log('USDBRL quotes count:', usdBrlChart.quotes.length);
  const sample = usdBrlChart.quotes.filter((q: any) => {
    const d = new Date(q.date).toISOString().slice(0, 10);
    return ['2026-02-13', '2026-04-29', '2026-09-17', '2026-01-23', '2025-07-25'].includes(d);
  });
  console.log('Sample USDBRL dates:');
  sample.forEach((s: any) => {
    console.log(`${new Date(s.date).toISOString().slice(0, 10)}: close = ${s.close}`);
  });
}

testFx().catch(console.error);
