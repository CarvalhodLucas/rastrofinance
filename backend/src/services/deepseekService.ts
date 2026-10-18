import { env } from '../config/env.js';

export interface ParsedTransaction {
  asset_ticker: string;
  asset_name: string | null;
  asset_type: 'ACAO' | 'FII' | 'ETF' | 'BDR' | 'RENDA_FIXA' | 'OUTRO';
  operation_type: 'COMPRA' | 'VENDA' | 'PROVENTO' | 'JCP' | 'DESDOBRAMENTO' | 'BONIFICACAO';
  quantity: number;
  unit_price: number | null;
  total_value: number;
  fees: number;
  broker: string | null;
  operation_date: string;
  confidence: number;
  needs_review: boolean;
  raw_data?: any;
}

export interface DeepSeekResult {
  parsed: ParsedTransaction[];
  needsReview: ParsedTransaction[];
  errors: string[];
}

/**
 * Envia as linhas extraídas do B3 para a API DeepSeek e estrutura as transações.
 */
export async function interpretB3Rows(headers: string[], rows: object[]): Promise<DeepSeekResult> {
  const apiKey = env.OPENROUTER_API_KEY;
  const apiUrl = 'https://openrouter.ai/api/v1/chat/completions';

  if (!apiKey || apiKey === 'xxxx') {
    throw new Error(
      'Chave da API do OpenRouter não configurada. Por favor, adicione uma chave válida em OPENROUTER_API_KEY no arquivo .env.'
    );
  }

  const B3_PARSER_SYSTEM = `
Você é um parser especializado em extratos de negociação da B3 (bolsa brasileira).
Você recebe linhas brutas de um arquivo Excel exportado da Área do Investidor B3
e deve estruturá-las em um formato padronizado.

Para cada linha recebida, identifique e retorne:
{
  "row_index": número (o campo 'index' correspondente à linha enviada no payload do usuário),
  "asset_ticker": "código do ativo, ex: PETR4, HGLG11 (extrair de qualquer coluna que contenha)",
  "asset_name": "nome do ativo se disponível",
  "asset_type": "ACAO" | "FII" | "ETF" | "BDR" | "RENDA_FIXA" | "OUTRO",
  "operation_type": "COMPRA" | "VENDA" | "PROVENTO" | "JCP" | "DESDOBRAMENTO" | "BONIFICACAO",
  "quantity": número decimal,
  "unit_price": número decimal ou null se não aplicável,
  "total_value": número decimal (valor total da operação),
  "fees": número decimal (taxas, corretagem — 0 se não informado),
  "broker": "nome da corretora/instituição se disponível",
  "operation_date": "YYYY-MM-DD",
  "confidence": 0.0 a 1.0 (sua confiança na interpretação desta linha),
  "needs_review": true/false (true se a linha for ambígua ou incompleta)
}

Regras importantes:
- Se a linha for um cabeçalho, rodapé, linha em branco ou totalizador, retorne null para ela.
- Se o tipo de ativo não estiver claro, use padrão de ticker brasileiro:
  4 letras + número terminando em 3,4,5,6 = ação
  4 letras + número terminando em 11 = FII, ETF ou Unit (analise o nome se disponível)
- Datas podem vir em formatos DD/MM/AAAA ou serial do Excel — sempre normalize para YYYY-MM-DD.
- Valores monetários podem vir como string "R$ 1.234,56" — converta para número decimal 1234.56.
- Se não conseguir interpretar uma linha com confiança mínima de 0.5, marque needs_review: true.

Retorne um array JSON com um objeto por linha válida (excluindo nulls).
Retorne APENAS o JSON válido, sem texto explicativo ou markdown (como \`\`\`json).
`;

  const parsed: ParsedTransaction[] = [];
  const needsReview: ParsedTransaction[] = [];
  const errors: string[] = [];

  const batchSize = 30;
  for (let i = 0; i < rows.length; i += batchSize) {
    const batchRows = rows.slice(i, i + batchSize);
    
    // Prepara payload com índices para correlação
    const payloadRows = batchRows.map((row, idx) => ({
      index: i + idx,
      data: row
    }));

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: env.OPENROUTER_MODEL,
          messages: [
            { role: 'system', content: B3_PARSER_SYSTEM },
            { role: 'user', content: `Cabeçalhos:\n${JSON.stringify(headers)}\n\nLinhas:\n${JSON.stringify(payloadRows, null, 2)}` }
          ],
          temperature: 0.1,
          max_tokens: 4000
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro HTTP ${response.status}: ${errorText}`);
      }

      const resJson = await response.json() as any;
      let text = resJson.choices?.[0]?.message?.content?.trim() || '[]';
      
      // Limpa possível formatação de código markdown
      if (text.startsWith('```')) {
        text = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      }

      const batchResult = JSON.parse(text);
      
      if (Array.isArray(batchResult)) {
        for (const item of batchResult) {
          if (!item) continue;

          // Recupera a linha original baseada no row_index retornado
          const originalIndex = Number(item.row_index);
          const originalRow = (originalIndex >= i && originalIndex < i + batchSize) 
            ? batchRows[originalIndex - i] 
            : null;

          const parsedItem: ParsedTransaction = {
            asset_ticker: String(item.asset_ticker || '').trim().toUpperCase(),
            asset_name: item.asset_name ? String(item.asset_name).trim() : null,
            asset_type: item.asset_type || 'ACAO',
            operation_type: item.operation_type || 'COMPRA',
            quantity: Number(item.quantity || 0),
            unit_price: item.unit_price !== null && item.unit_price !== undefined ? Number(item.unit_price) : null,
            total_value: Number(item.total_value || 0),
            fees: Number(item.fees || 0),
            broker: item.broker ? String(item.broker).trim() : null,
            operation_date: item.operation_date || new Date().toISOString().split('T')[0],
            confidence: Number(item.confidence ?? 1.0),
            needs_review: !!item.needs_review || (Number(item.confidence ?? 1.0) < 0.5),
            raw_data: originalRow
          };

          if (parsedItem.needs_review) {
            needsReview.push(parsedItem);
          } else {
            parsed.push(parsedItem);
          }
        }
      } else {
        errors.push(`Formato inválido retornado para o lote ${i}-${i + batchSize}. Esperava-se um array.`);
      }
    } catch (err: any) {
      errors.push(`Erro ao processar lote ${i}-${i + batchSize}: ${err.message}`);
    }
  }

  return { parsed, needsReview, errors };
}
