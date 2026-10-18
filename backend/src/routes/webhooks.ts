import { Router } from 'express';
import { env } from '../config/env.js';
import { runSync } from '../jobs/syncTransactions.js';
import { handleIncomingMessage } from '../services/whatsappService.js';

export const webhooksRouter = Router();

/**
 * POST /api/webhooks/pluggy — Pluggy notifica sobre novos dados.
 * Dispara um sync em background.
 */
webhooksRouter.post('/pluggy', (req, res) => {
  console.log('[webhook:pluggy] evento recebido:', req.body?.event ?? 'desconhecido');
  // Responde rápido; processa async.
  res.json({ received: true });
  runSync(true).catch((err) => console.error('[webhook:pluggy] sync:', err));
});

/**
 * POST /api/webhooks/whatsapp — mensagem recebida via Evolution API.
 * Valida o número, monta contexto financeiro e responde via Claude.
 */
webhooksRouter.post('/whatsapp', async (req, res) => {
  try {
    const body = req.body as EvolutionWebhook;
    res.json({ received: true }); // ACK imediato

    // Ignora mensagens enviadas pelo próprio bot.
    if (body?.data?.key?.fromMe) return;

    const remoteJid = body?.data?.key?.remoteJid ?? '';
    const senderNumber = remoteJid.split('@')[0] ?? '';

    // Valida que veio do número autorizado.
    if (
      env.WHATSAPP_NUMBER &&
      !senderNumber.includes(env.WHATSAPP_NUMBER.replace(/\D/g, ''))
    ) {
      console.log('[webhook:whatsapp] número não autorizado:', senderNumber);
      return;
    }

    const text = extractText(body);
    if (!text) return;

    console.log('[webhook:whatsapp] pergunta:', text);
    await handleIncomingMessage(text);
  } catch (err) {
    console.error('[webhook:whatsapp]:', err);
  }
});

interface EvolutionWebhook {
  data?: {
    key?: { remoteJid?: string; fromMe?: boolean };
    message?: {
      conversation?: string;
      extendedTextMessage?: { text?: string };
    };
  };
}

function extractText(body: EvolutionWebhook): string {
  return (
    body?.data?.message?.conversation ??
    body?.data?.message?.extendedTextMessage?.text ??
    ''
  ).trim();
}
