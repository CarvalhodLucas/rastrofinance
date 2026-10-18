import { supabase } from '../services/supabaseService.js';

async function cleanup() {
  console.log('🧹 Limpando duplicadas de investimentos da Wise...');

  // Deletar todos os registros existentes com instituição 'Wise'
  const { error: deleteError } = await supabase
    .from('investments')
    .delete()
    .eq('institution', 'Wise');

  if (deleteError) {
    console.error('❌ Erro ao deletar investimentos antigos da Wise:', deleteError.message);
    process.exit(1);
  }

  console.log('✅ Antigos registros deletados com sucesso.');

  // Cadastrar EXATAMENTE os 2 ativos da Wise que o usuário possui:
  const wiseAssets = [
    {
      name: 'Wise Dólar (USD)',
      code_ticker: 'WISE_USD',
      asset_type: 'FIXED_INCOME',
      institution: 'Wise',
      quantity: 4168.53,
      average_price: 1.0,
      current_price: 1.0,
      total_value: 4168.53,
      currency: 'USD',
      sync_source: 'MANUAL',
    },
    {
      name: 'Wise Euro (EUR)',
      code_ticker: 'WISE_EUR',
      asset_type: 'FIXED_INCOME',
      institution: 'Wise',
      quantity: 1313.86,
      average_price: 1.0,
      current_price: 1.0,
      total_value: 1313.86,
      currency: 'EUR',
      sync_source: 'MANUAL',
    },
  ];

  const { data, error: insertError } = await supabase
    .from('investments')
    .insert(wiseAssets)
    .select();

  if (insertError) {
    console.error('❌ Erro ao cadastrar os 2 ativos da Wise:', insertError.message);
    process.exit(1);
  }

  console.log('🎉 Sucesso! Cadastrados exatamente 2 ativos da Wise:');
  console.log(data);
  process.exit(0);
}

cleanup().catch((err) => {
  console.error('❌ Erro fatal:', err);
  process.exit(1);
});
