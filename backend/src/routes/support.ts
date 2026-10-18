import { Router } from 'express';
import { askSupportAssistant, type ChatMessage } from '../services/supportService.js';

export const supportRouter = Router();

/**
 * POST /api/support/chat
 * Envia histórico de mensagens para o modelo DeepSeek V4.1 Flash e retorna resposta de suporte.
 */
supportRouter.post('/chat', async (req, res) => {
  try {
    const { messages, currentPage } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'O array de mensagens (messages) é obrigatório.' });
    }

    const sanitizedMessages: ChatMessage[] = messages
      .filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
      .map((m) => ({
        role: m.role,
        content: m.content.trim(),
      }));

    if (sanitizedMessages.length === 0) {
      return res.status(400).json({ error: 'Nenhuma mensagem de usuário válida enviada.' });
    }

    const result = await askSupportAssistant(sanitizedMessages, currentPage);
    res.json(result);
  } catch (err: any) {
    console.error('[supportRouter] Erro ao processar chat de suporte:', err);
    res.status(500).json({
      error: err.message || 'Erro ao processar mensagem com o assistente de suporte.',
    });
  }
});
