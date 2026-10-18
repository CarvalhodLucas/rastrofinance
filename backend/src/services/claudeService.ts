import OpenAI from 'openai';
import { env } from '../config/env.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import XLSX from 'xlsx';
import type {
  Anomaly,
  CategorizationResult,
  FinancialContext,
  FinancialGoal,
  MonthlyReport,
  SpendingPattern,
  Transaction,
  WeeklyAnalysis,
} from '../types.js';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: env.OPENROUTER_API_KEY,
  defaultHeaders: { 'X-Title': 'Rastro Finance' },
});

/** Chama o modelo via OpenRouter e retorna o texto da resposta. */
async function complete(
  system: string,
  user: string,
  maxTokens = 1000,
): Promise<string> {
  const res = await openai.chat.completions.create({
    model: env.OPENROUTER_MODEL,
    max_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  });
  return res.choices[0]?.message?.content ?? '';
}

/** Tenta extrair JSON (objeto ou array) de uma resposta, tolerando ruído. */
function parseJson<T>(raw: string): T {
  const trimmed = raw.trim();
  const cleaned = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const match = cleaned.match(/[[{][\s\S]*[\]}]/);
    if (match) return JSON.parse(match[0]) as T;
    throw new Error(`Resposta da IA não é JSON válido: ${raw.slice(0, 200)}`);
  }
}

// =====================================================================
// Função 1 — Categorização de transações
// =====================================================================

const CATEGORIZATION_SYSTEM = `
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

const BATCH_SIZE = 50;

export async function categorizeTransactions(
  transactions: Transaction[],
): Promise<CategorizationResult[]> {
  const results: CategorizationResult[] = [];

  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE);
    const payload = batch.map((t) => ({
      pluggy_transaction_id: t.pluggy_transaction_id,
      date: t.date,
      amount: t.amount,
      description: t.description,
      raw_description: t.raw_description,
      transaction_type: t.transaction_type,
    }));

    const text = await complete(
      CATEGORIZATION_SYSTEM,
      `Categorize estas transações:\n\n${JSON.stringify(payload, null, 2)}`,
      4000,
    );

    const parsed = parseJson<CategorizationResult[]>(text);
    results.push(...parsed);
  }

  return results;
}

// =====================================================================
// Função 2 — Resumo diário (texto curto para WhatsApp, <= 300 caracteres)
// =====================================================================

export async function generateDailyInsight(
  transactions: Transaction[],
  previousAverage: number,
): Promise<{ title: string; narrative: string }> {
  const totalSpent = sumExpenses(transactions);
  const biggest = biggestExpense(transactions);

  const system = `
Você é um assistente financeiro pessoal brasileiro, direto e motivador.
Gere um resumo diário curto (MÁXIMO 300 caracteres) em português, com 1 a 2 emojis.
Compare o gasto do dia com a média histórica e dê um tom encorajador e honesto.
Exemplo de estilo: "📊 Hoje você gastou R$127,50. Maior gasto: iFood (R$45). Você está 15% abaixo da sua média diária. Bom ritmo! 💪"
Responda APENAS com o texto da mensagem, sem aspas e sem rótulos.
`.trim();

  const narrative = await complete(
    system,
    `Dados do dia:\n${JSON.stringify({
      total_gasto_hoje: totalSpent,
      maior_gasto: biggest,
      media_diaria_historica: previousAverage,
      quantidade_transacoes: transactions.length,
    })}`,
    300,
  );

  return { title: 'Resumo diário', narrative: narrative.trim() };
}

// =====================================================================
// Função 3 — Análise semanal profunda
// =====================================================================

export async function generateWeeklyAnalysis(
  weekTransactions: Transaction[],
  monthContext: { totalSpentMonth: number; byCategory: Record<string, number> },
): Promise<WeeklyAnalysis & { title: string }> {
  const system = `
Você é um analista financeiro pessoal brasileiro. Analise a semana do usuário com profundidade.
Considere: maiores gastos, categoria que mais cresceu, comparação com a semana anterior,
padrões identificados e recomendações práticas.
Responda APENAS com um JSON válido no formato:
{
  "title": "título curto e chamativo",
  "narrative": "texto longo em português com a análise completa (3-5 parágrafos)",
  "highlights": ["ponto importante 1", "ponto importante 2"],
  "warnings": ["alerta se houver"],
  "suggestions": ["sugestão financeira personalizada"]
}
`.trim();

  const text = await complete(
    system,
    `Analise:\n${JSON.stringify(
      { transacoes_semana: weekTransactions.map(slimTx), contexto_mes: monthContext },
      null,
      2,
    )}`,
    2000,
  );

  return parseJson<WeeklyAnalysis & { title: string }>(text);
}

// =====================================================================
// Função 4 — Relatório mensal completo
// =====================================================================

export async function generateMonthlyReport(
  allMonthTransactions: Transaction[],
  goals: FinancialGoal[],
): Promise<MonthlyReport & { title: string }> {
  const system = `
Você é um analista financeiro pessoal brasileiro. Gere o relatório mensal mais elaborado possível.
Analise: total gasto, total recebido, saldo do mês, breakdown por categoria,
metas cumpridas vs não cumpridas, top 5 maiores gastos, assinaturas identificadas,
comparação com o mês anterior e projeção para o próximo mês.
A narrativa deve ter cerca de 500 palavras, em português, tom profissional e acessível.
Responda APENAS com um JSON válido no formato:
{
  "title": "título do relatório mensal",
  "narrative": "narrativa longa (~500 palavras) em português",
  "total_spent": number,
  "total_received": number,
  "balance": number,
  "top_expenses": [{ "description": "...", "amount": number, "category": "..." }],
  "by_category": [{ "category": "...", "total": number }]
}
`.trim();

  const text = await complete(
    system,
    `Gere o relatório:\n${JSON.stringify(
      { transacoes_mes: allMonthTransactions.map(slimTx), metas: goals },
      null,
      2,
    )}`,
    3000,
  );

  return parseJson<MonthlyReport & { title: string }>(text);
}

// =====================================================================
// Função 5 — Detecção de anomalias
// =====================================================================

export async function detectAnomalies(
  recentTransactions: Transaction[],
  userPatterns: SpendingPattern[],
): Promise<Anomaly[]> {
  if (recentTransactions.length === 0) return [];

  const system = `
Você é um sistema de detecção de fraudes e gastos atípicos para finanças pessoais brasileiras.
Compare as transações recentes com os padrões históricos do usuário.
Detecte: gasto muito acima da média na categoria; novo estabelecimento nunca visto antes com valor alto;
múltiplas transações pequenas suspeitas (teste de cartão); compra em horário incomum.
Classifique cada anomalia com severity 'LOW', 'MEDIUM' ou 'HIGH'.
Seja conservador: marque como anomalia APENAS o que realmente foge do padrão.
Responda APENAS com um array JSON (pode ser vazio []) no formato:
[{ "pluggy_transaction_id": "...", "severity": "LOW|MEDIUM|HIGH", "reason": "explicação em português", "amount": number, "date": "YYYY-MM-DD", "description": "..." }]
`.trim();

  const text = await complete(
    system,
    `Analise:\n${JSON.stringify(
      { transacoes_recentes: recentTransactions.map(slimTx), padroes_historicos: userPatterns },
      null,
      2,
    )}`,
    2000,
  );

  return parseJson<Anomaly[]>(text);
}

// =====================================================================
// Função 6 — Pergunta livre sobre finanças (agente conversacional)
// =====================================================================

export async function answerFinancialQuestion(
  question: string,
  context: FinancialContext,
): Promise<string> {
  const system = `
Você é o assistente financeiro pessoal do Rastro Finance, conversando pelo WhatsApp.
Responda em português brasileiro, de forma clara e objetiva (MÁXIMO 3 parágrafos).
Use SOMENTE os dados reais fornecidos no contexto. Se faltar dado para responder com precisão, diga isso.
Use valores em reais formatados (R$). Seja prático e amigável, sem floreios.
`.trim();

  const text = await complete(
    system,
    `Contexto financeiro:\n${JSON.stringify(
      {
        pergunta: question,
        gastos_por_categoria_mes_atual: context.spentByCategory,
        gastos_por_categoria_mes_anterior: context.previousMonthByCategory,
        ultimas_transacoes: context.recentTransactions.map(slimTx),
        metas_ativas: context.goals,
        padroes: context.patterns,
      },
      null,
      2,
    )}\n\nPergunta: ${question}`,
    800,
  );

  return text.trim();
}

// --- Helpers ---

function slimTx(t: Transaction) {
  return {
    id: t.pluggy_transaction_id,
    date: t.date,
    amount: t.amount,
    description: t.description,
    category: t.category,
    merchant: t.merchant_name,
    type: t.transaction_type,
  };
}

function sumExpenses(transactions: Transaction[]): number {
  return transactions
    .filter((t) => t.amount < 0)
    .reduce((acc, t) => acc + Math.abs(t.amount), 0);
}

function biggestExpense(
  transactions: Transaction[],
): { description: string; amount: number } | null {
  const expenses = transactions.filter((t) => t.amount < 0);
  if (expenses.length === 0) return null;
  const biggest = expenses.reduce((max, t) =>
    Math.abs(t.amount) > Math.abs(max.amount) ? t : max,
  );
  return { description: biggest.description, amount: Math.abs(biggest.amount) };
}

// =====================================================================
// Função 6 — Leitura de Comprovantes/Fotos via IA (Visão Multimodal)
// =====================================================================

export interface ScannedReceiptResult {
  amount?: number;
  currency?: 'BRL' | 'USD' | 'EUR' | 'CLP';
  date?: string;
  description?: string;
  merchant_name?: string;
  category?: string;
  transaction_type?: 'DEBIT' | 'CREDIT' | 'PIX' | 'BOLETO' | 'TED';
  is_expense?: boolean;
  notes?: string;
}

export async function scanReceiptImage(
  base64Data: string,
  mimeType = 'image/jpeg',
): Promise<ScannedReceiptResult> {
  const visionModel = env.OPENROUTER_VISION_MODEL || env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001';

  const dataUrl = base64Data.startsWith('data:')
    ? base64Data
    : `data:${mimeType};base64,${base64Data}`;

  const prompt = `Você é um assistente financeiro especialista em OCR e leitura de comprovantes, cupons fiscais, faturas e extratos bancários.
Analise a imagem enviada com muita atenção e extraia as informações estruturadas da transação.

Categorias disponíveis:
- Alimentação (supermercados, feiras, padarias)
- Restaurantes e Delivery (restaurantes, lanchonetes, iFood, bares)
- Transporte (combustível, Uber, 99, estacionamento, pedágio, passagens)
- Moradia (aluguel, condomínio, luz, água, gás, internet)
- Saúde (farmácia, consultas, exames, plano de saúde)
- Lazer e Entretenimento (cinema, jogos, streaming, shows)
- Vestuário (roupas, calçados, acessórios)
- Tecnologia (softwares, eletrônicos, assinaturas)
- Educação (cursos, livros, faculdade)
- Viagem (hospedagem, passagens aéreas, passeios)
- Serviços Financeiros (tarifas, taxas, investimentos)
- Transferências (TED, DOC, PIX entre contas)
- Receita (salário, rendimentos, vendas, entradas)
- Outros

Regras de extração:
1. "amount": número positivo com o valor total final pago/recebido (ex: 149.90).
2. "currency": detecte a moeda (BRL se tiver R$ ou for Brasil, USD se $, EUR se €, CLP se pesos chilenos ou Chile). Padrão: "BRL".
3. "date": data da transação no formato ISO "YYYY-MM-DD" (se o ano não estiver legível, use o ano corrente).
4. "description": nome claro e legível da compra (ex: "Jantar Restaurante Italiano", "Abastecimento Posto Ipiranga", "Compras Supermercado Extra").
5. "merchant_name": nome do estabelecimento comercial ou beneficiário.
6. "category": a categoria mais precisa da lista acima.
7. "transaction_type": um dos valores: "DEBIT", "CREDIT", "PIX", "BOLETO" ou "TED".
8. "is_expense": true para compras/pagamentos/saídas, false para depósitos/recebimentos/entradas.
9. "notes": observações complementares (ex: principais itens comprados).

Responda APENAS um JSON válido e estrito com o formato:
{
  "amount": number,
  "currency": "BRL" | "USD" | "EUR" | "CLP",
  "date": "YYYY-MM-DD",
  "description": string,
  "merchant_name": string,
  "category": string,
  "transaction_type": "DEBIT" | "CREDIT" | "PIX" | "BOLETO" | "TED",
  "is_expense": boolean,
  "notes": string
}`;

  const res = await openai.chat.completions.create({
    model: visionModel,
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: dataUrl,
            },
          },
        ],
      },
    ],
  });

  const raw = res.choices[0]?.message?.content ?? '';
  return parseJson<ScannedReceiptResult>(raw);
}

// =====================================================================
// Função 7 — Leitura de Extrato Completo / Múltiplas Transações por Imagem
// =====================================================================

export interface ScannedStatementItem {
  amount: number;
  currency?: 'BRL' | 'USD' | 'EUR' | 'CLP';
  date: string;
  description: string;
  merchant_name?: string;
  category?: string;
  transaction_type?: 'DEBIT' | 'CREDIT' | 'PIX' | 'BOLETO' | 'TED';
  is_expense?: boolean;
}

export interface ScannedStatementResult {
  institution?: string;
  currency?: 'BRL' | 'USD' | 'EUR' | 'CLP';
  transactions: ScannedStatementItem[];
}

export async function scanStatementImage(
  base64Data: string,
  mimeType = 'image/jpeg',
): Promise<ScannedStatementResult> {
  const visionModel = env.OPENROUTER_VISION_MODEL || env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001';

  const dataUrl = base64Data.startsWith('data:')
    ? base64Data
    : `data:${mimeType};base64,${base64Data}`;

  const prompt = `Você é um assistente financeiro especialista em OCR e leitura de extratos bancários, faturas de cartão de crédito e telas de aplicativos de bancos (Nubank, Itaú, Bradesco, Inter, Santander, C6, Revolut, etc.).
Analise a imagem enviada com muita atenção e extraia TODAS as transações visíveis na tela.

Categorias disponíveis:
- Alimentação (supermercados, feiras, padarias)
- Restaurantes e Delivery (restaurantes, lanchonetes, iFood, bares)
- Transporte (combustível, Uber, 99, estacionamento, pedágio, passagens)
- Moradia (aluguel, condomínio, luz, água, gás, internet)
- Saúde (farmácia, consultas, exames, plano de saúde)
- Lazer e Entretenimento (cinema, jogos, streaming, shows)
- Vestuário (roupas, calçados, acessórios)
- Tecnologia (softwares, eletrônicos, assinaturas)
- Educação (cursos, livros, faculdade)
- Viagem (hospedagem, passagens aéreas, passeios)
- Serviços Financeiros (tarifas, taxas, investimentos)
- Transferências (TED, DOC, PIX entre contas)
- Receita (salário, rendimentos, vendas, entradas)
- Outros

Para cada transação visível na imagem:
1. "amount": número positivo com o valor total da transação (ex: 35.50).
2. "currency": "BRL", "USD", "EUR" ou "CLP" (padrão BRL se não especificado).
3. "date": data no formato "YYYY-MM-DD" (se tiver apenas dia e mês, use o ano corrente).
4. "description": nome claro e legível da transação/estabelecimento.
5. "merchant_name": nome do comerciante ou estabelecimento.
6. "category": a melhor categoria dentre as listadas acima.
7. "transaction_type": "DEBIT", "CREDIT", "PIX", "BOLETO" ou "TED".
8. "is_expense": true se for saída/gasto/compra, false se for entrada/estorno/recebimento.

Responda APENAS um JSON válido no formato:
{
  "institution": string,
  "currency": "BRL" | "USD" | "EUR" | "CLP",
  "transactions": [
    {
      "amount": number,
      "currency": "BRL" | "USD" | "EUR" | "CLP",
      "date": "YYYY-MM-DD",
      "description": string,
      "merchant_name": string,
      "category": string,
      "transaction_type": "DEBIT" | "CREDIT" | "PIX" | "BOLETO" | "TED",
      "is_expense": boolean
    }
  ]
}`;

  const res = await openai.chat.completions.create({
    model: visionModel,
    max_tokens: 3000,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          {
            type: 'image_url',
            image_url: {
              url: dataUrl,
            },
          },
        ],
      },
    ],
  });

  const raw = res.choices[0]?.message?.content ?? '';
  return parseJson<ScannedStatementResult>(raw);
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  try {
    const data = await pdfParse(buffer);
    return data.text || '';
  } catch (err: any) {
    console.error('[claudeService] Erro ao extrair texto do PDF:', err);
    throw new Error(`Falha ao ler o PDF: ${err.message}`);
  }
}

export async function extractTextFromExcel(buffer: Buffer): Promise<string> {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    let text = '';
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (sheet) {
        text += `--- Planilha: ${sheetName} ---\n`;
        text += XLSX.utils.sheet_to_csv(sheet) + '\n';
      }
    }
    return text;
  } catch (err: any) {
    console.error('[claudeService] Erro ao extrair texto do Excel:', err);
    throw new Error(`Falha ao ler a planilha: ${err.message}`);
  }
}

export async function scanStatementText(text: string): Promise<ScannedStatementResult> {
  const model = env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-001';

  const prompt = `Você é um assistente financeiro especialista em leitura de extratos bancários, faturas de cartão de crédito e extratos em formato de texto bruto.
Analise o texto do extrato fornecido e extraia TODAS as transações válidas.

Categorias disponíveis:
- Alimentação (supermercados, feiras, padarias)
- Restaurantes e Delivery (restaurantes, lanchonetes, iFood, bares)
- Transporte (combustível, Uber, 99, estacionamento, pedágio, passagens)
- Moradia (aluguel, condomínio, luz, água, gás, internet)
- Saúde (farmácia, consultas, exames, plano de saúde)
- Lazer e Entretenimento (cinema, jogos, streaming, shows)
- Vestuário (roupas, calçados, acessórios)
- Tecnologia (softwares, eletrônicos, assinaturas)
- Educação (cursos, livros, faculdade)
- Viagem (hospedagem, passagens aéreas, passeios)
- Serviços Financeiros (tarifas, taxas, investimentos)
- Transferências (TED, DOC, PIX entre contas)
- Receita (salário, rendimentos, vendas, entradas)
- Outros

Para cada transação identificada no texto:
1. "amount": número positivo com o valor total da transação (ex: 35.50).
2. "currency": "BRL", "USD", "EUR" ou "CLP" (padrão BRL se não especificado).
3. "date": data no formato "YYYY-MM-DD" (se o texto tiver apenas dia/mês, use o ano corrente).
4. "description": nome claro e legível do estabelecimento ou descrição do movimento.
5. "merchant_name": nome do comerciante ou estabelecimento.
6. "category": a melhor categoria dentre as listadas acima.
7. "transaction_type": "DEBIT", "CREDIT", "PIX", "BOLETO" ou "TED".
8. "is_expense": true se for saída/gasto/compra, false se for entrada/estorno/recebimento.

Responda APENAS um JSON válido no formato:
{
  "institution": string,
  "currency": "BRL" | "USD" | "EUR" | "CLP",
  "transactions": [
    {
      "amount": number,
      "currency": "BRL" | "USD" | "EUR" | "CLP",
      "date": "YYYY-MM-DD",
      "description": string,
      "merchant_name": string,
      "category": string,
      "transaction_type": "DEBIT" | "CREDIT" | "PIX" | "BOLETO" | "TED",
      "is_expense": boolean
    }
  ]
}

Texto do extrato para analisar:
"""
${text}
"""`;

  const res = await openai.chat.completions.create({
    model: model,
    max_tokens: 3000,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const raw = res.choices[0]?.message?.content ?? '';
  return parseJson<ScannedStatementResult>(raw);
}

export async function scanStatementFile(
  base64Data: string,
  mimeType: string,
): Promise<ScannedStatementResult> {
  const isImage = mimeType.startsWith('image/');
  
  if (isImage) {
    return scanStatementImage(base64Data, mimeType);
  }

  // Se não for imagem, decodifica para buffer
  const buffer = Buffer.from(base64Data.replace(/^data:.*;base64,/, ''), 'base64');
  let text = '';

  if (mimeType === 'application/pdf') {
    text = await extractTextFromPdf(buffer);
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mimeType === 'application/vnd.ms-excel'
  ) {
    text = await extractTextFromExcel(buffer);
  } else if (mimeType === 'text/csv' || mimeType.startsWith('text/')) {
    text = buffer.toString('utf-8');
  } else {
    // Caso padrão, tenta ler como texto
    text = buffer.toString('utf-8');
  }

  if (!text || text.trim().length === 0) {
    throw new Error('Não foi possível extrair texto do arquivo fornecido.');
  }

  return scanStatementText(text);
}
