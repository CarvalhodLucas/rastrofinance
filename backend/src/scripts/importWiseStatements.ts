import fs from 'fs';
import path from 'path';
import { supabase, upsertInvestment } from '../services/supabaseService.js';
import type { TransactionUpsert } from '../types.js';

function parseWiseDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0]!;
  const clean = dateStr.trim().split(' ')[0]!;
  const parts = clean.split('-');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    if (day.length === 2 && month.length === 2 && year.length === 4) {
      return `${year}-${month}-${day}`;
    }
  }
  return dateStr;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

async function run() {
  const rootDir = path.resolve(process.cwd(), '..');
  const files = [
    'statement_103224208_USD_2025-05-13_2026-08-13.csv',
    'statement_127802829_EUR_2025-05-13_2026-08-13.csv',
    'statement_9963035_EUR_2025-05-13_2026-08-13.csv',
    'statement_102857651_CLP_2025-05-13_2026-08-13.csv',
  ];

  console.log('🚀 Iniciando importação das 4 planilhas da Wise...');

  const transactionsToInsert: TransactionUpsert[] = [];

  let finalUsdBalance = 4168.53;
  let totalUsdCashback = 0;
  let finalEurBalance = 1313.86;
  let finalClpBalance = 1186.0;

  for (const fileName of files) {
    const filePath = path.join(rootDir, fileName);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Arquivo não encontrado: ${filePath}`);
      continue;
    }

    console.log(`\n📄 Lendo ${fileName}...`);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter((l) => l.trim().length > 0);

    if (lines.length <= 1) continue;

    const header = parseCSVLine(lines[0]!);
    const idIdx = header.findIndex((h) => h.toLowerCase().includes('id'));
    const dateIdx = header.findIndex((h) => h.toLowerCase() === 'date');
    const amountIdx = header.findIndex((h) => h.toLowerCase() === 'amount');
    const currencyIdx = header.findIndex((h) => h.toLowerCase() === 'currency');
    const descIdx = header.findIndex((h) => h.toLowerCase() === 'description');
    const merchantIdx = header.findIndex((h) => h.toLowerCase() === 'merchant');
    const typeIdx = header.findIndex((h) => h.toLowerCase() === 'transaction type');
    const runningBalIdx = header.findIndex((h) => h.toLowerCase().includes('running balance'));

    for (let i = 1; i < lines.length; i++) {
      const row = parseCSVLine(lines[i]!);
      if (row.length < 5) continue;

      const rawId = row[idIdx] || `wise-${Date.now()}-${i}`;
      const rawDate = row[dateIdx] || '';
      const amountNum = parseFloat(row[amountIdx] || '0');
      const currency = row[currencyIdx] || 'BRL';
      const desc = row[descIdx] || row[merchantIdx] || 'Transação Wise';

      const dateISO = parseWiseDate(rawDate);

      if (desc.toLowerCase().includes('cashback') && currency === 'USD') {
        totalUsdCashback += Math.abs(amountNum);
      }

      if (row[runningBalIdx] && !isNaN(parseFloat(row[runningBalIdx]))) {
        const bal = parseFloat(row[runningBalIdx]);
        if (i === 1) {
          if (currency === 'USD') finalUsdBalance = bal;
          if (currency === 'EUR' && fileName.includes('127802829')) finalEurBalance = bal;
          if (currency === 'CLP') finalClpBalance = bal;
        }
      }

      let category = 'Outros';
      const descLower = desc.toLowerCase();
      if (descLower.includes('cashback') || descLower.includes('rende+')) category = 'Investimentos & Rendimentos';
      else if (descLower.includes('supermercado') || descLower.includes('consum') || descLower.includes('mercadona') || descLower.includes('jumbo') || descLower.includes('dia')) category = 'Alimentação & Supermercado';
      else if (descLower.includes('restaurante') || descLower.includes('chicken') || descLower.includes('food')) category = 'Restaurantes & Delivery';
      else if (descLower.includes('renfe') || descLower.includes('metro') || descLower.includes('uber') || descLower.includes('aparcamiento') || descLower.includes('telpark')) category = 'Transporte & Combustível';
      else if (descLower.includes('salário') || descLower.includes('folha')) category = 'Salário & Remuneração';

      transactionsToInsert.push({
        pluggy_transaction_id: rawId,
        date: dateISO,
        amount: amountNum,
        description: desc,
        category,
        transaction_type: (amountNum >= 0 ? 'CREDIT' : 'DEBIT') as any,
        original_currency: currency as any,
        original_amount: Math.abs(amountNum),
        exchange_rate: currency === 'BRL' ? 1 : currency === 'USD' ? 5.5 : currency === 'EUR' ? 6.0 : 0.0057,
      } as any);
    }
  }

  console.log(`\n✅ Lidas ${transactionsToInsert.length} transações dos 4 arquivos.`);

  console.log('\n✨ Cadastrando Ativos de Investimento "Wise Rende+"...');

  // Wise Rende+ EUR (BlackRock ICS Euro Liquidity Fund LU2757993600)
  await upsertInvestment({
    name: 'Wise Rende+ (EUR - BlackRock ICS Liquidity Fund)',
    code_ticker: 'LU2757993600',
    asset_type: 'FIXED_INCOME',
    institution: 'Wise',
    quantity: finalEurBalance,
    average_price: 1.0,
    current_price: 1.0,
    total_value: finalEurBalance,
    currency: 'EUR',
    sync_source: 'MANUAL',
  });

  // Wise Rende+ USD (Wise USD Balance Cashback Interest)
  await upsertInvestment({
    name: 'Wise Rende+ (USD - Balance Interest)',
    code_ticker: 'WISE_USD_INTEREST',
    asset_type: 'FIXED_INCOME',
    institution: 'Wise',
    quantity: finalUsdBalance,
    average_price: 1.0,
    current_price: 1.0,
    total_value: finalUsdBalance,
    currency: 'USD',
    sync_source: 'MANUAL',
  });

  // Wise Saldo CLP
  await upsertInvestment({
    name: 'Wise Saldo (CLP - Peso Chileno)',
    code_ticker: 'WISE_CLP',
    asset_type: 'OTHER',
    institution: 'Wise',
    quantity: finalClpBalance,
    average_price: 1.0,
    current_price: 1.0,
    total_value: finalClpBalance,
    currency: 'CLP',
    sync_source: 'MANUAL',
  });

  console.log('✅ Ativos "Wise Rende+" criados com sucesso em Investimentos!');

  // Deduplicate by pluggy_transaction_id
  const uniqueMap = new Map<string, any>();
  for (const tx of transactionsToInsert) {
    if (!uniqueMap.has(tx.pluggy_transaction_id)) {
      uniqueMap.set(tx.pluggy_transaction_id, tx);
    }
  }
  const uniqueTransactions = Array.from(uniqueMap.values());
  console.log(`\n✅ ${uniqueTransactions.length} transações únicas prontas para inserção.`);

  console.log('\n📥 Inserindo transações no banco de dados...');
  const batchSize = 100;
  for (let i = 0; i < uniqueTransactions.length; i += batchSize) {
    const batch = uniqueTransactions.slice(i, i + batchSize);
    const { error } = await supabase.from('transactions').upsert(batch, { onConflict: 'pluggy_transaction_id' });
    if (error) {
      console.error(`❌ Erro no lote ${i}:`, error.message);
    } else {
      console.log(`  ✓ Lote ${Math.floor(i / batchSize) + 1} (${batch.length} txs) importado com sucesso.`);
    }
  }

  console.log('\n🎉 Importação concluída com sucesso!');
  process.exit(0);
}

run().catch((err) => {
  console.error('❌ Erro na execução:', err);
  process.exit(1);
});
