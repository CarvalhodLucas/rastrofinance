import { Router } from 'express';
import {
  getActiveGoals,
  getAllSettings,
  supabase,
  updateSetting,
} from '../services/supabaseService.js';

export const settingsRouter = Router();

/** GET /api/settings — todas as configurações + metas ativas. */
settingsRouter.get('/', async (_req, res) => {
  try {
    const [settings, goals] = await Promise.all([
      getAllSettings(),
      getActiveGoals(),
    ]);
    res.json({ settings, goals });
  } catch (err) {
    console.error('[settings] get:', err);
    res.status(500).json({ error: 'Falha ao carregar configurações.' });
  }
});

/** PUT /api/settings — atualiza pares chave/valor. Body: { settings: {...} } */
settingsRouter.put('/', async (req, res) => {
  const { settings } = req.body as { settings?: Record<string, unknown> };
  if (!settings) {
    res.status(400).json({ error: 'settings é obrigatório.' });
    return;
  }
  try {
    for (const [key, value] of Object.entries(settings)) {
      await updateSetting(key, value);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('[settings] put:', err);
    res.status(500).json({ error: 'Falha ao salvar configurações.' });
  }
});

/** POST /api/settings/goals — cria uma meta financeira. */
settingsRouter.post('/goals', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('financial_goals')
      .insert(req.body)
      .select()
      .single();
    if (error) throw error;
    res.json({ goal: data });
  } catch (err) {
    console.error('[settings] create goal:', err);
    res.status(500).json({ error: 'Falha ao criar a meta.' });
  }
});

/** DELETE /api/settings/goals/:id — desativa uma meta. */
settingsRouter.delete('/goals/:id', async (req, res) => {
  try {
    const { error } = await supabase
      .from('financial_goals')
      .update({ is_active: false })
      .eq('id', req.params.id);
    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('[settings] delete goal:', err);
    res.status(500).json({ error: 'Falha ao remover a meta.' });
  }
});
