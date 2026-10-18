import { supabase } from '../services/supabaseService.js';

import { getAllAccounts, supabase } from '../services/supabaseService.js';

async function main() {
  const accounts = await getAllAccounts();
  console.log('\n--- CONTAS APÓS GETALLACCOUNTS ---');
  console.table(accounts.map(a => ({ name: a.account_name, inst: a.institution_name, balance: a.balance, curr: a.currency, active: a.is_active })));

  process.exit(0);
}

main();
