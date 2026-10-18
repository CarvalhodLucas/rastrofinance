import { Router } from 'express';
import {
  generateConnectToken,
  getAccounts,
  getInstitution,
} from '../services/pluggyService.js';
import {
  deactivateAccount,
  getAllAccounts,
  upsertAccount,
  supabase,
} from '../services/supabaseService.js';
import { runSync } from '../jobs/syncTransactions.js';
import type { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { isLucasUser } from '../services/userScopeService.js';

export const pluggyRouter = Router();

/** GET /api/pluggy/connect-token — token para o widget Pluggy Connect. */
pluggyRouter.get('/connect-token', async (_req, res) => {
  try {
    const accessToken = await generateConnectToken();
    res.json({ accessToken });
  } catch (err) {
    console.error('[pluggy] connect-token:', err);
    res.status(500).json({ error: 'Não foi possível gerar o token de conexão.' });
  }
});

/**
 * POST /api/pluggy/item — salva o item conectado e busca as contas.
 * Body: { itemId: string }
 */
pluggyRouter.post('/item', async (req, res) => {
  const itemId = (req.body as { itemId?: string }).itemId;
  if (!itemId) {
    res.status(400).json({ error: 'itemId é obrigatório.' });
    return;
  }

  try {
    const [institution, accounts] = await Promise.all([
      getInstitution(itemId),
      getAccounts(itemId),
    ]);

    const saved = [];
    for (const acc of accounts) {
      const row = await upsertAccount({
        pluggy_item_id: itemId,
        pluggy_account_id: acc.pluggy_account_id,
        institution_name: institution.name,
        institution_logo: institution.logo,
        account_type: acc.account_type,
        account_name: acc.account_name,
        account_number: acc.account_number,
        balance: acc.balance,
        currency: acc.currency,
        is_active: true,
        last_synced_at: null,
      });
      saved.push(row);
    }

    // Dispara um sync inicial em background (não bloqueia a resposta).
    runSync(true).catch((err) => console.error('[pluggy] sync inicial:', err));

    res.json({ accounts: saved });
  } catch (err) {
    console.error('[pluggy] item:', err);
    res.status(500).json({ error: 'Falha ao salvar a conexão.' });
  }
});

/** POST /api/pluggy/sync — força sync manual de todas as contas. */
pluggyRouter.post('/sync', async (_req, res) => {
  try {
    const result = await runSync(true);
    res.json(result);
  } catch (err) {
    console.error('[pluggy] sync:', err);
    res.json({ synced: 0, categorized: 0, anomalies: 0 });
  }
});

/** GET /api/pluggy/accounts — lista contas conectadas. */
pluggyRouter.get('/accounts', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const accounts = await getAllAccounts(user);
    res.json({ accounts });
  } catch (err) {
    console.error('[pluggy] accounts:', err);
    res.status(500).json({ error: 'Falha ao listar contas.' });
  }
});

/** DELETE /api/pluggy/accounts/:id — desativa uma conta. */
pluggyRouter.delete('/accounts/:id', async (req, res) => {
  try {
    await deactivateAccount(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[pluggy] delete account:', err);
    res.status(500).json({ error: 'Falha ao remover a conta.' });
  }
});

/** POST /api/pluggy/manual-account — cria ou atualiza o saldo de uma conta manual. */
pluggyRouter.post('/manual-account', async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const { id, institutionName, accountName, accountType, balance, currency } = req.body as {
    id?: string;
    institutionName?: string;
    accountName?: string;
    accountType?: string;
    balance?: number;
    currency?: string;
  };

  if (!accountName || balance === undefined || balance === null) {
    res.status(400).json({ error: 'Nome da conta e saldo são obrigatórios.' });
    return;
  }

  try {
    // 1. Tenta atualizar conta existente por UUID 'id' ou 'pluggy_account_id'
    if (id) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const updatePayload: any = {
        account_name: accountName,
        institution_name: institutionName || 'Wise',
        account_type: (accountType as any) || 'CHECKING',
        balance: Number(balance),
        currency: currency || 'BRL',
        last_synced_at: new Date().toISOString(),
      };

      const query = isUuid
        ? supabase.from('connected_accounts').update(updatePayload).or(`id.eq.${id},pluggy_account_id.eq.${id}`)
        : supabase.from('connected_accounts').update(updatePayload).eq('pluggy_account_id', id);

      const { data: updatedById, error: errById } = await query.select();

      if (!errById && updatedById && updatedById.length > 0) {
        res.json({ account: updatedById[0] });
        return;
      }
    }

    // 2. Se for uma nova conta manual
    const pluggyAccountId = id || `manual-acc-${Date.now()}`;
    const pluggyItemId = `manual-item-${pluggyAccountId}`;
    const newAccountData: any = {
      pluggy_item_id: pluggyItemId,
      pluggy_account_id: pluggyAccountId,
      institution_name: institutionName || 'Wise',
      institution_logo: null,
      account_type: (accountType as any) || 'CHECKING',
      account_name: accountName,
      account_number: null,
      balance: Number(balance),
      currency: currency || 'BRL',
      is_active: true,
      last_synced_at: new Date().toISOString(),
    };

    if (!isLucasUser(user) && user) {
      newAccountData.user_id = user.id;
    }

    const row = await upsertAccount(newAccountData);

    res.json({ account: row });
  } catch (err: any) {
    console.error('[pluggy] manual account error:', err);
    res.status(500).json({ error: err?.message || 'Falha ao salvar conta manual.' });
  }
});
