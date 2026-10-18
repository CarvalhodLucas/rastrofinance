import cron from 'node-cron';
import { env } from '../config/env.js';
import { runSync } from './syncTransactions.js';
import { runGenerateInsights } from './generateInsights.js';
import { runSendDailyReport } from './sendDailyReport.js';
import { runMonthlyReport } from './monthlyReport.js';
import { runSyncBinance } from './runSyncBinance.js';
import { runSyncSantanderAuto } from './syncSantanderAuto.js';
import { runProcessRecurringSubscriptions } from './recurringJob.js';
import { runUpdateQuotesJob } from './updateQuotesJob.js';
import { applyMonthlyYields } from '../services/yieldService.js';

const TZ = env.TIMEZONE;

function safe(name: string, fn: () => Promise<unknown>): () => void {
  return () => {
    fn().catch((err) => console.error(`[scheduler] erro no job ${name}:`, err));
  };
}

/** Registra todos os cron jobs do Rastro Finance. */
export function startScheduler(): void {
  // Sync diário às 06:00
  cron.schedule('0 6 * * *', safe('sync', () => runSync(false)), { timezone: TZ });
  
  // Sync Binance diário às 06:10 (logo após o banco)
  cron.schedule('10 6 * * *', safe('sync-binance', runSyncBinance), { timezone: TZ });

  // Atualização de preços e cotações de 1h em 1h (24 horas por dia, 7 dias por semana)
  cron.schedule('0 * * * *', safe('update-quotes-hourly', runUpdateQuotesJob), { timezone: TZ });

  // Atualização complementar durante o pregão B3 a cada 30 min (segunda a sexta, das 10h às 18h)
  cron.schedule('30 10-18 * * 1-5', safe('update-quotes-market', runUpdateQuotesJob), { timezone: TZ });

  // Sync Santander Enable Banking diário às 06:30
  cron.schedule('30 6 * * *', safe('sync-santander', runSyncSantanderAuto), { timezone: TZ });

  // Renovação automática de assinaturas diária às 07:00
  cron.schedule('0 7 * * *', safe('recurring-subscriptions', runProcessRecurringSubscriptions), { timezone: TZ });

  // Geração de insights às 07:30 (e semanal nas segundas, internamente)
  cron.schedule('30 7 * * *', safe('insights', runGenerateInsights), {
    timezone: TZ,
  });

  // Envio do resumo diário às 08:00
  cron.schedule('0 8 * * *', safe('daily-report', runSendDailyReport), {
    timezone: TZ,
  });

  // Aplicação automática de rendimento mensal (Wise / Caixa / Renda Fixa) todo dia 1 às 06:05
  cron.schedule('5 6 1 * *', safe('monthly-yields-day1', () => applyMonthlyYields()), { timezone: TZ });

  // Verificação diária de segurança para rendimentos do mês às 07:15
  cron.schedule('15 7 * * *', safe('monthly-yields-daily-check', () => applyMonthlyYields()), { timezone: TZ });

  console.log(`[scheduler] jobs agendados (timezone ${TZ}).`);
}
