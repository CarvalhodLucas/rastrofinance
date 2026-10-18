import { PluggyClient } from 'pluggy-sdk';
import { env } from '../config/env.js';
import {
  getActiveAccounts,
  getAllAccounts,
  touchAccountSync,
  upsertInvestment,
  upsertTransactions,
  type TransactionFilter,
} from './supabaseService.js';
import type { AccountType, AssetType, Investment, TransactionType, TransactionUpsert } from '../types.js';

/**
 * Serviço de integração com o Pluggy (Open Finance).
 * Usa o SDK oficial `pluggy-sdk` (substitui o `@pluggy/pluggy-js` mencionado
 * no spec — esse pacote não existe no npm; `pluggy-sdk` é o SDK oficial).
 */
const client = new PluggyClient({
  clientId: env.PLUGGY_CLIENT_ID,
  clientSecret: env.PLUGGY_CLIENT_SECRET,
});

/** Tempo mínimo entre syncs por conta — Pluggy tem rate limit (1x/hora). */
const MIN_SYNC_INTERVAL_MS = 60 * 60 * 1000;

/**
 * 1) Gera token temporário para o Pluggy Connect Widget (válido ~30 min).
 */
export async function generateConnectToken(itemId?: string): Promise<string> {
  const { accessToken } = await client.createConnectToken(itemId);
  return accessToken;
}

interface NormalizedAccount {
  pluggy_account_id: string;
  account_name: string;
  account_type: AccountType;
  balance: number;
  currency: string;
  account_number: string | null;
}

/**
 * 2) Busca todas as contas de um item conectado, já normalizadas.
 */
export async function getAccounts(itemId: string): Promise<NormalizedAccount[]> {
  const { results } = await client.fetchAccounts(itemId);
  return results.map((acc) => ({
    pluggy_account_id: acc.id,
    account_name: acc.name ?? acc.marketingName ?? 'Conta',
    account_type: mapAccountType(acc.type, acc.subtype),
    balance: acc.balance ?? 0,
    currency: acc.currencyCode ?? 'BRL',
    account_number: acc.number ?? null,
  }));
}

/** Retorna a instituição (nome + logo) associada a um item. */
export async function getInstitution(
  itemId: string,
): Promise<{ name: string; logo: string | null }> {
  const item = await client.fetchItem(itemId);
  return {
    name: item.connector?.name ?? 'Instituição',
    logo: item.connector?.imageUrl ?? null,
  };
}

/**
 * 3) Busca transações de uma conta em um período e normaliza para o schema.
 */
export async function getTransactions(
  accountId: string,
  localAccountId: string,
  from: Date,
  to: Date,
): Promise<TransactionUpsert[]> {
  const rows: TransactionUpsert[] = [];
  let page = 1;
  const pageSize = 200;

  // O SDK pagina; varremos até esgotar.
  for (;;) {
    const { results, totalPages } = await client.fetchTransactions(accountId, {
      from: toIsoDate(from),
      to: toIsoDate(to),
      pageSize,
      page,
    });

    for (const tx of results) {
      rows.push({
        pluggy_transaction_id: tx.id,
        account_id: localAccountId,
        date: toIsoDate(new Date(tx.date)),
        amount: tx.amount,
        description: tx.description ?? tx.descriptionRaw ?? 'Sem descrição',
        raw_description: tx.descriptionRaw ?? null,
        merchant_name: tx.merchant?.name ?? null,
        transaction_type: mapTransactionType(tx),
      });
    }

    if (!totalPages || page >= totalPages) break;
    page += 1;
  }

  return rows;
}

/**
 * 4) Job de sync: percorre todas as contas ativas, respeita rate limit,
 * busca os últimos 7 dias e faz upsert (sem duplicatas).
 * Retorna a quantidade de transações novas inseridas.
 */
export async function syncAllAccounts(force = false): Promise<number> {
  const accounts = await getActiveAccounts();
  const now = Date.now();
  let totalNew = 0;

  for (const account of accounts) {
    // Controle de rate limit via last_synced_at.
    if (!force && account.last_synced_at) {
      const elapsed = now - new Date(account.last_synced_at).getTime();
      if (elapsed < MIN_SYNC_INTERVAL_MS) {
        console.log(
          `[pluggy] Pulando ${account.institution_name} — sync recente (${Math.round(
            elapsed / 60000,
          )}min atrás).`,
        );
        continue;
      }
    }

    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 7);

    try {
      const rows = await getTransactions(
        account.pluggy_account_id,
        account.id,
        from,
        to,
      );
      await upsertTransactions(rows);
      await touchAccountSync(account.id);
      totalNew += rows.length;
      console.log(
        `[pluggy] ${account.institution_name}: ${rows.length} transações sincronizadas.`,
      );
    } catch (err) {
      console.error(
        `[pluggy] Erro ao sincronizar ${account.institution_name}:`,
        err,
      );
    }
  }

  return totalNew;
}

/**
 * Busca e sincroniza todos os investimentos de um item Pluggy (B3, XP, BTG, NuInvest, etc.)
 */
export async function syncPluggyInvestments(itemId: string): Promise<Investment[]> {
  const institution = await getInstitution(itemId);
  const { results: investments } = await client.fetchInvestments(itemId);

  const synced: Investment[] = [];

  for (const inv of investments) {
    const code = (inv.code || inv.number || inv.name || 'ATIVO').toUpperCase();
    const invObj = inv as Record<string, unknown>;
    const qty = Number(inv.amount) || Number(invObj.quantity) || 1;
    const balance = Number(inv.balance) || Number(invObj.value) || 0;
    const unitPrice = Number(invObj.price) || (qty > 0 ? balance / qty : balance);

    let assetType: AssetType = 'STOCK';
    const pluggyType = (inv.type || '').toUpperCase();
    const pluggySubtype = (inv.subtype || '').toUpperCase();

    if (pluggyType === 'EQUITY') {
      assetType = code.endsWith('11') ? 'FII' : 'STOCK';
    } else if (pluggyType === 'FIXED_INCOME') {
      assetType = 'FIXED_INCOME';
    } else if (pluggyType === 'MUTUAL_FUND' || pluggySubtype.includes('ETF')) {
      assetType = code.endsWith('11') ? 'FII' : 'STOCK';
    } else if (pluggyType === 'CURRENCY' || pluggyType === 'CRYPTO') {
      assetType = 'CRYPTO';
    } else {
      assetType = 'OTHER';
    }

    const saved = await upsertInvestment({
      name: inv.name || code,
      code_ticker: code,
      asset_type: assetType,
      institution: institution.name || 'B3',
      quantity: qty,
      average_price: unitPrice,
      current_price: unitPrice,
      total_value: balance,
      currency: inv.currencyCode || 'BRL',
      sync_source: 'B3_IMPORT',
      last_synced_at: new Date().toISOString(),
    });

    synced.push(saved);
  }

  return synced;
}

/**
 * Percorre todas as contas conectadas no Pluggy e sincroniza os investimentos de cada uma
 */
export async function syncAllPluggyInvestments(): Promise<Investment[]> {
  const accounts = await getAllAccounts();
  const itemIds = Array.from(new Set(accounts.map((a) => a.pluggy_item_id).filter(Boolean)));

  const allSynced: Investment[] = [];
  for (const itemId of itemIds) {
    try {
      const items = await syncPluggyInvestments(itemId);
      allSynced.push(...items);
    } catch (err) {
      console.error(`[pluggy] Erro ao sincronizar investimentos do item ${itemId}:`, err);
    }
  }

  return allSynced;
}


// --- Helpers de normalização ---

function toIsoDate(date: Date): string {
  const part = date.toISOString().split('T')[0];
  return part ?? date.toISOString();
}

function mapAccountType(type?: string, subtype?: string): AccountType {
  const t = (type ?? '').toUpperCase();
  const s = (subtype ?? '').toUpperCase();
  if (t === 'CREDIT' || s.includes('CREDIT_CARD')) return 'CREDIT';
  if (s.includes('SAVINGS')) return 'SAVINGS';
  if (t === 'INVESTMENT') return 'INVESTMENT';
  return 'CHECKING';
}

interface PluggyTxLike {
  type?: string;
  amount: number;
  paymentData?: { paymentMethod?: string } | null;
}

function mapTransactionType(tx: PluggyTxLike): TransactionType {
  const method = (tx.paymentData?.paymentMethod ?? '').toUpperCase();
  if (method.includes('PIX')) return 'PIX';
  if (method.includes('TED') || method.includes('DOC')) return 'TED';
  if (method.includes('BOLETO')) return 'BOLETO';
  return tx.amount >= 0 ? 'CREDIT' : 'DEBIT';
}

export type { TransactionFilter };
