import { supabase } from '../services/supabaseService.js';

async function main() {
  console.log('=== VERIFYING IMPORT RESULTS ===');
  
  // Fetch active accounts
  const { data: accounts, error: accErr } = await supabase
    .from('connected_accounts')
    .select('id, institution_name, account_name, currency');

  if (accErr) {
    console.error('Error fetching accounts:', accErr);
    return;
  }

  for (const acc of accounts || []) {
    const { count, error: countErr } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('account_id', acc.id);

    if (countErr) {
      console.error(`Error counting transactions for ${acc.account_name}:`, countErr);
      continue;
    }

    // Get currency counts in memory
    const { data: currencies, error: currErr } = await supabase
      .from('transactions')
      .select('original_currency')
      .eq('account_id', acc.id);

    const counts: Record<string, number> = {};
    if (currencies && Array.isArray(currencies)) {
      for (const t of currencies) {
        const c = t.original_currency || 'BRL';
        counts[c] = (counts[c] || 0) + 1;
      }
    }

    console.log(`\nAccount: ${acc.institution_name} - ${acc.account_name}`);
    console.log(`- Total transactions in DB: ${count}`);
    console.log(`- Currencies in statement:`, JSON.stringify(counts));
  }

  // Check if any transaction is uncategorized
  const { count: uncategorizedCount } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .or('category.is.null,category.eq.Outros,category.eq.Geral');

  console.log(`\nUncategorized/Outros/Geral transactions left: ${uncategorizedCount}`);
  console.log('=== VERIFICATION COMPLETED ===');
}

void main();
