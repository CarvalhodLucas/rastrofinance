import { supabase } from '../services/supabaseService.js';

async function reset() {
  console.log('🧹 Limpando a flag is_recurring de transações normais...');

  // Resetar todas as transações para is_recurring = false
  const { data, error } = await supabase
    .from('transactions')
    .update({ is_recurring: false })
    .eq('is_recurring', true)
    .select();

  if (error) {
    console.error('❌ Erro ao resetar:', error.message);
    process.exit(1);
  }

  console.log(`✅ ${data?.length ?? 0} transações tiveram a flag de assinatura desmarcada!`);
  process.exit(0);
}

reset().catch((err) => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
