import { supabase } from '../services/supabaseService.js';

async function main() {
  const { data, error } = await supabase
    .from('connected_accounts')
    .select('*');

  if (error) {
    console.error('Erro ao buscar contas:', error);
  } else {
    console.log('Contas conectadas:', JSON.stringify(data, null, 2));
  }
}

main();
