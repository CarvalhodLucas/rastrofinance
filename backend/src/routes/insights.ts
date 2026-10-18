import { Router } from 'express';
import {
  getInsights,
  getLatestInsightByType,
} from '../services/supabaseService.js';
import { runGenerateInsights } from '../jobs/generateInsights.js';
import { runMonthlyReport } from '../jobs/monthlyReport.js';
import type { InsightType } from '../types.js';
import type { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { isLucasUser } from '../services/userScopeService.js';

export const insightsRouter = Router();

/** GET /api/insights?type=DAILY_SUMMARY */
insightsRouter.get('/', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!isLucasUser(user)) {
      res.json({ insights: [] });
      return;
    }
    const type = req.query.type as InsightType | undefined;
    const insights = await getInsights(type);
    res.json({ insights });
  } catch (err) {
    console.error('[insights] list:', err);
    res.status(500).json({ error: 'Falha ao listar insights.' });
  }
});

/** GET /api/insights/latest — insight mais recente de cada tipo. */
insightsRouter.get('/latest', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!isLucasUser(user)) {
      res.json({ insights: [] });
      return;
    }
    const insights = await getLatestInsightByType();
    res.json({ insights });
  } catch (err) {
    console.error('[insights] latest:', err);
    res.status(500).json({ error: 'Falha ao buscar insights recentes.' });
  }
});

/**
 * POST /api/insights/generate — força geração.
 * Body: { type: 'DAILY' | 'MONTHLY' }
 */
insightsRouter.post('/generate', async (req, res) => {
  const type = (req.body as { type?: string }).type ?? 'DAILY';
  try {
    if (type === 'MONTHLY') {
      await runMonthlyReport();
    } else {
      await runGenerateInsights();
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[insights] generate:', err);
    res.status(500).json({ error: 'Falha ao gerar o insight.' });
  }
});
