import { getDividendsFromReport, syncDividendsToTransactions } from '../services/dividendService.js';

async function test() {
  console.log('=== Testando Leitura de Dividendos do Excel ===');
  const summary = await getDividendsFromReport();
  console.log('Total Dividendos:', summary.total_dividends);
  console.log('Total JCP:', summary.total_jcp);
  console.log('Total Rendimentos FII:', summary.total_fii_earnings);
  console.log('Total Acumulado:', summary.total_overall);
  console.log('Quantidade de ativos com proventos:', summary.items.length);
  console.log('Primeiros 3 ativos:', summary.items.slice(0, 3));

  console.log('\n=== Testando Sincronização Anti-Duplicidade ===');
  const res1 = await syncDividendsToTransactions();
  console.log('Passo 1 (Inserção inicial):', res1);

  const res2 = await syncDividendsToTransactions();
  console.log('Passo 2 (Execução consecutiva - deve ter 0 inseridos e 18 pulados):', res2);
}

test().catch(console.error);
