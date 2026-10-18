import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '../config/env.js';
import type {
  AiInsight,
  ConnectedAccount,
  FinancialGoal,
  InsightType,
  Investment,
  SpendingPattern,
  Transaction,
  TransactionUpsert,
} from '../types.js';
import {
  isLucasUser,
  isRecordOwnedByUser,
  tagSyncSourceWithUser,
  getUserSettingKey,
  cleanSyncSource,
} from './userScopeService.js';
import type { UserSessionPayload } from './authService.js';

/**
 * Cliente Supabase usando a SERVICE KEY (backend confiável, sem RLS de usuário).
 * Projeto single-user: não há autenticação por requisição.
 */
export const supabase: SupabaseClient = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_KEY,
  { auth: { persistSession: false } },
);

// --- Contas conectadas ---

export async function getActiveAccounts(): Promise<ConnectedAccount[]> {
  const { data, error } = await supabase
    .from('connected_accounts')
    .select('*')
    .eq('is_active', true);
  if (error) throw error;
  return (data ?? []) as ConnectedAccount[];
}

export async function ensureCashAccount(user?: UserSessionPayload | null): Promise<ConnectedAccount> {
  const accounts = await getAllAccounts(user);

  const existing = (accounts ?? []).find(
    (a) =>
      a.institution_name.toLowerCase() === 'dinheiro' ||
      a.account_name.toLowerCase().includes('dinheiro'),
  );

  if (existing) {
    return existing as ConnectedAccount;
  }

  const isLucas = isLucasUser(user);
  const pluggyAccId = isLucas || !user ? 'manual_cash_account' : `manual_cash_account_${user.id}`;
  const pluggyItemId = isLucas || !user ? 'manual_item_cash' : `manual_item_cash_${user.id}`;

  const payload: any = {
    pluggy_item_id: pluggyItemId,
    pluggy_account_id: pluggyAccId,
    institution_name: 'Dinheiro',
    institution_logo: null,
    account_type: 'CHECKING',
    account_name: 'Dinheiro em Espécie',
    account_number: null,
    balance: 0,
    currency: 'BRL',
    is_active: true,
    last_synced_at: new Date().toISOString(),
  };

  if (!isLucas && user) {
    payload.user_id = user.id;
  }

  return await upsertAccount(payload);
}

export async function getAllAccounts(user?: UserSessionPayload | null): Promise<ConnectedAccount[]> {
  const { data, error } = await supabase
    .from('connected_accounts')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const allAccounts = (data ?? []) as ConnectedAccount[];

  // Se não for o Lucas, retorna apenas as contas explicitamente associadas a este usuário
  if (!isLucasUser(user)) {
    if (!user?.id) return [];
    return allAccounts.filter(
      (a: any) =>
        a.user_id === user.id ||
        (a.provider && a.provider.startsWith(`USER:${user.id}#`)) ||
        (a.pluggy_item_id && a.pluggy_item_id.startsWith(`USER:${user.id}#`)),
    );
  }

  // Para o Lucas, retorna as contas legadas da plataforma
  const accounts = allAccounts.filter(
    (a: any) =>
      !a.user_id ||
      a.user_id === user?.id ||
      (!a.provider?.startsWith('USER:') && !a.pluggy_item_id?.startsWith('USER:')),
  );

  // Garante que a conta de Dinheiro esteja cadastrada para o Lucas
  const hasCash = accounts.some(
    (a) =>
      a.is_active !== false &&
      (a.institution_name.toLowerCase() === 'dinheiro' ||
        a.account_name.toLowerCase().includes('dinheiro')),
  );
  if (!hasCash) {
    try {
      const cashAcc = await ensureCashAccount();
      accounts.push(cashAcc);
    } catch (e) {
      console.error('Erro ao criar conta de Dinheiro:', e);
    }
  }

  // Sync missing accounts for institutions in investments
  try {
    const { data: investments } = await supabase.from('investments').select('institution, currency');
    if (investments && investments.length > 0) {
      const uniqueInsts = new Map<string, string>();
      for (const inv of investments) {
        if (inv.institution && !uniqueInsts.has(inv.institution)) {
          uniqueInsts.set(inv.institution, inv.currency || 'BRL');
        }
      }

      let createdNew = false;
      for (const [inst, curr] of uniqueInsts.entries()) {
        const hasAcc = accounts.some(
          (a) =>
            a.is_active !== false &&
            (a.institution_name.toLowerCase() === inst.toLowerCase() ||
              a.account_name.toLowerCase().includes(inst.toLowerCase()))
        );

        if (!hasAcc) {
          const pluggyAccountId = `inst-acc-${inst.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
          const pluggyItemId = `manual-inst-${inst.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
          await upsertAccount({
            pluggy_item_id: pluggyItemId,
            pluggy_account_id: pluggyAccountId,
            institution_name: inst,
            institution_logo: null,
            account_type: 'CHECKING',
            account_name: `Saldo ${inst}`,
            account_number: null,
            balance: 0,
            currency: curr,
            is_active: true,
            last_synced_at: new Date().toISOString(),
          });
          createdNew = true;
        }
      }

      if (createdNew) {
        const { data: updatedData } = await supabase
          .from('connected_accounts')
          .select('*')
          .order('created_at', { ascending: false });
        return (updatedData ?? []) as ConnectedAccount[];
      }
    }
  } catch (err) {
    console.error('[supabaseService] error auto-syncing institution accounts:', err);
  }

  return accounts;
}

export async function ensureAccountForInstitution(
  institutionName: string,
  currency: string = 'BRL',
): Promise<ConnectedAccount> {
  const accounts = await getAllAccounts();
  const existing = accounts.find(
    (a) =>
      a.is_active !== false &&
      (a.institution_name.toLowerCase() === institutionName.toLowerCase() ||
        a.account_name.toLowerCase().includes(institutionName.toLowerCase())),
  );

  if (existing) {
    return existing;
  }

  const pluggyAccountId = `inst-acc-${institutionName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  const pluggyItemId = `manual-inst-${institutionName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  return await upsertAccount({
    pluggy_item_id: pluggyItemId,
    pluggy_account_id: pluggyAccountId,
    institution_name: institutionName,
    institution_logo: null,
    account_type: 'CHECKING',
    account_name: `Saldo ${institutionName}`,
    account_number: null,
    balance: 0,
    currency: currency,
    is_active: true,
    last_synced_at: new Date().toISOString(),
  });
}

export async function upsertAccount(
  account: Omit<ConnectedAccount, 'id' | 'created_at'> & { user_id?: string },
): Promise<ConnectedAccount> {
  let { data, error } = await supabase
    .from('connected_accounts')
    .upsert(account, { onConflict: 'pluggy_account_id' })
    .select()
    .single();

  if (error && (account as any).user_id && error.message?.includes('user_id')) {
    const { user_id, ...fallback } = account as any;
    const retry = await supabase
      .from('connected_accounts')
      .upsert(fallback, { onConflict: 'pluggy_account_id' })
      .select()
      .single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw error;
  return data as ConnectedAccount;
}

export async function touchAccountSync(accountId: string): Promise<void> {
  const { error } = await supabase
    .from('connected_accounts')
    .update({ last_synced_at: new Date().toISOString() })
    .eq('id', accountId);
  if (error) throw error;
}

export async function deactivateAccount(accountId: string): Promise<void> {
  const { error } = await supabase
    .from('connected_accounts')
    .update({ is_active: false })
    .eq('id', accountId);
  if (error) throw error;
}

export async function updateAccountBalanceDelta(
  accountId: string | null | undefined,
  delta: number,
  currency = 'BRL',
): Promise<void> {
  if (!accountId || !delta || isNaN(delta)) return;

  const { data: acc, error: fetchErr } = await supabase
    .from('connected_accounts')
    .select('id, balance, currency')
    .eq('id', accountId)
    .single();

  if (fetchErr || !acc) return;

  const accCurr = acc.currency || 'BRL';
  let adjustedDelta = delta;

  if (currency.toUpperCase() !== accCurr.toUpperCase()) {
    const rates: Record<string, number> = { brl: 1.0, usd: 0.18, eur: 0.17, clp: 175.0 };
    const fromKey = currency.toLowerCase();
    const toKey = accCurr.toLowerCase();
    const rFrom = rates[fromKey] ?? 1;
    const rTo = rates[toKey] ?? 1;
    const amtBRL = fromKey === 'brl' ? delta : delta / rFrom;
    adjustedDelta = toKey === 'brl' ? amtBRL : amtBRL * rTo;
  }

  const currentBal = Number(acc.balance || 0);
  const newBalance = Number((currentBal + adjustedDelta).toFixed(2));

  await supabase
    .from('connected_accounts')
    .update({
      balance: newBalance,
      last_synced_at: new Date().toISOString(),
    })
    .eq('id', accountId);
}

// --- Transações ---

export interface ManualTransactionInsert {
  pluggy_transaction_id: string;
  account_id: string | null;
  date: string;
  amount: number;
  description: string;
  transaction_type: string;
  category: string | null;
  is_recurring?: boolean;
  original_currency?: string;
  original_amount?: number;
  exchange_rate?: number;
}

export async function insertManualTransaction(
  row: ManualTransactionInsert,
  user?: UserSessionPayload | null,
): Promise<Transaction> {
  if (!row.account_id || row.account_id === 'cash' || row.account_id === 'cash_fallback') {
    const cashAcc = await ensureCashAccount(user);
    row.account_id = cashAcc.id;
  }

  const payload: any = {
    ...row,
    raw_description: row.description,
    is_recurring: row.is_recurring ?? false,
    is_anomaly: false,
    original_currency: row.original_currency ?? 'BRL',
    original_amount: row.original_amount ?? row.amount,
    exchange_rate: row.exchange_rate ?? 1.0,
    updated_at: new Date().toISOString(),
  };

  if (!isLucasUser(user) && user) {
    payload.user_id = user.id;
  }

  let { data, error } = await supabase
    .from('transactions')
    .insert(payload)
    .select()
    .single();

  if (error && payload.user_id && error.message?.includes('user_id')) {
    delete payload.user_id;
    const retry = await supabase.from('transactions').insert(payload).select().single();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw error;

  const tx = data as Transaction;
  if (tx.account_id) {
    const delta = tx.original_amount ?? tx.amount;
    await updateAccountBalanceDelta(tx.account_id, delta, tx.original_currency || 'BRL');
  }

  return tx;
}

export async function insertManualTransactionsBatch(
  rows: ManualTransactionInsert[],
  user?: UserSessionPayload | null,
): Promise<Transaction[]> {
  if (rows.length === 0) return [];

  let fallbackCashAccId: string | null = null;
  const mapped = await Promise.all(
    rows.map(async (row) => {
      let accId = row.account_id;
      if (!accId || accId === 'cash' || accId === 'cash_fallback') {
        if (!fallbackCashAccId) {
          const cashAcc = await ensureCashAccount(user);
          fallbackCashAccId = cashAcc.id;
        }
        accId = fallbackCashAccId;
      }

      const item: any = {
        ...row,
        account_id: accId,
        raw_description: row.description,
        is_recurring: false,
        is_anomaly: false,
        original_currency: row.original_currency ?? 'BRL',
        original_amount: row.original_amount ?? row.amount,
        exchange_rate: row.exchange_rate ?? 1.0,
        updated_at: new Date().toISOString(),
      };

      if (!isLucasUser(user) && user) {
        item.user_id = user.id;
      }
      return item;
    })
  );

  let { data, error } = await supabase
    .from('transactions')
    .insert(mapped)
    .select();

  if (error && mapped.some((m: any) => m.user_id) && error.message?.includes('user_id')) {
    const withoutUser = mapped.map((m: any) => {
      const { user_id, ...rest } = m;
      return rest;
    });
    const retry = await supabase.from('transactions').insert(withoutUser).select();
    data = retry.data;
    error = retry.error;
  }

  if (error) throw error;

  const created = (data ?? []) as Transaction[];
  for (const tx of created) {
    if (tx.account_id) {
      const delta = tx.original_amount ?? tx.amount;
      await updateAccountBalanceDelta(tx.account_id, delta, tx.original_currency || 'BRL');
    }
  }

  return created;
}

/** Upsert em lote, evitando duplicatas por pluggy_transaction_id. */
export async function upsertTransactions(
  rows: TransactionUpsert[],
): Promise<void> {
  if (rows.length === 0) return;
  const mapped = rows.map(r => ({
    ...r,
    original_currency: r.original_currency ?? 'BRL',
    original_amount: r.original_amount ?? r.amount,
    exchange_rate: r.exchange_rate ?? 1.0,
  }));
  const { error } = await supabase
    .from('transactions')
    .upsert(mapped, { onConflict: 'pluggy_transaction_id', ignoreDuplicates: true });
  if (error) throw error;
}

/** Transações ainda não categorizadas pela IA (category nula). */
export async function getUncategorizedTransactions(
  limit = 200,
): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .is('category', null)
    .order('date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Transaction[];
}

export async function updateTransactionCategory(
  pluggyTransactionId: string,
  fields: Partial<Transaction>,
): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('pluggy_transaction_id', pluggyTransactionId);
  if (error) throw error;
}

export async function setTransactionCategoryById(
  id: string,
  category: string,
  subcategory: string | null = null,
): Promise<Transaction> {
  const { data, error } = await supabase
    .from('transactions')
    .update({ category, subcategory, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as Transaction;
}

export async function updateTransactionById(
  id: string,
  fields: Partial<Transaction>,
): Promise<Transaction> {
  if (fields.account_id === 'cash' || fields.account_id === 'cash_fallback') {
    const cashAcc = await ensureCashAccount();
    fields.account_id = cashAcc.id;
  }

  const { data: oldTx } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .single();

  const { data: newTx, error } = await supabase
    .from('transactions')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  const updated = newTx as Transaction;

  if (oldTx && oldTx.account_id) {
    const oldDelta = oldTx.original_amount ?? oldTx.amount;
    await updateAccountBalanceDelta(oldTx.account_id, -oldDelta, oldTx.original_currency || 'BRL');
  }

  if (updated && updated.account_id) {
    const newDelta = updated.original_amount ?? updated.amount;
    await updateAccountBalanceDelta(updated.account_id, +newDelta, updated.original_currency || 'BRL');
  }

  return updated;
}

export async function deleteTransaction(id: string): Promise<void> {
  const { data: oldTx } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .single();

  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) throw error;

  if (oldTx && oldTx.account_id) {
    const oldDelta = oldTx.original_amount ?? oldTx.amount;
    await updateAccountBalanceDelta(oldTx.account_id, -oldDelta, oldTx.original_currency || 'BRL');
  }
}

export async function markAnomaly(
  pluggyTransactionId: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase
    .from('transactions')
    .update({ is_anomaly: true, anomaly_reason: reason })
    .eq('pluggy_transaction_id', pluggyTransactionId);
  if (error) throw error;
}

export interface TransactionFilter {
  month?: string; // formato 'YYYY-MM'
  category?: string;
  accountId?: string;
}

export async function getTransactions(
  filter: TransactionFilter = {},
  user?: UserSessionPayload | null,
): Promise<Transaction[]> {
  // Se não for o Lucas, filtra transações pertencentes às contas do usuário
  if (!isLucasUser(user)) {
    const userAccounts = await getAllAccounts(user);
    if (userAccounts.length === 0) {
      return [];
    }
    const allowedAccountIds = userAccounts.map((a) => a.id);
    if (filter.accountId && !allowedAccountIds.includes(filter.accountId)) {
      return [];
    }

    let query = supabase.from('transactions').select('*').in('account_id', allowedAccountIds);

    if (filter.month) {
      const start = `${filter.month}-01`;
      const end = endOfMonth(filter.month);
      query = query.gte('date', start).lte('date', end);
    }
    if (filter.category) query = query.eq('category', filter.category);
    if (filter.accountId) query = query.eq('account_id', filter.accountId);

    const { data, error } = await query.order('date', { ascending: false });
    if (error) throw error;
    return (data ?? []) as Transaction[];
  }

  // Para o Lucas (ou contexto global):
  let query = supabase.from('transactions').select('*');

  if (filter.month) {
    const start = `${filter.month}-01`;
    const end = endOfMonth(filter.month);
    query = query.gte('date', start).lte('date', end);
  }
  if (filter.category) query = query.eq('category', filter.category);
  if (filter.accountId) query = query.eq('account_id', filter.accountId);

  const { data, error } = await query.order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Transaction[];
}

export async function getTransactionsBetween(
  from: string,
  to: string,
): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Transaction[];
}

export async function getRecentTransactions(limit = 20): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Transaction[];
}

export async function getAnomalies(limit = 50): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('is_anomaly', true)
    .order('date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Transaction[];
}

// --- Insights ---

export async function insertInsight(
  insight: Pick<
    AiInsight,
    'type' | 'period_start' | 'period_end' | 'title' | 'narrative' | 'data_snapshot'
  >,
): Promise<AiInsight> {
  const { data, error } = await supabase
    .from('ai_insights')
    .insert(insight)
    .select()
    .single();
  if (error) throw error;
  return data as AiInsight;
}

export async function getInsights(type?: InsightType): Promise<AiInsight[]> {
  let query = supabase.from('ai_insights').select('*');
  if (type) query = query.eq('type', type);
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data ?? []) as AiInsight[];
}

export async function getLatestInsightByType(): Promise<AiInsight[]> {
  // Busca os mais recentes e deduplica por tipo no código (simples e suficiente).
  const { data, error } = await supabase
    .from('ai_insights')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  const seen = new Set<string>();
  const latest: AiInsight[] = [];
  for (const row of (data ?? []) as AiInsight[]) {
    if (!seen.has(row.type)) {
      seen.add(row.type);
      latest.push(row);
    }
  }
  return latest;
}

export async function getUnsentInsight(
  type: InsightType,
): Promise<AiInsight | null> {
  const { data, error } = await supabase
    .from('ai_insights')
    .select('*')
    .eq('type', type)
    .eq('was_sent_whatsapp', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as AiInsight) ?? null;
}

export async function markInsightSent(id: string): Promise<void> {
  const { error } = await supabase
    .from('ai_insights')
    .update({ was_sent_whatsapp: true, sent_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

// --- Metas e padrões ---

export async function getActiveGoals(): Promise<FinancialGoal[]> {
  const { data, error } = await supabase
    .from('financial_goals')
    .select('*')
    .eq('is_active', true);
  if (error) throw error;
  return (data ?? []) as FinancialGoal[];
}

export async function getPatterns(): Promise<SpendingPattern[]> {
  const { data, error } = await supabase.from('spending_patterns').select('*');
  if (error) throw error;
  return (data ?? []) as SpendingPattern[];
}

// --- Settings ---

export async function getSetting<T>(key: string): Promise<T | null> {
  const { data, error } = await supabase
    .from('settings')
    .select('value')
    .eq('key', key)
    .maybeSingle();
  if (error) throw error;
  return (data?.value as T) ?? null;
}

export async function getAllSettings(): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.from('settings').select('key, value');
  if (error) throw error;
  const out: Record<string, unknown> = {};
  for (const row of (data ?? []) as { key: string; value: unknown }[]) {
    out[row.key] = row.value;
  }
  return out;
}

export async function updateSetting(
  key: string,
  value: unknown,
): Promise<void> {
  const { error } = await supabase
    .from('settings')
    .upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    );
  if (error) throw error;
}

// --- Investimentos ---

export async function getAllInvestments(user?: UserSessionPayload | null): Promise<Investment[]> {
  const { data, error } = await supabase
    .from('investments')
    .select('*')
    .order('total_value', { ascending: false });
  if (error) throw error;

  const yieldSettingKey = getUserSettingKey('investment_yield_configs', user);
  const yieldConfigs =
    (await getSetting<
      Record<
        string,
        {
          yield_rate?: number;
          yield_frequency?: 'MONTHLY' | 'ANNUAL';
          last_yield_date?: string | null;
        }
      >
    >(yieldSettingKey)) || {};

  const rawList = (data ?? []) as Investment[];

  // Filtra apenas os investimentos pertencentes ao usuário logado
  const filteredList = rawList.filter((item: any) =>
    isRecordOwnedByUser(item.user_id, item.sync_source, user),
  );

  return filteredList.map((item) => {
    const config = yieldConfigs[item.id];
    if (config) {
      if (config.yield_rate !== undefined) item.yield_rate = config.yield_rate;
      if (config.yield_frequency) item.yield_frequency = config.yield_frequency;
      if (config.last_yield_date) item.last_yield_date = config.last_yield_date;
    }

    if (item.sync_source && item.sync_source.includes('#')) {
      const parts = item.sync_source.split('#');
      if (parts.length >= 2 && parts[1]) {
        const avg = parseFloat(parts[1]);
        if (!isNaN(avg) && avg > 0 && (!item.average_price || item.average_price === 0)) {
          item.average_price = avg;
        }
      }
      if (parts.length >= 3 && parts[2]) {
        const cur = parseFloat(parts[2]);
        // Apenas usa o preço da string como fallback se o current_price da tabela estiver vazio ou zerado
        if ((!item.current_price || item.current_price === 0) && !isNaN(cur) && cur > 0) {
          item.current_price = cur;
        }
      }
      // Apenas recalcula total_value para posições ativas
      if (item.quantity > 0 && item.current_price > 0) {
        item.total_value = item.quantity * item.current_price;
      }
    }
    return item;
  });
}

export async function upsertInvestment(
  item: Partial<Investment>,
  user?: UserSessionPayload | null,
): Promise<Investment> {
  // Extrai campos que não são colunas diretas da tabela 'investments' no Postgres
  const { yield_rate, yield_frequency, last_yield_date, date, ...dbFields } = item as any;

  // Se o usuário não for o Lucas, tagueia o sync_source para isolamento
  if (user && !isLucasUser(user)) {
    dbFields.sync_source = tagSyncSourceWithUser(dbFields.sync_source, user.id);
  }

  const payload = {
    ...dbFields,
    updated_at: new Date().toISOString(),
  };

  let saved: Investment;
  if (item.id) {
    const { data, error } = await supabase
      .from('investments')
      .update(payload)
      .eq('id', item.id)
      .select()
      .single();
    if (error) throw error;
    saved = data as Investment;
  } else {
    const { data, error } = await supabase
      .from('investments')
      .upsert(payload)
      .select()
      .single();
    if (error) throw error;
    saved = data as Investment;
  }

  // Se foram informados campos de rendimento, salva na tabela de settings no escopo do usuário
  const yieldSettingKey = getUserSettingKey('investment_yield_configs', user);
  if (saved && (yield_rate !== undefined || yield_frequency !== undefined || last_yield_date !== undefined)) {
    const allConfigs = (await getSetting<Record<string, any>>(yieldSettingKey)) || {};
    allConfigs[saved.id] = {
      ...(allConfigs[saved.id] || {}),
      ...(yield_rate !== undefined ? { yield_rate: Number(yield_rate) } : {}),
      ...(yield_frequency !== undefined ? { yield_frequency } : {}),
      ...(last_yield_date !== undefined ? { last_yield_date } : {}),
    };
    await updateSetting(yieldSettingKey, allConfigs);
    saved.yield_rate = allConfigs[saved.id]?.yield_rate;
    saved.yield_frequency = allConfigs[saved.id]?.yield_frequency;
    saved.last_yield_date = allConfigs[saved.id]?.last_yield_date;
  } else if (saved) {
    const allConfigs = (await getSetting<Record<string, any>>(yieldSettingKey)) || {};
    if (allConfigs[saved.id]) {
      saved.yield_rate = allConfigs[saved.id]?.yield_rate;
      saved.yield_frequency = allConfigs[saved.id]?.yield_frequency;
      saved.last_yield_date = allConfigs[saved.id]?.last_yield_date;
    }
  }

  return saved;
}

export async function deleteInvestment(
  id: string,
  user?: UserSessionPayload | null,
): Promise<void> {
  // Se for especificado um usuário e não for o Lucas, valida posse antes de excluir
  if (user && !isLucasUser(user)) {
    const { data: inv } = await supabase.from('investments').select('*').eq('id', id).single();
    if (inv && !isRecordOwnedByUser(inv.user_id, inv.sync_source, user)) {
      throw new Error('Não autorizado a excluir este ativo.');
    }
  }

  const { error } = await supabase.from('investments').delete().eq('id', id);
  if (error) throw error;
}

export async function deleteInvestmentsBySource(
  institution: string,
  syncSource: string,
): Promise<void> {
  const { error } = await supabase
    .from('investments')
    .delete()
    .eq('institution', institution)
    .eq('sync_source', syncSource);
  if (error) throw error;
}

// --- Utilitário de datas ---

function endOfMonth(month: string): string {
  const [yearStr, monthStr] = month.split('-');
  const year = Number(yearStr);
  const m = Number(monthStr);
  const last = new Date(year, m, 0).getDate(); // dia 0 do mês seguinte = último dia
  return `${month}-${String(last).padStart(2, '0')}`;
}

