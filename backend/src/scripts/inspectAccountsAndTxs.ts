import { supabase } from '../services/supabaseService.js';

async function check() {
  console.log('--- BUSCANDO CONTAS E TRANSAÇÕES ---');
  const { data: accs } = await supabase.from('connected_accounts').select('*');
  console.log('Contas encontradas:');
  console.table(accs?.map((a) => ({ id: a.id, name: a.account_name, inst: a.institution_name, balance: a.balance })));

  const { data: txs } = await supabase.from('transactions').select('*').not('account_id', 'is', null);
  console.log(`Transações vinculadas a contas (${txs?.length ?? 0}):`);
  console.table(txs?.map((t) => ({ id: t.id, desc: t.description, amt: t.amount, accId: t.account_id })));

  process.exit(0);
}

check().catch((err) => {
  console.error(err);
  process.exit(1);
});
