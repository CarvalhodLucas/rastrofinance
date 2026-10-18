import { supabase } from '../services/supabaseService.js';
import OpenAI from 'openai';
import { env } from '../config/env.js';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: env.OPENROUTER_API_KEY,
  defaultHeaders: { 'X-Title': 'Rastro Finance' },
});

async function main() {
  const { data: txs } = await supabase
    .from('transactions')
    .select('*')
    .limit(15);

  if (!txs || txs.length === 0) {
    console.log('No transactions found.');
    return;
  }

  const payload = txs.map((t) => ({
    pluggy_transaction_id: t.pluggy_transaction_id,
    date: t.date,
    amount: t.amount,
    description: t.description,
    raw_description: t.raw_description,
    transaction_type: t.transaction_type,
  }));

  const system = `
Você é um assistente financeiro especializado em analisar transações bancárias brasileiras.
Sua função é categorizar cada transação com precisão, identificando padrões de consumo.

Categorias disponíveis (use exatamente estes nomes):
- Alimentação (supermercado, padaria, açougue)
- Restaurantes e Delivery (ifood, rappi, restaurantes)
- Transporte (uber, combustível, estacionamento, ônibus)
- Moradia (aluguel, condomínio, água, luz, gás, internet)
- Saúde (farmácia, médico, academia, plano de saúde)
- Lazer e Entretenimento (cinema, shows, assinaturas streaming)
- Vestuário (roupas, calçados, acessórios)
- Tecnologia (eletrônicos, software, assinaturas tech)
- Educação (cursos, livros, plataformas de ensino)
- Viagem (hotéis, passagens, turismo)
- Serviços Financeiros (tarifas, juros, IOF)
- Transferências (PIX enviado, TED)
- Receita (salário, freelance, dividendos, renda)
- Outros (não se encaixa em nenhuma categoria acima)

Para cada transação, retorne JSON com:
{
  "pluggy_transaction_id": "id original",
  "category": "categoria exata da lista",
  "subcategory": "subcategoria mais específica",
  "is_essential": true/false,
  "is_recurring": true/false,
  "merchant_name": "nome limpo do estabelecimento",
  "ai_confidence": 0.0 a 1.0,
  "ai_notes": "observação relevante se houver"
}

Retorne APENAS um array JSON válido, sem texto adicional.
  `.trim();

  try {
    console.log('Calling OpenRouter with model:', env.OPENROUTER_MODEL);
    const res = await openai.chat.completions.create({
      model: env.OPENROUTER_MODEL,
      max_tokens: 4000,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `Categorize estas transações:\n\n${JSON.stringify(payload, null, 2)}` },
      ],
    });
    const raw = res.choices[0]?.message?.content ?? '';
    console.log('--- RAW RESPONSE ---');
    console.log(raw);
    console.log('--- END RAW RESPONSE ---');
  } catch (error) {
    console.error('API call failed:', error);
  }
}

void main();
