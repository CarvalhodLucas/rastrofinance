import { supabase, insertManualTransaction } from '../services/supabaseService.js';
import type { Transaction } from '../types.js';

/**
 * Processa todas as assinaturas recorrentes (is_recurring = true).
 * Garante que cada assinatura gere o lançamento mensal automático no dia do vencimento.
 */
export async function runProcessRecurringSubscriptions(): Promise<{ generated: number }> {
  console.log('[recurringJob] Verificando assinaturas e recorrências mensais...');

  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const currentDay = today.getDate();

  // Buscar todas as transações marcadas como recorrentes
  const { data: recurringTxs, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('is_recurring', true);

  if (error || !recurringTxs) {
    console.error('[recurringJob] Erro ao buscar assinaturas:', error);
    return { generated: 0 };
  }

  let generatedCount = 0;

  for (const parentTx of recurringTxs as Transaction[]) {
    const parentDate = new Date(parentTx.date);
    const parentDay = parentDate.getDate();

    // Se hoje é ou já passou o dia do vencimento no mês atual
    if (currentDay >= parentDay) {
      const targetDateStr = `${currentMonthStr}-${String(parentDay).padStart(2, '0')}`;

      // Verificar se já existe lançamento neste mês para esta assinatura
      const { data: existing } = await supabase
        .from('transactions')
        .select('id')
        .eq('description', parentTx.description)
        .gte('date', `${currentMonthStr}-01`)
        .lte('date', `${currentMonthStr}-31`);

      if (!existing || existing.length <= 1) {
        // Se a transação pai foi criada em outro mês e ainda não há cópia no mês atual
        if (!parentTx.date.startsWith(currentMonthStr)) {
          console.log(`[recurringJob] Agendando renovação automática: ${parentTx.description} (${targetDateStr})`);
          await insertManualTransaction({
            pluggy_transaction_id: `rec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            account_id: parentTx.account_id,
            date: targetDateStr,
            amount: parentTx.amount,
            description: parentTx.description,
            transaction_type: parentTx.transaction_type,
            category: parentTx.category,
            is_recurring: true,
            original_currency: parentTx.original_currency,
            original_amount: parentTx.original_amount,
            exchange_rate: parentTx.exchange_rate,
          });
          generatedCount++;
        }
      }
    }
  }

  console.log(`[recurringJob] Concluído: ${generatedCount} assinaturas renovadas este mês.`);
  return { generated: generatedCount };
}
