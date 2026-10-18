import { env } from '../config/env.js';
import { answerFinancialQuestion } from './claudeService.js';
import {
  getActiveGoals,
  getPatterns,
  getRecentTransactions,
  getTransactionsBetween,
} from './supabaseService.js';
import type {
  AiInsight,
  Anomaly,
  FinancialContext,
  WeeklyAnalysis,
} from '../types.js';
import { formatBRL } from '../utils/format.js';

/**
 * Integração com a Evolution API (HTTP REST puro, sem SDK).
 * Endpoint de envio: {EVOLUTION_API_URL}/message/sendText/{instance}
 */

function evolutionUrl(path: string): string {
  return `${env.EVOLUTION_API_URL.replace(/\/$/, '')}${path}`;
}

/** Função 1 — Envia mensagem de texto para o número configurado. */
export async function sendText(message: string): Promise<void> {
  if (!env.WHATSAPP_NUMBER) {
    console.warn('[whatsapp] WHATSAPP_NUMBER não configurado — envio ignorado.');
    return;
  }

  const url = evolutionUrl(`/message/sendText/${env.EVOLUTION_INSTANCE}`);
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.EVOLUTION_API_KEY,
    },
    body: JSON.stringify({
      number: env.WHATSAPP_NUMBER,
      text: message,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Evolution API erro ${res.status}: ${body}`);
  }
}

/** Função 2 — Resumo diário formatado. */
export async function sendDailyReport(insight: AiInsight): Promise<void> {
  await sendText(insight.narrative);
}

/** Função 3 — Análise semanal (quebra em múltiplas mensagens se necessário). */
export async function sendWeeklyAnalysis(
  analysis: WeeklyAnalysis & { title: string },
): Promise<void> {
  const parts: string[] = [];
  parts.push(`📈 *${analysis.title}*\n\n${analysis.narrative}`);

  if (analysis.highlights.length > 0) {
    parts.push(
      `✨ *Destaques*\n${analysis.highlights.map((h) => `• ${h}`).join('\n')}`,
    );
  }
  if (analysis.warnings.length > 0) {
    parts.push(
      `⚠️ *Atenção*\n${analysis.warnings.map((w) => `• ${w}`).join('\n')}`,
    );
  }
  if (analysis.suggestions.length > 0) {
    parts.push(
      `💡 *Sugestões*\n${analysis.suggestions.map((s) => `• ${s}`).join('\n')}`,
    );
  }

  for (const part of parts) {
    await sendText(part);
  }
}

/** Função 4 — Alerta imediato de anomalia (HIGH ou MEDIUM). */
export async function sendAnomalyAlert(anomaly: Anomaly): Promise<void> {
  if (anomaly.severity === 'LOW') return;
  const icon = anomaly.severity === 'HIGH' ? '⚠️' : '⚡';
  const msg =
    `${icon} *Gasto atípico detectado*\n\n` +
    `${anomaly.reason}\n\n` +
    `Valor: ${formatBRL(Math.abs(anomaly.amount))}\n` +
    `Data: ${anomaly.date}\n` +
    `Descrição: ${anomaly.description}`;
  await sendText(msg);
}

/**
 * Função 5 — Recebe pergunta do usuário, monta contexto financeiro real,
 * consulta o Claude e devolve (e envia) a resposta.
 */
export async function handleIncomingMessage(message: string): Promise<string> {
  const context = await buildFinancialContext();
  const answer = await answerFinancialQuestion(message, context);
  await sendText(answer);
  return answer;
}

/** Monta o contexto financeiro usado pelo agente conversacional. */
export async function buildFinancialContext(): Promise<FinancialContext> {
  const now = new Date();
  const monthStart = firstDayOfMonth(now);
  const prevMonthStart = firstDayOfMonth(addMonths(now, -1));
  const prevMonthEnd = lastDayOfMonth(addMonths(now, -1));

  const [currentMonthTx, prevMonthTx, recentTransactions, goals, patterns] =
    await Promise.all([
      getTransactionsBetween(iso(monthStart), iso(now)),
      getTransactionsBetween(iso(prevMonthStart), iso(prevMonthEnd)),
      getRecentTransactions(20),
      getActiveGoals(),
      getPatterns(),
    ]);

  return {
    spentByCategory: aggregateByCategory(currentMonthTx),
    previousMonthByCategory: aggregateByCategory(prevMonthTx),
    recentTransactions,
    goals,
    patterns,
  };
}

// --- Helpers de data e agregação ---

function aggregateByCategory(
  txs: { category: string | null; amount: number }[],
): Array<{ category: string; total: number }> {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (t.amount >= 0) continue; // só despesas
    const cat = t.category ?? 'Outros';
    map.set(cat, (map.get(cat) ?? 0) + Math.abs(t.amount));
  }
  return [...map.entries()]
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

function iso(d: Date): string {
  const part = d.toISOString().split('T')[0];
  return part ?? d.toISOString();
}
function firstDayOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function lastDayOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
