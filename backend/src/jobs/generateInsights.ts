import {
  generateDailyInsight,
  generateWeeklyAnalysis,
} from '../services/claudeService.js';
import {
  getTransactionsBetween,
  insertInsight,
} from '../services/supabaseService.js';
import type { Transaction } from '../types.js';

/**
 * Gera o insight diário (e, às segundas, a análise semanal).
 * Roda às 07:30.
 */
export async function runGenerateInsights(): Promise<void> {
  console.log('[job:insights] iniciando...');
  const now = new Date();

  // --- Resumo diário (dia anterior) ---
  const yesterday = addDays(now, -1);
  const dayStr = iso(yesterday);
  const dayTx = await getTransactionsBetween(dayStr, dayStr);

  const average = await dailyAverage(now);
  const daily = await generateDailyInsight(dayTx, average);
  await insertInsight({
    type: 'DAILY_SUMMARY',
    period_start: dayStr,
    period_end: dayStr,
    title: daily.title,
    narrative: daily.narrative,
    data_snapshot: { total: sumExpenses(dayTx), count: dayTx.length, average },
  });
  console.log('[job:insights] resumo diário gerado.');

  // --- Análise semanal (somente segundas-feiras) ---
  if (now.getDay() === 1) {
    const weekStart = addDays(now, -7);
    const weekTx = await getTransactionsBetween(iso(weekStart), iso(now));
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthTx = await getTransactionsBetween(iso(monthStart), iso(now));

    const weekly = await generateWeeklyAnalysis(weekTx, {
      totalSpentMonth: sumExpenses(monthTx),
      byCategory: byCategory(monthTx),
    });
    await insertInsight({
      type: 'WEEKLY_ANALYSIS',
      period_start: iso(weekStart),
      period_end: iso(now),
      title: weekly.title,
      narrative: weekly.narrative,
      data_snapshot: {
        highlights: weekly.highlights,
        warnings: weekly.warnings,
        suggestions: weekly.suggestions,
      },
    });
    console.log('[job:insights] análise semanal gerada.');
  }
}

// --- Helpers ---

async function dailyAverage(now: Date): Promise<number> {
  // Média de gastos diários nos últimos 30 dias.
  const start = addDays(now, -30);
  const txs = await getTransactionsBetween(iso(start), iso(now));
  const total = sumExpenses(txs);
  return total / 30;
}

function sumExpenses(txs: Transaction[]): number {
  return txs
    .filter((t) => t.amount < 0)
    .reduce((acc, t) => acc + Math.abs(t.amount), 0);
}

function byCategory(txs: Transaction[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const t of txs) {
    if (t.amount >= 0) continue;
    const cat = t.category ?? 'Outros';
    map[cat] = (map[cat] ?? 0) + Math.abs(t.amount);
  }
  return map;
}

function iso(d: Date): string {
  const part = d.toISOString().split('T')[0];
  return part ?? d.toISOString();
}
function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() + n);
  return copy;
}
