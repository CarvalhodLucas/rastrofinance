import { supabase } from '../services/supabaseService.js';
import {
  getAccountTransactions,
  normalizeTransaction,
  getAccountBalances
} from '../services/enableBankingService.js';
import { categorizeTransactions } from '../services/claudeService.js';
import { sendText } from '../services/whatsappService.js';
import { env } from '../config/env.js';

export async function runSyncSantanderAuto() {
  console.log('[syncSantanderAuto] Iniciando sincronização automática Enable Banking...');

  const { data: accounts, error } = await supabase
    .from('connected_accounts')
    .select('*')
    .eq('provider', 'ENABLE_BANKING')
    .eq('is_active', true);

  if (error || !accounts) {
    console.error('[syncSantanderAuto] Erro ao buscar contas Enable Banking:', error);
    return;
  }

  for (const account of accounts) {
    console.log(`[syncSantanderAuto] Processando conta ${account.id} (${account.account_name})`);

    const expiresAt = account.session_expires_at ? new Date(account.session_expires_at) : new Date(0);
    const now = new Date();
    const daysLeft = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 3600 * 24));

    if (daysLeft < 0) {
      console.log(`[syncSantanderAuto] Sessão expirada para a conta ${account.id}. Pulando.`);
      continue;
    }

    if (daysLeft < 7) {
      await sendText(
        `⚠️ *Aviso do Rastro Finance*\nSua conexão com o Santander (Enable Banking) expira em ${daysLeft} dias. Acesse as Configurações para reautorizar e continuar recebendo dados automaticamente.`
      );
    }

    try {
      if (!account.enable_banking_account_id) {
        console.warn(`[syncSantanderAuto] Conta ${account.id} não possui enable_banking_account_id.`);
        continue;
      }

      const dateTo = new Date().toISOString().split('T')[0] || '';
      const dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] || '';
      
      const rawTransactions = await getAccountTransactions(account.enable_banking_account_id, dateFrom, dateTo);
      const balance = await getAccountBalances(account.enable_banking_account_id);

      await supabase.from('connected_accounts').update({ balance, last_synced_at: new Date().toISOString() }).eq('id', account.id);

      const upserts = rawTransactions.map(tx => normalizeTransaction(tx, account.id));
      
      if (upserts.length > 0) {
        const { data: inserted, error: insertError } = await supabase
          .from('transactions')
          .upsert(upserts, { onConflict: 'pluggy_transaction_id' })
          .select('id, description, merchant_name, amount, category');
          
        if (insertError) {
          console.error(`[syncSantanderAuto] Erro ao inserir transações para conta ${account.id}:`, insertError);
        } else if (inserted) {
          const uncat = inserted.filter((t: any) => !t.category || t.category === 'OUTROS');
          if (uncat.length > 0) {
            await categorizeTransactions(uncat.map((u: any) => ({
              id: u.id,
              description: u.description || '',
              merchant_name: u.merchant_name || '',
              amount: u.amount
            })) as any);
          }
          console.log(`[syncSantanderAuto] Conta ${account.id} sincronizada: ${inserted.length} novas/atualizadas, ${uncat.length} categorizadas.`);
        }
      }
    } catch (e) {
      console.error(`[syncSantanderAuto] Erro na sincronização da conta ${account.id}:`, e);
    }
  }

  console.log('[syncSantanderAuto] Finalizado.');
}
