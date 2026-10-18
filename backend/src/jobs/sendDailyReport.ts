import {
  getSetting,
  getUnsentInsight,
  markInsightSent,
} from '../services/supabaseService.js';
import { sendDailyReport } from '../services/whatsappService.js';
import { sendDailyReportTelegram } from '../services/telegramService.js';

/**
 * Envia o último resumo diário ainda não enviado (roda às 08:00).
 * Envia via WhatsApp (se habilitado) e/ou Telegram (se configurado).
 */
export async function runSendDailyReport(): Promise<void> {
  const insight = await getUnsentInsight('DAILY_SUMMARY');
  if (!insight) {
    console.log('[job:daily-report] nenhum resumo diário pendente.');
    return;
  }

  const whatsappEnabled = await getSetting<boolean>('whatsapp_enabled');
  if (whatsappEnabled !== false) {
    await sendDailyReport(insight).catch((e) =>
      console.warn('[job:daily-report] WhatsApp falhou:', e),
    );
  }

  await sendDailyReportTelegram(insight).catch((e) =>
    console.warn('[job:daily-report] Telegram falhou:', e),
  );

  await markInsightSent(insight.id);
  console.log('[job:daily-report] resumo diário enviado.');
}
