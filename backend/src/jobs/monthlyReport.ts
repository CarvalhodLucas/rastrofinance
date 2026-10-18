import { generateMonthlyReport } from '../services/claudeService.js';
import {
  getActiveGoals,
  getSetting,
  getTransactionsBetween,
  insertInsight,
  markInsightSent,
} from '../services/supabaseService.js';
import { sendText } from '../services/whatsappService.js';
import { formatBRL } from '../utils/format.js';

/**
 * Relatório mensal completo (roda todo dia 1 às 09:00).
 * Analisa o mês ANTERIOR, salva o insight e envia no WhatsApp.
 */
export async function runMonthlyReport(): Promise<void> {
  const now = new Date();
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const [txs, goals] = await Promise.all([
    getTransactionsBetween(iso(prevMonthStart), iso(prevMonthEnd)),
    getActiveGoals(),
  ]);

  if (txs.length === 0) {
    console.log('[job:monthly] sem transações no mês anterior — pulando.');
    return;
  }

  const report = await generateMonthlyReport(txs, goals);

  const insight = await insertInsight({
    type: 'MONTHLY_REPORT',
    period_start: iso(prevMonthStart),
    period_end: iso(prevMonthEnd),
    title: report.title,
    narrative: report.narrative,
    data_snapshot: {
      total_spent: report.total_spent,
      total_received: report.total_received,
      balance: report.balance,
      top_expenses: report.top_expenses,
      by_category: report.by_category,
    },
  });

  const enabled = await getSetting<boolean>('whatsapp_enabled');
  if (enabled !== false) {
    const msg =
      `📅 *${report.title}*\n\n${report.narrative}\n\n` +
      `💸 Gasto: ${formatBRL(report.total_spent)}\n` +
      `💰 Recebido: ${formatBRL(report.total_received)}\n` +
      `📊 Saldo: ${formatBRL(report.balance)}`;
    await sendText(msg);
    await markInsightSent(insight.id);
  }

  console.log('[job:monthly] relatório mensal gerado e enviado.');
}

function iso(d: Date): string {
  const part = d.toISOString().split('T')[0];
  return part ?? d.toISOString();
}
