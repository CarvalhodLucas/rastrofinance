import fs from 'fs';
import path from 'path';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { TransactionUpsert } from '../types.js';

// ============ TIPOS LOCAIS ============

export interface EnableBankingASPSP {
  name: string;
  country: string;
  // outros campos irrelevantes omitidos
}

export interface EnableBankingAccount {
  account_id: string;
  currency: string;
  iban?: string;
}

export interface EnableBankingTransaction {
  transactionAmount: {
    amount: string;
    currency: string;
  };
  bookingDate: string;
  remittanceInformationUnstructured?: string;
  additionalInformation?: string;
  creditorName?: string;
  debtorName?: string;
  transactionId?: string;
}

// ============ AUTENTICAÇÃO JWT ============

function generateJWT(): string {
  const privateKeyPath = path.resolve(process.cwd(), env.ENABLE_BANKING_PRIVATE_KEY_PATH);
  
  if (!fs.existsSync(privateKeyPath)) {
    throw new Error(`Chave privada do Enable Banking não encontrada em: ${privateKeyPath}`);
  }

  const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
  
  const payload = {
    iss: 'enablebanking.com',
    aud: 'api.enablebanking.com',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600 // 1 hora
  };

  return jwt.sign(payload, privateKey, { 
    algorithm: 'RS256', 
    keyid: env.ENABLE_BANKING_APPLICATION_ID 
  });
}

function getBaseUrl(): string {
  return env.ENABLE_BANKING_ENV === 'production' 
    ? env.ENABLE_BANKING_API_BASE_PRODUCTION 
    : env.ENABLE_BANKING_API_BASE_SANDBOX;
}

async function enableBankingRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = generateJWT();
  const url = `${getBaseUrl()}${endpoint}`;
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const response = await fetch(url, { ...options, headers });
  
  if (!response.ok) {
    let errorBody: any = {};
    try {
      errorBody = await response.json();
    } catch (e) {
      // ignora
    }
    throw new Error(`Erro Enable Banking (${response.status}): ${JSON.stringify(errorBody)}`);
  }

  return response.json() as Promise<T>;
}

// ============ DESCOBERTA DE BANCO ============

export async function getAvailableASPSPs(country: string = 'ES'): Promise<EnableBankingASPSP[]> {
  const response = await enableBankingRequest<{ aspsps: EnableBankingASPSP[] }>(`/aspsps?country=${country}`);
  return response.aspsps;
}

// ============ INÍCIO DO FLUXO DE AUTORIZAÇÃO ============

export async function startAuthorization(aspspName: string, country: string = 'ES', state: string): Promise<string> {
  const validUntil = new Date();
  validUntil.setDate(validUntil.getDate() + 89); // 90 dias no futuro aprox

  const body = {
    access: { valid_until: validUntil.toISOString() },
    aspsp: { name: aspspName, country },
    state,
    redirect_url: env.ENABLE_BANKING_REDIRECT_URL,
    psu_type: 'personal'
  };

  const response = await enableBankingRequest<{ url: string }>('/auth', {
    method: 'POST',
    body: JSON.stringify(body)
  });

  return response.url;
}

// ============ CALLBACK APÓS AUTORIZAÇÃO ============

export async function completeAuthorization(code: string): Promise<{ sessionId: string, accounts: EnableBankingAccount[], validUntil: string }> {
  const body = { code };
  
  const response = await enableBankingRequest<any>('/sessions', {
    method: 'POST',
    body: JSON.stringify(body)
  });

  const sessionId = response.session_id;
  
  // LOG DE DEPURAÇÃO PARA ARQUIVO LOCAL
  try {
    fs.writeFileSync(
      path.resolve(process.cwd(), 'enable_banking_debug.json'), 
      JSON.stringify({ rawResponse: response }, null, 2)
    );
  } catch (logErr) {
    console.error('Falha ao escrever log de depuração:', logErr);
  }

  const accountsData = response.accounts || [];
  
  const accounts: EnableBankingAccount[] = accountsData.map((acc: any) => ({
    account_id: acc.uid,
    currency: acc.currency,
    iban: acc.iban || acc.account_id?.iban
  }));
  
  // Dependendo da resposta da API, a validade da sessão pode estar no objeto access
  const validUntil = response.access?.valid_until || (() => {
    const d = new Date();
    d.setDate(d.getDate() + 90);
    return d.toISOString();
  })();

  return { sessionId, accounts, validUntil };
}

// ============ BUSCA DE DADOS DA CONTA ============

export async function getAccountBalances(accountId: string): Promise<number> {
  const response = await enableBankingRequest<any>(`/accounts/${accountId}/balances`);
  
  if (response.balances && response.balances.length > 0) {
    const balance = response.balances[0].balanceAmount?.amount;
    return parseFloat(balance || '0');
  }
  
  return 0;
}

export async function getAccountTransactions(accountId: string, dateFrom: string, dateTo: string): Promise<EnableBankingTransaction[]> {
  let allTransactions: EnableBankingTransaction[] = [];
  let nextContinuation: string | undefined = undefined;

  do {
    const qs = new URLSearchParams({ date_from: dateFrom, date_to: dateTo });
    if (nextContinuation) {
      qs.set('continuation', nextContinuation);
    }

    const response = await enableBankingRequest<any>(`/accounts/${accountId}/transactions?${qs.toString()}`);
    
    if (response.transactions) {
      allTransactions = allTransactions.concat(response.transactions);
    }
    
    nextContinuation = response.continuation;
  } while (nextContinuation);

  return allTransactions;
}

// ============ NORMALIZAÇÃO PARA O SCHEMA ============

export function normalizeTransaction(rawTx: EnableBankingTransaction, dbAccountId: string): TransactionUpsert {
  const rawAmount = parseFloat(rawTx.transactionAmount.amount);
  
  // Por convenção Berlin Group, valores de débito são negativos ou positivos dependendo da API
  // Caso seja tudo positivo mas com marcação de DBIT (se houvesse creditDebitIndicator)
  // No formato retornado pela Enable Banking, débito geralmente vem negativo no amount
  // Vamos assumir que débito < 0 e crédito > 0 (ajuste se necessário)
  
  const amount = rawAmount;
  const transactionType = amount < 0 ? 'DEBIT' : 'CREDIT';
  
  const description = rawTx.remittanceInformationUnstructured || rawTx.additionalInformation || 'Transação';
  const merchantName = rawTx.creditorName || rawTx.debtorName || null;
  const transactionId = rawTx.transactionId || `eb_${Math.random().toString(36).substring(7)}`; // Fallback caso não haja ID

  return {
    pluggy_transaction_id: transactionId,
    account_id: dbAccountId,
    date: rawTx.bookingDate,
    amount: amount,
    description,
    raw_description: description,
    merchant_name: merchantName,
    transaction_type: transactionType
  };
}
