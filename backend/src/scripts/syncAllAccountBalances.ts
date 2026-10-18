import { supabase, updateAccountBalanceDelta } from '../services/supabaseService.js';

async function syncAll() {
  console.log('🔄 Sincronizando saldos de todas as contas...');

  // 1. Encontrar a transação de Salario de 590 vinculada à conta XP
  const { data: xpAcc } = await supabase
    .from('connected_accounts')
    .select('*')
    .ilike('account_name', '%xp%')
    .single();

  if (xpAcc) {
    console.log(`Conta XP encontrada: ID=${xpAcc.id}, Saldo Atual=${xpAcc.balance}`);
    const { data: salaryTx } = await supabase
      .from('transactions')
      .select('*')
      .eq('account_id', xpAcc.id)
      .eq('description', 'Salario')
      .single();

    if (salaryTx) {
      console.log(`Transação Salario encontrada (+${salaryTx.amount}). Aplicando ao saldo da XP...`);
      await updateAccountBalanceDelta(xpAcc.id, salaryTx.original_amount ?? salaryTx.amount, salaryTx.original_currency || 'BRL');
    }
  }

  // Exibir resumo atualizado de todas as contas
  const { data: updatedAccs } = await supabase.from('connected_accounts').select('account_name, institution_name, balance, currency');
  console.log('\n✅ Saldos de Contas Atualizados com Sucesso:');
  console.table(updatedAccs);

  process.exit(0);
}

syncAll().catch((err) => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
