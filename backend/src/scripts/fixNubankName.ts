import { supabase } from '../services/supabaseService.js';

async function fix() {
  console.log('🔧 Corrigindo a instituição da conta NuBank...');

  const { data, error } = await supabase
    .from('connected_accounts')
    .update({ institution_name: 'Nubank' })
    .ilike('account_name', '%nubank%')
    .select();

  if (error) {
    console.error('❌ Erro ao atualizar:', error.message);
    process.exit(1);
  }

  console.log('✅ Conta atualizada com sucesso:');
  console.log(data);
  process.exit(0);
}

fix().catch(err => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
