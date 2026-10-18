import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import { supabase, type ManualTransactionInsert } from './supabaseService.js';
import type { DividendItem, DividendsSummary } from '../types.js';
import type { UserSessionPayload } from './authService.js';
import { isLucasUser } from './userScopeService.js';

const B3_MOVIMENTACAO_PREFIX = 'movimentacao-';
const GORILA_REPORT_FILENAME = 'relatorio_Lucas-Carvalho_23-07-2025_11-08-2026.xlsx';

function getB3FilePath(): string | null {
  let rootDir = process.cwd();
  if (path.basename(rootDir) === 'backend') {
    rootDir = path.join(rootDir, '..');
  }
  const files = fs.readdirSync(rootDir);
  const file = files.find((f) => f.startsWith(B3_MOVIMENTACAO_PREFIX) && f.endsWith('.xlsx'));
  return file ? path.join(rootDir, file) : null;
}

/**
 * Lê todos os proventos reais diretamente do extrato de movimentação oficial da B3.
 */
export async function getDividendsFromReport(user?: UserSessionPayload | null): Promise<DividendsSummary> {
  if (!isLucasUser(user)) {
    return {
      total_dividends: 0,
      total_jcp: 0,
      total_fii_earnings: 0,
      total_overall: 0,
      items: [],
    };
  }

  const b3Path = getB3FilePath();
  if (!b3Path || !fs.existsSync(b3Path)) {
    console.warn(`[dividendService] Extrato de movimentação B3 não encontrado.`);
    return {
      total_dividends: 0,
      total_jcp: 0,
      total_fii_earnings: 0,
      total_overall: 0,
      items: [],
    };
  }

  const wb = xlsx.readFile(b3Path);
  const firstSheet = wb.SheetNames[0];
  const sheet = wb.Sheets['Movimentação'] || (firstSheet ? wb.Sheets[firstSheet] : undefined);
  if (!sheet) {
    return { total_dividends: 0, total_jcp: 0, total_fii_earnings: 0, total_overall: 0, items: [] };
  }
  const data: any[][] = xlsx.utils.sheet_to_json(sheet, { header: 1 });

  const items: DividendItem[] = [];
  let totalDiv = 0;
  let totalJcp = 0;
  let totalFii = 0;

  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r || !r[1] || !r[2] || !r[3]) continue;

    const dateRaw = r[1];
    const op = String(r[2]).trim();
    const rawProduct = String(r[3]).trim();
    const inst = String(r[4] || 'B3').trim();
    const totalVal = parseFloat(r[7]) || 0;

    let isDividend = ['Dividendo', 'Dividendos'].includes(op);
    let isJcp = ['Juros Sobre Capital Próprio', 'JCP'].includes(op);
    let isFii = ['Rendimento', 'Rendimentos'].includes(op);

    if (!isDividend && !isJcp && !isFii) continue;
    if (totalVal <= 0) continue;

    // Parse Data real da B3 (DD/MM/YYYY)
    let dateIso = '';
    if (typeof dateRaw === 'number') {
      const serial = dateRaw;
      const utc_days = Math.floor(serial - 25569);
      const iso = new Date(utc_days * 86400 * 1000 + 12 * 60 * 60 * 1000).toISOString().split('T')[0];
      dateIso = iso || '';
    } else if (typeof dateRaw === 'string') {
      const [d, m, y] = dateRaw.split('/');
      dateIso = `${y}-${m}-${d}`;
    } else {
      continue;
    }

    // Extrair ticker e nome
    const parts = (rawProduct || '').split(' - ');
    const ticker = (parts[0] || '').trim().toUpperCase();
    const name = parts[1] ? parts[1].trim() : ticker;

    let subCategory = 'Ações';
    let assetClass = 'Renda Variável';

    if (ticker.endsWith('11') && !['KLBN11', 'BPAC11', 'SANB11', 'TAEE11'].includes(ticker)) {
      subCategory = 'FIIs';
      assetClass = 'Fundos Imobiliários';
    } else if (ticker.startsWith('CDB') || ticker.startsWith('TESOURO') || ticker.startsWith('LCI')) {
      subCategory = 'Renda Fixa';
      assetClass = 'Renda Fixa';
    }

    // Se a B3 registrou como "Rendimento" mas o ativo é Ação (ex: PETR4), classificar como Dividendo
    if (isFii && subCategory !== 'FIIs') {
      isDividend = true;
      isFii = false;
    }

    const institutionClean = inst
      .replace(' S.A. - CTVM', '')
      .replace(' CCTVM S/A.', '')
      .replace(' CCTVM S/A', '')
      .replace(' CORRETORA DE VALORES S.A.', '')
      .replace(' INVESTIMENTOS', '')
      .trim();

    const divAmt = isDividend ? totalVal : 0;
    const jcpAmt = isJcp ? totalVal : 0;
    const fiiAmt = isFii ? totalVal : 0;

    totalDiv += divAmt;
    totalJcp += jcpAmt;
    totalFii += fiiAmt;

    items.push({
      id: `div_b3_${i}_${ticker}_${dateIso}`,
      ticker,
      institution: institutionClean,
      sub_category: subCategory,
      asset_class: assetClass,
      date: dateIso,
      dividends: divAmt,
      jcp: jcpAmt,
      bonification: 0,
      fii_earnings: fiiAmt,
      amortization: 0,
      total_earnings: Number(totalVal.toFixed(2)),
    });
  }

  // Ordenar por data mais recente primeiro
  items.sort((a, b) => new Date(b.date || '').getTime() - new Date(a.date || '').getTime());

  const totalOverall = totalDiv + totalJcp + totalFii;

  return {
    total_dividends: Number(totalDiv.toFixed(2)),
    total_jcp: Number(totalJcp.toFixed(2)),
    total_fii_earnings: Number(totalFii.toFixed(2)),
    total_overall: Number(totalOverall.toFixed(2)),
    items,
  };
}

/**
 * Sincroniza os proventos para a tabela de Transações do sistema.
 * Aplica lógica rigorosa ANTI-DUPLICIDADE antes de inserir.
 */
export async function syncDividendsToTransactions(user?: UserSessionPayload | null): Promise<{
  insertedCount: number;
  skippedCount: number;
  insertedItems: string[];
}> {
  if (!isLucasUser(user)) {
    return { insertedCount: 0, skippedCount: 0, insertedItems: [] };
  }

  const summary = await getDividendsFromReport(user);
  if (summary.items.length === 0) {
    return { insertedCount: 0, skippedCount: 0, insertedItems: [] };
  }

  // Buscar todas as transações já cadastradas
  const { data: existingTxs, error } = await supabase
    .from('transactions')
    .select('id, pluggy_transaction_id, amount, description, date');

  if (error) {
    console.error('[dividendService] Erro ao consultar transações existentes:', error);
    throw error;
  }

  const existingList = existingTxs || [];
  const toInsert: ManualTransactionInsert[] = [];
  const insertedItems: string[] = [];
  let skippedCount = 0;

  for (const item of summary.items) {
    const targetPluggyId = `dividend_auto_${item.id}`;
    const existsById = existingList.some(
      (tx) => tx.pluggy_transaction_id === targetPluggyId,
    );

    if (existsById) {
      skippedCount++;
      continue;
    }

    const existsByMatch = existingList.some((tx) => {
      const sameAmount = Math.abs(Number(tx.amount) - item.total_earnings) < 0.01;
      const sameDate = tx.date === item.date;
      const descUpper = (tx.description || '').toUpperCase();
      const hasTicker = descUpper.includes(item.ticker);

      return sameAmount && sameDate && hasTicker;
    });

    if (existsByMatch) {
      skippedCount++;
      continue;
    }

    let provType = 'Dividendo';
    if (item.fii_earnings > 0) {
      provType = 'Rendimento FII';
    } else if (item.jcp > 0) {
      provType = 'JCP';
    }

    const description = `Provento: ${provType} ${item.ticker} (${item.institution})`;

    toInsert.push({
      pluggy_transaction_id: targetPluggyId,
      account_id: null,
      date: item.date || new Date().toISOString().split('T')[0]!,
      amount: item.total_earnings,
      description,
      transaction_type: 'CREDIT',
      category: 'Investimentos / Proventos',
      original_currency: 'BRL',
      original_amount: item.total_earnings,
      exchange_rate: 1.0,
    });

    insertedItems.push(`${item.date} - ${item.ticker} - R$ ${item.total_earnings}`);
  }

  if (toInsert.length > 0) {
    const { error: insErr } = await supabase.from('transactions').insert(
      toInsert.map((row) => ({
        ...row,
        raw_description: row.description,
        is_recurring: false,
        is_anomaly: false,
        updated_at: new Date().toISOString(),
      })),
    );

    if (insErr) {
      console.error('[dividendService] Erro ao inserir transações de proventos:', insErr);
      throw insErr;
    }
  }

  return {
    insertedCount: toInsert.length,
    skippedCount,
    insertedItems,
  };
}
