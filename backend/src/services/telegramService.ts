import { env } from '../config/env.js';
import { getSetting } from './supabaseService.js';
import type { AiInsight } from '../types.js';

/** Resolve token e chatId: DB settings têm prioridade sobre .env. */
async function getConfig(): Promise<{ token: string; chatId: string } | null> {
  const [enabled, dbToken, dbChatId] = await Promise.all([
    getSetting<boolean>('telegram_enabled'),
    getSetting<string>('telegram_bot_token'),
    getSetting<string>('telegram_chat_id'),
  ]);

  if (enabled === false) return null;

  const token = dbToken || env.TELEGRAM_BOT_TOKEN;
  const chatId = dbChatId || env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) return null;
  return { token, chatId };
}

/** Envia uma mensagem de texto para o chat configurado. No-op se não configurado. */
export async function sendTelegram(text: string): Promise<void> {
  const cfg = await getConfig();
  if (!cfg) return;

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${cfg.token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: cfg.chatId,
          text,
          parse_mode: 'HTML',
        }),
      },
    );
    if (!res.ok) {
      const body = (await res.json()) as { description?: string };
      console.warn('[telegram] erro ao enviar:', body.description ?? res.status);
    }
  } catch (err) {
    console.warn('[telegram] falha na requisição:', err);
  }
}

export async function sendDailyReportTelegram(insight: AiInsight): Promise<void> {
  await sendTelegram(`📊 <b>${insight.title}</b>\n\n${insight.narrative}`);
}

export async function sendMonthlyReportTelegram(insight: AiInsight): Promise<void> {
  const full = `📈 <b>${insight.title}</b>\n\n${insight.narrative}`;
  await sendTelegram(full.length > 4000 ? full.slice(0, 4000) + '…' : full);
}

export async function sendAnomalyAlertTelegram(
  description: string,
  amount: number,
  reason: string,
  severity: 'LOW' | 'MEDIUM' | 'HIGH',
): Promise<void> {
  if (severity === 'LOW') return;
  const emoji = severity === 'HIGH' ? '🚨' : '⚠️';
  await sendTelegram(
    `${emoji} <b>Gasto atípico detectado</b>\n` +
      `<b>${description}</b> — R$ ${amount.toFixed(2)}\n` +
      reason,
  );
}
