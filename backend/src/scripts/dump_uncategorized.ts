import { supabase } from '../services/supabaseService.js';
import fs from 'fs';
import path from 'path';

async function main() {
  const santanderId = '74bbe812-690b-49c9-95a0-af95d73cb6b2';
  const wiseId = '02997b1a-03a8-45bd-ab39-32c078d40d38';

  const { data: txs, error } = await supabase
    .from('transactions')
    .select('pluggy_transaction_id, date, amount, description')
    .in('account_id', [santanderId, wiseId])
    .or('category.is.null,category.eq.Outros,category.eq.Geral');

  if (error) {
    console.error('Error fetching transactions:', error);
    return;
  }

  const outPath = path.join('c:/Users/Lucas de Carvalho/Documents/Sites/CRM FINANCIAS/backend', 'uncategorized.json');
  fs.writeFileSync(outPath, JSON.stringify(txs, null, 2));
  console.log(`Dumped ${txs?.length} uncategorized transactions to uncategorized.json`);
}

void main();
