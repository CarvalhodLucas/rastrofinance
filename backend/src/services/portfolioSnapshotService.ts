import { supabase } from './supabaseService.js';

export interface Holding {
  asset_ticker: string;
  asset_type: string;
  total_quantity: number;
  average_price: number;
  total_invested: number;
  last_updated: string;
}

export interface Snapshot {
  snapshot_date: string;
  total_invested: number;
  total_market_value: number | null;
  total_dividends_received: number;
  profitability_pct: number | null;
}

/**
 * Recalcula a posição atual em carteira (tabela current_holdings)
 * com base em todas as transações cadastradas.
 */
export async function recalculateHoldings(): Promise<void> {
  const { data: txs, error } = await supabase
    .from('investment_transactions')
    .select('*')
    .order('operation_date', { ascending: true });

  if (error) throw error;
  if (!txs || txs.length === 0) {
    // Se não há transações, limpa a tabela de holdings
    await supabase.from('current_holdings').delete().neq('asset_ticker', '');
    return;
  }

  // Agrupa transações por ticker do ativo
  const txsByTicker: Record<string, typeof txs> = {};
  for (const tx of txs) {
    const ticker = tx.asset_ticker.toUpperCase();
    if (!txsByTicker[ticker]) {
      txsByTicker[ticker] = [];
    }
    txsByTicker[ticker].push(tx);
  }

  const holdingsToUpsert: Holding[] = [];
  const tickersToDelete: string[] = [];

  for (const [ticker, tickerTxs] of Object.entries(txsByTicker)) {
    // Tipo de ativo (usamos o tipo do mais recente)
    const assetType = tickerTxs[tickerTxs.length - 1].asset_type;

    // Calcula quantidade total e total investido
    let totalQuantity = 0;
    let totalPurchasedQty = 0;
    let totalPurchasedVal = 0;
    let totalSoldVal = 0;

    for (const tx of tickerTxs) {
      const qty = Number(tx.quantity);
      const val = Number(tx.total_value);

      if (tx.operation_type === 'COMPRA' || tx.operation_type === 'BONIFICACAO') {
        totalQuantity += qty;
        if (tx.operation_type === 'COMPRA') {
          totalPurchasedQty += qty;
          totalPurchasedVal += val;
        }
      } else if (tx.operation_type === 'VENDA') {
        totalQuantity -= qty;
        totalSoldVal += val;
      }
    }

    // Calcula preço médio considerando apenas COMPRA
    const averagePrice = totalPurchasedQty > 0 ? (totalPurchasedVal / totalPurchasedQty) : 0;
    
    // Calcula total investido (soma de compras - soma de vendas, em valor)
    const totalInvested = totalPurchasedVal - totalSoldVal;

    if (totalQuantity <= 0) {
      tickersToDelete.push(ticker);
    } else {
      holdingsToUpsert.push({
        asset_ticker: ticker,
        asset_type: assetType,
        total_quantity: totalQuantity,
        average_price: averagePrice,
        total_invested: totalInvested,
        last_updated: new Date().toISOString(),
      });
    }
  }

  // Deleta posições zeradas
  if (tickersToDelete.length > 0) {
    await supabase
      .from('current_holdings')
      .delete()
      .in('asset_ticker', tickersToDelete);
  }

  // Upsert de posições ativas
  if (holdingsToUpsert.length > 0) {
    const { error: upsertErr } = await supabase
      .from('current_holdings')
      .upsert(holdingsToUpsert);
    if (upsertErr) throw upsertErr;
  }
}

/**
 * Reconstrói o histórico de snapshots diários/semanais (portfolio_snapshots)
 * desde a primeira transação até hoje.
 */
export async function recalculateSnapshots(): Promise<void> {
  // Busca a transação mais antiga
  const { data: firstTx, error: firstTxErr } = await supabase
    .from('investment_transactions')
    .select('operation_date')
    .order('operation_date', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (firstTxErr) throw firstTxErr;
  if (!firstTx) {
    // Se não há transações, limpa a tabela de snapshots
    await supabase.from('portfolio_snapshots').delete().neq('snapshot_date', '1970-01-01');
    return;
  }

  // Busca todas as transações para calcular em memória (evitar múltiplas queries)
  const { data: allTxs, error: allTxsErr } = await supabase
    .from('investment_transactions')
    .select('*')
    .order('operation_date', { ascending: true });

  if (allTxsErr) throw allTxsErr;
  if (!allTxs || allTxs.length === 0) return;

  const startDateStr = firstTx.operation_date as string;
  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  thirtyDaysAgo.setHours(12, 0, 0, 0);

  const datesToCalculate: string[] = [];
  const current = new Date(startDateStr + 'T12:00:00');

  while (current <= today) {
    const dateStr = current.toISOString().split('T')[0] || '';
    const isMonday = current.getDay() === 1; // Segunda-feira
    const isRecent = current >= thirtyDaysAgo;
    const isFirst = dateStr === startDateStr;
    const isToday = dateStr === (today.toISOString().split('T')[0] || '');

    // Snapshot apenas por semana (segundas-feiras) no histórico, ou diariamente nos últimos 30 dias
    if (isFirst || isToday || isMonday || isRecent) {
      datesToCalculate.push(dateStr);
    }

    current.setDate(current.getDate() + 1);
  }

  const snapshots: Snapshot[] = [];

  for (const dateStr of datesToCalculate) {
    // Filtra transações até a data de análise
    const txsUpToDate = allTxs.filter((tx) => tx.operation_date && tx.operation_date <= dateStr);

    let totalInvested = 0;
    let totalDividends = 0;

    for (const tx of txsUpToDate) {
      const val = Number(tx.total_value || 0);
      if (tx.operation_type === 'COMPRA') {
        totalInvested += val;
      } else if (tx.operation_type === 'VENDA') {
        totalInvested -= val;
      } else if (tx.operation_type === 'PROVENTO' || tx.operation_type === 'JCP') {
        totalDividends += val;
      }
    }

    snapshots.push({
      snapshot_date: dateStr,
      total_invested: totalInvested,
      total_market_value: null, // Será populado no futuro com cotações integradas
      total_dividends_received: totalDividends,
      profitability_pct: null,
    });
  }

  if (snapshots.length > 0) {
    // Limpa snapshots antigos que não estejam nas novas datas para evitar dados órfãos,
    // e faz o upsert dos novos snapshots calculados.
    const { error: upsertErr } = await supabase
      .from('portfolio_snapshots')
      .upsert(snapshots, { onConflict: 'snapshot_date' });
    if (upsertErr) throw upsertErr;
  }
}
