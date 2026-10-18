import { Router } from 'express';
import {
  interpretCommand,
  getViewData,
  generateSheetInsight,
  getProactiveSuggestions,
} from '../services/smartsheetService.js';
import { sendText } from '../services/whatsappService.js';
import { sendTelegram } from '../services/telegramService.js';

export const smartsheetRouter = Router();

/** POST /api/smartsheet/command — interpreta comando livre via IA */
smartsheetRouter.post('/command', async (req, res) => {
  const { command, period } = req.body as { command?: string; period?: string };
  if (!command) {
    res.status(400).json({ error: 'command é obrigatório.' });
    return;
  }
  try {
    const result = await interpretCommand(command, period ?? 'current_month');
    res.json(result);
  } catch (err) {
    console.error('[smartsheet] command:', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Falha ao interpretar o comando.' });
  }
});

/** GET /api/smartsheet/view/:viewName?period=current_month&category= */
smartsheetRouter.get('/view/:viewName', async (req, res) => {
  const { viewName } = req.params;
  const { period = 'current_month', category } = req.query as Record<string, string>;
  try {
    const result = await getViewData(viewName, period, category);
    res.json(result);
  } catch (err) {
    console.error('[smartsheet] view:', err);
    res.status(500).json({ error: 'Falha ao carregar a view.' });
  }
});

/** POST /api/smartsheet/insight — gera análise aprofundada via IA */
smartsheetRouter.post('/insight', async (req, res) => {
  const { viewData, prompt } = req.body as { viewData?: Parameters<typeof generateSheetInsight>[0]; prompt?: string };
  if (!viewData) {
    res.status(400).json({ error: 'viewData é obrigatório.' });
    return;
  }
  try {
    const insight = await generateSheetInsight(viewData, prompt ?? `Analise os dados de ${viewData.title}`);
    res.json({ insight });
  } catch (err) {
    console.error('[smartsheet] insight:', err);
    res.status(500).json({ error: 'Falha ao gerar insight.' });
  }
});

/** GET /api/smartsheet/suggestions */
smartsheetRouter.get('/suggestions', async (_req, res) => {
  try {
    const suggestions = await getProactiveSuggestions();
    res.json({ suggestions });
  } catch (err) {
    console.error('[smartsheet] suggestions:', err);
    res.json({ suggestions: [] });
  }
});

/** POST /api/smartsheet/send-insight — envia insight via WhatsApp e/ou Telegram */
smartsheetRouter.post('/send-insight', async (req, res) => {
  const { text } = req.body as { text?: string };
  if (!text) {
    res.status(400).json({ error: 'text é obrigatório.' });
    return;
  }
  try {
    await Promise.allSettled([
      sendText(text),
      sendTelegram(text),
    ]);
    res.json({ ok: true });
  } catch (err) {
    console.error('[smartsheet] send-insight:', err);
    res.status(500).json({ error: 'Falha ao enviar insight.' });
  }
});
