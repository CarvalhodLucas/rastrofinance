import { Router } from 'express';
import { supabase } from '../services/supabaseService.js';
import {
  getAvailableASPSPs,
  startAuthorization,
  completeAuthorization,
  getAccountTransactions,
  normalizeTransaction,
  getAccountBalances
} from '../services/enableBankingService.js';
import { categorizeTransactions } from '../services/claudeService.js';
import { env } from '../config/env.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export const enableBankingRouter = Router();

// GET /api/enablebanking/aspsps
enableBankingRouter.get('/aspsps', async (req, res) => {
  try {
    const aspsps = await getAvailableASPSPs('ES');
    res.json({ aspsps });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/enablebanking/connect
enableBankingRouter.post('/connect', async (req, res) => {
  try {
    let { aspspName } = req.body;
    
    if (env.ENABLE_BANKING_ENV === 'sandbox') {
      console.log('[enableBanking/connect] Ambiente Sandbox: redirecionando para "Mock ASPSP"');
      aspspName = 'Mock ASPSP';
    }

    if (!aspspName) {
      return res.status(400).json({ error: 'aspspName é obrigatório' });
    }

    const state = crypto.randomUUID();
    const authorizationUrl = await startAuthorization(aspspName, 'ES', state);
    
    res.json({ authorizationUrl, state });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/enablebanking/callback
enableBankingRouter.get('/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      console.error('Erro no callback do Enable Banking:', error);
      return res.redirect(`http://localhost:5173/configuracoes/conectar-santander?status=error`);
    }

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ error: 'code inválido ou ausente' });
    }

    const { sessionId, accounts, validUntil } = await completeAuthorization(code);
    
    // Salvar as contas no banco
    for (const acc of accounts) {
      // Upsert na tabela connected_accounts
      const { error: upsertErr } = await supabase.from('connected_accounts').upsert({
        id: crypto.randomUUID(), // ou buscar se já existe pelo enable_banking_account_id
        pluggy_item_id: sessionId, // Reutilizando coluna apenas para manter NOT NULL se houver, ou criando dummy
        pluggy_account_id: acc.account_id, // Dummy
        institution_name: 'Banco Santander',
        account_type: 'CHECKING',
        account_name: `Santander ${acc.currency}`,
        currency: acc.currency,
        balance: 0,
        is_active: true,
        provider: 'ENABLE_BANKING',
        enable_banking_session_id: sessionId,
        enable_banking_account_id: acc.account_id,
        session_expires_at: validUntil
      }, { onConflict: 'pluggy_account_id' });
      
      if (upsertErr) {
        throw new Error(`Erro ao salvar conta conectada no Supabase: ${upsertErr.message}`);
      }
    }

    res.redirect(`http://localhost:5173/configuracoes/conectar-santander?status=success`);
  } catch (err: any) {
    console.error('Erro ao completar autorização:', err);
    try {
      fs.writeFileSync(
        path.resolve(process.cwd(), 'enable_banking_error.json'),
        JSON.stringify({ error: err.message, stack: err.stack }, null, 2)
      );
    } catch (logErr) {
      console.error('Falha ao escrever log de erro:', logErr);
    }
    res.redirect(`http://localhost:5173/configuracoes/conectar-santander?status=error`);
  }
});

// POST /api/enablebanking/sync/:accountId
enableBankingRouter.post('/sync/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    const { data: account, error: accError } = await supabase
      .from('connected_accounts')
      .select('*')
      .eq('id', accountId)
      .single();

    if (accError || !account) {
      return res.status(404).json({ error: 'Conta não encontrada.' });
    }

    if (account.provider !== 'ENABLE_BANKING') {
      return res.status(400).json({ error: 'Conta não é do Enable Banking.' });
    }

    if (account.session_expires_at && new Date(account.session_expires_at) < new Date()) {
      return res.status(403).json({ error: 'Sessão bancária expirada. Reautorização necessária.' });
    }

    if (!account.enable_banking_account_id) {
      return res.status(400).json({ error: 'Conta não possui enable_banking_account_id.' });
    }

    const dateTo = new Date().toISOString().split('T')[0] || '';
    const dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] || '';
    
    const rawTransactions = await getAccountTransactions(account.enable_banking_account_id, dateFrom, dateTo);
    const balance = await getAccountBalances(account.enable_banking_account_id);

    // Atualiza saldo
    await supabase.from('connected_accounts').update({ balance, last_synced_at: new Date().toISOString() }).eq('id', accountId);

    const upserts = rawTransactions.map(tx => normalizeTransaction(tx, accountId));
    
    let newTransactions = 0;
    if (upserts.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('transactions')
        .upsert(upserts, { onConflict: 'pluggy_transaction_id' })
        .select('id, description, merchant_name, amount, category');
        
      if (insertError) {
        console.error('Erro ao inserir transações:', insertError);
      } else if (inserted) {
        newTransactions = inserted.length;
        
        // Categorizar as novas
        const uncat = inserted.filter((t: any) => !t.category || t.category === 'OUTROS');
        if (uncat.length > 0) {
          try {
            await categorizeTransactions(uncat.map((u: any) => ({
              id: u.id,
              description: u.description || '',
              merchant_name: u.merchant_name || '',
              amount: u.amount
            })) as any);
          } catch (e) {
            console.error('Erro na categorização:', e);
          }
        }
      }
    }

    res.json({ newTransactions, lastSync: new Date().toISOString() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/enablebanking/status/:accountId
enableBankingRouter.get('/status/:accountId', async (req, res) => {
  try {
    const { accountId } = req.params;
    
    const { data: account, error: accError } = await supabase
      .from('connected_accounts')
      .select('id, provider, session_expires_at, last_synced_at')
      .eq('id', accountId)
      .single();

    if (accError || !account) {
      return res.status(404).json({ error: 'Conta não encontrada.' });
    }

    if (account.provider !== 'ENABLE_BANKING') {
      return res.status(400).json({ error: 'Conta não é do Enable Banking.' });
    }

    const expiresAt = account.session_expires_at ? new Date(account.session_expires_at) : new Date(0);
    const now = new Date();
    const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 3600 * 24));
    
    let status = 'active';
    if (daysLeft < 0) {
      status = 'expired';
    } else if (daysLeft < 7) {
      status = 'expiring';
    }

    res.json({ status, daysLeft, lastSync: account.last_synced_at });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
