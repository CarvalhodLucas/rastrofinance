import { supabase } from '../services/supabaseService.js';

function getCategoryInfo(description: string, amount: number): {
  category: string;
  subcategory: string;
  merchant_name: string;
  is_essential: boolean;
  is_recurring: boolean;
} {
  const desc = description.toUpperCase();

  // Receitas e Vendas de Ativos
  if (desc.includes('VENTA') && desc.includes('ETF')) {
    return {
      category: 'Receita',
      subcategory: 'Investimentos - Venda',
      merchant_name: 'Vanguard',
      is_essential: false,
      is_recurring: false,
    };
  }
  if (desc.includes('INGRESO ANONIMO EN CAJERO')) {
    return {
      category: 'Receita',
      subcategory: 'Depósito em Espécie',
      merchant_name: 'Santander ATM',
      is_essential: false,
      is_recurring: false,
    };
  }
  if (desc.includes('LIQUIDACION DEL CONTRATO')) {
    return {
      category: 'Receita',
      subcategory: 'Investimentos - Liquidação',
      merchant_name: 'Santander',
      is_essential: false,
      is_recurring: false,
    };
  }

  // Bizum
  if (desc.includes('BIZUM')) {
    const isReceived = desc.includes('BIZUM DE') || desc.includes('DEVOLUCIÓN BIZUM RECIBIDO');
    const parts = description.split(/(?:A FAVOR DE|DE|RECIBIDO DE)\s+/i);
    let personName = 'Bizum';
    if (parts.length > 1) {
      personName = parts[1].split(/\s+CONCEPTO/i)[0].trim();
    }
    
    if (isReceived || amount > 0) {
      return {
        category: 'Receita',
        subcategory: 'Bizum Recebido',
        merchant_name: personName,
        is_essential: false,
        is_recurring: false,
      };
    } else {
      return {
        category: 'Transferências',
        subcategory: 'Bizum Enviado',
        merchant_name: personName,
        is_essential: false,
        is_recurring: false,
      };
    }
  }

  // Comissões Bancárias
  if (desc.includes('COMISION')) {
    return {
      category: 'Serviços Financeiros',
      subcategory: 'Tarifa Bancária',
      merchant_name: 'Banco Santander',
      is_essential: true,
      is_recurring: false,
    };
  }

  // Uber
  if (desc.includes('UBER') || desc.includes('UBR*')) {
    return {
      category: 'Transporte',
      subcategory: 'Uber',
      merchant_name: 'Uber',
      is_essential: false,
      is_recurring: false,
    };
  }

  // Amazon
  if (desc.includes('AMAZON')) {
    return {
      category: 'Outros',
      subcategory: 'E-commerce',
      merchant_name: 'Amazon',
      is_essential: false,
      is_recurring: false,
    };
  }

  // Supermercados & Alimentação (MERCADONA, CONSUM, DIA, CHARTER, AHORRAMAS, LIDL, etc.)
  if (
    desc.includes('MERCADONA') ||
    desc.includes('CONSUM') ||
    desc.includes('DIA ') ||
    desc.includes('DIA1') ||
    desc.includes('DIA_') ||
    desc.includes('CHARTER') ||
    desc.includes('AHORRAMAS') ||
    desc.includes('LIDL') ||
    desc.includes('CARREFOUR') ||
    desc.includes('SUMA PUERTO') ||
    desc.includes('SUPERMERCADO 24') ||
    desc.includes('LA CESTA DORADA') ||
    desc.includes('LA DESPENSA') ||
    desc.includes('GLOBAL FOOD') ||
    desc.includes('MINI MARKET') ||
    desc.includes('AMIGO SUPERMERC') ||
    desc.includes('ALIMENTACION') ||
    desc.includes('FRUTAS Y VERDUR') ||
    desc.includes('PRIMAPRIX')
  ) {
    let merchant = 'Supermercado';
    if (desc.includes('MERCADONA')) merchant = 'Mercadona';
    else if (desc.includes('CONSUM')) merchant = 'Consum';
    else if (desc.includes('DIA')) merchant = 'Dia';
    else if (desc.includes('CHARTER')) merchant = 'Charter';
    else if (desc.includes('AHORRAMAS')) merchant = 'Ahorramas';
    else if (desc.includes('LIDL')) merchant = 'Lidl';
    else if (desc.includes('CARREFOUR')) merchant = 'Carrefour';
    else if (desc.includes('PRIMAPRIX')) merchant = 'Primaprix';
    else if (desc.includes('LA DESPENSA')) merchant = 'La Despensa';

    return {
      category: 'Alimentação',
      subcategory: 'Supermercado',
      merchant_name: merchant,
      is_essential: true,
      is_recurring: false,
    };
  }

  // Restaurantes & Delivery & Cafeteria
  if (
    desc.includes('RESTAURANTE') ||
    desc.includes('CAFETERIA') ||
    desc.includes('CAFE COLORES') ||
    desc.includes('CERVECERIA') ||
    desc.includes('BAR SOÑAR') ||
    desc.includes('LA CASA DEL MAR') ||
    desc.includes('SULTAN PALAST') ||
    desc.includes('TI AMO KEBAB') ||
    desc.includes('TAJ MAHAL') ||
    desc.includes('FULI XIA') ||
    desc.includes('ALBI FOOD')
  ) {
    let merchant = 'Restaurante';
    if (desc.includes('BAR SOÑAR')) merchant = 'Bar Soñar';
    else if (desc.includes('CAFE COLORES')) merchant = 'Cafe Colores';
    else if (desc.includes('SULTAN PALAST')) merchant = 'Sultan Palast';
    else if (desc.includes('TI AMO KEBAB')) merchant = 'Ti Amo Kebab';
    else if (desc.includes('TAJ MAHAL')) merchant = 'Taj Mahal';
    else if (desc.includes('LA CASA DEL MAR')) merchant = 'La Casa Del Mar';

    return {
      category: 'Restaurantes e Delivery',
      subcategory: 'Restaurante / Bar',
      merchant_name: merchant,
      is_essential: false,
      is_recurring: false,
    };
  }

  // Transporte Público
  if (
    desc.includes('METRO') ||
    desc.includes('RENFE') ||
    desc.includes('AISA') ||
    desc.includes('EMPRESA MARTIN') ||
    desc.includes('FGV') ||
    desc.includes('LICENCIA 15799')
  ) {
    let merchant = 'Transporte Público';
    if (desc.includes('METRO')) merchant = 'Metro de Madrid';
    else if (desc.includes('RENFE')) merchant = 'Renfe';
    else if (desc.includes('EMPRESA MARTIN')) merchant = 'Empresa Martín';
    else if (desc.includes('FGV')) merchant = 'FGV Valencia';

    return {
      category: 'Transporte',
      subcategory: 'Transporte Público',
      merchant_name: merchant,
      is_essential: true,
      is_recurring: false,
    };
  }

  // Combustível / Posto
  if (desc.includes('ESTACION SERVIC') || desc.includes('E.S. MORATALAZ')) {
    return {
      category: 'Transporte',
      subcategory: 'Combustível',
      merchant_name: 'Posto de Combustível',
      is_essential: true,
      is_recurring: false,
    };
  }

  // Estacionamento
  if (desc.includes('APARCAMIENTO')) {
    return {
      category: 'Transporte',
      subcategory: 'Estacionamento',
      merchant_name: 'Estacionamento',
      is_essential: false,
      is_recurring: false,
    };
  }

  // Lazer, Baladas e Cinema
  if (desc.includes('KQ') || desc.includes('SALA SKIN') || desc.includes('GRAFITTI DISCO') || desc.includes('CINES ABC') || desc.includes('FOURVENUES')) {
    let merchant = 'Lazer';
    if (desc.includes('KQ')) merchant = 'KQ Club';
    else if (desc.includes('SALA SKIN')) merchant = 'Sala Skin';
    else if (desc.includes('GRAFITTI DISCO')) merchant = 'Grafitti Disco';
    else if (desc.includes('CINES ABC')) merchant = 'Cines ABC';
    else if (desc.includes('FOURVENUES')) merchant = 'Fourvenues';

    return {
      category: 'Lazer e Entretenimento',
      subcategory: 'Balada / Lazer',
      merchant_name: merchant,
      is_essential: false,
      is_recurring: false,
    };
  }

  // Vestuário
  if (desc.includes('PRIMARK')) {
    return {
      category: 'Vestuário',
      subcategory: 'Roupas',
      merchant_name: 'Primark',
      is_essential: false,
      is_recurring: false,
    };
  }

  // Moradia / Ferramentas / Reforma
  if (desc.includes('BIGMAT') || desc.includes('FERRETERIA')) {
    let merchant = 'Ferreteria';
    if (desc.includes('BIGMAT')) merchant = 'BigMat';
    return {
      category: 'Moradia',
      subcategory: 'Manutenção e Reforma',
      merchant_name: merchant,
      is_essential: false,
      is_recurring: false,
    };
  }

  // Telefonia / Celular
  if (desc.includes('MOVISTAR')) {
    return {
      category: 'Tecnologia',
      subcategory: 'Telefone/Celular',
      merchant_name: 'Movistar',
      is_essential: true,
      is_recurring: false,
    };
  }

  // Saúde / Farmácia
  if (desc.includes('FCIA') || desc.includes('FARMACIA')) {
    return {
      category: 'Saúde',
      subcategory: 'Farmácia',
      merchant_name: 'Farmácia',
      is_essential: true,
      is_recurring: false,
    };
  }

  // Estanco (tabaco/general)
  if (desc.includes('ESTANCO')) {
    return {
      category: 'Outros',
      subcategory: 'Tabacaria',
      merchant_name: 'Estanco',
      is_essential: false,
      is_recurring: false,
    };
  }

  // Default: Transferência pessoal
  const isSelf = desc.includes('LUCAS DE CARVALHO') || desc.includes('LUCAS BARBOSA') || desc.includes('LUCAS HOHER');
  let merchant = description.trim();
  if (isSelf) merchant = 'Lucas de Carvalho';

  if (amount > 0) {
    return {
      category: 'Receita',
      subcategory: 'Transferência Recebida',
      merchant_name: merchant,
      is_essential: false,
      is_recurring: false,
    };
  } else {
    return {
      category: 'Transferências',
      subcategory: 'Transferência Enviada',
      merchant_name: merchant,
      is_essential: false,
      is_recurring: false,
    };
  }
}

async function main() {
  console.log('=== STARTING LOCAL AGENT-DRIVEN CATEGORIZATION ===');

  const santanderId = '74bbe812-690b-49c9-95a0-af95d73cb6b2';
  const wiseId = '02997b1a-03a8-45bd-ab39-32c078d40d38';

  // Query all transactions that need categorization
  const { data: txs, error: fetchErr } = await supabase
    .from('transactions')
    .select('id, pluggy_transaction_id, description, amount')
    .in('account_id', [santanderId, wiseId])
    .or('category.is.null,category.eq.Outros,category.eq.Geral');

  if (fetchErr) {
    console.error('Error fetching transactions:', fetchErr);
    return;
  }

  console.log(`Found ${txs?.length} transactions that need categorization.`);

  if (!txs || txs.length === 0) {
    console.log('No transactions to categorize.');
    return;
  }

  let updatedCount = 0;
  for (const tx of txs) {
    const info = getCategoryInfo(tx.description, Number(tx.amount));
    
    const { error: updateErr } = await supabase
      .from('transactions')
      .update({
        category: info.category,
        subcategory: info.subcategory,
        merchant_name: info.merchant_name,
        is_essential: info.is_essential,
        is_recurring: info.is_recurring,
        ai_confidence: 1.0,
        ai_notes: 'Categorizado deterministicamente com regras de negócio do agente local para economia de tokens.',
        updated_at: new Date().toISOString(),
      })
      .eq('id', tx.id);

    if (updateErr) {
      console.error(`Error updating transaction ${tx.pluggy_transaction_id}:`, updateErr);
    } else {
      updatedCount++;
    }
  }

  console.log(`Successfully categorized ${updatedCount} transactions.`);
  console.log('=== LOCAL CATEGORIZATION FINISHED ===');
}

void main();
