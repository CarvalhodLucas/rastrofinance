import { Router } from 'express';
import {
  getAnomalies,
  getTransactions,
  insertManualTransaction,
  insertManualTransactionsBatch,
  setTransactionCategoryById,
  updateTransactionById,
  deleteTransaction,
  getAllAccounts,
} from '../services/supabaseService.js';
import {
  categorizeTransactions,
  scanReceiptImage,
  scanStatementFile,
  scanStatementText,
} from '../services/claudeService.js';
import { supabase } from '../services/supabaseService.js';
import type { Transaction } from '../types.js';
import type { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { isLucasUser } from '../services/userScopeService.js';

export const transactionsRouter = Router();

/** POST /api/transactions/scan-receipt — analisa foto/print de comprovante individual com IA. */
transactionsRouter.post('/scan-receipt', async (req, res) => {
  const { image, mimeType } = req.body as { image?: string; mimeType?: string };
  if (!image) {
    res.status(400).json({ error: 'Imagem não fornecida.' });
    return;
  }
  try {
    const result = await scanReceiptImage(image, mimeType);
    res.json(result);
  } catch (err: any) {
    console.error('[transactions] scan receipt error:', err);
    const msg = err?.message || '';
    if (msg.includes('não é JSON válido')) {
      res.status(422).json({ error: 'A IA não identificou transações legíveis na imagem. Verifique se a foto ou print está nítida.' });
      return;
    }
    res.status(500).json({ error: err?.message || 'Falha ao analisar o comprovante com a IA.' });
  }
});

/** POST /api/transactions/scan-statement — analisa foto/print de extrato bancário, PDF, Excel, CSV ou texto bruto com IA. */
transactionsRouter.post('/scan-statement', async (req, res) => {
  const { image, mimeType, text } = req.body as { image?: string; mimeType?: string; text?: string };
  try {
    if (text) {
      const result = await scanStatementText(text);
      res.json(result);
      return;
    }

    if (!image) {
      res.status(400).json({ error: 'Arquivo ou texto não fornecido.' });
      return;
    }

    const result = await scanStatementFile(image, mimeType || 'image/jpeg');
    res.json(result);
  } catch (err: any) {
    console.error('[transactions] scan statement error:', err);
    res.status(500).json({ error: err.message || 'Falha ao analisar o extrato com a IA.' });
  }
});

/** POST /api/transactions/batch — cria múltiplas transações em lote. */
transactionsRouter.post('/batch', async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const { transactions } = req.body as {
    transactions?: Array<{
      date: string;
      amount: number;
      description: string;
      category?: string;
      transaction_type?: string;
      account_id?: string;
      original_currency?: string;
      original_amount?: number;
      exchange_rate?: number;
    }>;
  };
  if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
    res.status(400).json({ error: 'Lista de transações vazia ou inválida.' });
    return;
  }
  try {
    const rows = transactions.map((t, idx) => ({
      pluggy_transaction_id: `manual_batch_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      account_id: t.account_id ?? null,
      date: t.date,
      amount: Number(t.amount),
      description: t.description,
      transaction_type: t.transaction_type ?? 'DEBIT',
      category: t.category ?? null,
      original_currency: t.original_currency,
      original_amount: t.original_amount !== undefined ? Number(t.original_amount) : undefined,
      exchange_rate: t.exchange_rate !== undefined ? Number(t.exchange_rate) : undefined,
    }));
    const created = await insertManualTransactionsBatch(rows, user);
    res.status(201).json({ transactions: created, count: created.length });
  } catch (err) {
    console.error('[transactions] batch create error:', err);
    res.status(500).json({ error: 'Falha ao importar transações em lote.' });
  }
});

/** POST /api/transactions — cria transação manual (sem Pluggy). */
transactionsRouter.post('/', async (req, res) => {
  const user = (req as AuthenticatedRequest).user;
  const body = req.body as {
    date?: string;
    amount?: number;
    description?: string;
    category?: string;
    subcategory?: string;
    transaction_type?: string;
    account_id?: string;
    is_recurring?: boolean;
    original_currency?: string;
    original_amount?: number;
    exchange_rate?: number;
    sub_transactions?: import('../types.js').SubTransaction[];
  };
  if (!body.date || body.amount === undefined || !body.description) {
    res.status(400).json({ error: 'date, amount e description são obrigatórios.' });
    return;
  }
  try {
    const isCreditCard = body.transaction_type === 'CREDIT_CARD' || Array.isArray(body.sub_transactions);
    const prefix = isCreditCard ? 'credit_card' : 'manual';
    const tx = await insertManualTransaction({
      pluggy_transaction_id: `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      account_id: body.account_id ?? null,
      date: body.date,
      amount: Number(body.amount),
      description: body.description,
      transaction_type: body.transaction_type ?? 'DEBIT',
      category: body.category ?? null,
      subcategory: body.subcategory ?? null,
      is_recurring: body.is_recurring ?? false,
      original_currency: body.original_currency,
      original_amount: body.original_amount !== undefined ? Number(body.original_amount) : undefined,
      exchange_rate: body.exchange_rate !== undefined ? Number(body.exchange_rate) : undefined,
      sub_transactions: body.sub_transactions,
    }, user);
    res.status(201).json({ transaction: tx });
  } catch (err) {
    console.error('[transactions] create manual:', err);
    res.status(500).json({ error: 'Falha ao criar transação.' });
  }
});

const APPROX_BRL_PER_UNIT: Record<string, number> = {
  BRL: 1.0,
  USD: 5.5,
  EUR: 6.0,
  GBP: 7.0,
  CLP: 0.0057,
};

function computeTransferBrlAndRates(
  numAmount: number,
  srcCurrRaw: string,
  numDestAmount: number,
  destCurrRaw: string,
) {
  const srcCurr = (srcCurrRaw || 'BRL').toUpperCase();
  const destCurr = (destCurrRaw || srcCurr).toUpperCase();

  let outExchangeRate = APPROX_BRL_PER_UNIT[srcCurr] ?? 1.0;
  let inExchangeRate = APPROX_BRL_PER_UNIT[destCurr] ?? 1.0;
  let outBrlAmount = numAmount * outExchangeRate;
  let inBrlAmount = numDestAmount * inExchangeRate;

  if (srcCurr === 'BRL' && destCurr === 'BRL') {
    outExchangeRate = 1.0;
    inExchangeRate = 1.0;
    outBrlAmount = numAmount;
    inBrlAmount = numDestAmount;
  } else if (srcCurr === 'BRL' && destCurr !== 'BRL') {
    outExchangeRate = 1.0;
    outBrlAmount = numAmount;
    inExchangeRate = numDestAmount > 0 ? Number((numAmount / numDestAmount).toFixed(6)) : (APPROX_BRL_PER_UNIT[destCurr] ?? 1.0);
    inBrlAmount = numAmount;
  } else if (srcCurr !== 'BRL' && destCurr === 'BRL') {
    outExchangeRate = numAmount > 0 ? Number((numDestAmount / numAmount).toFixed(6)) : (APPROX_BRL_PER_UNIT[srcCurr] ?? 1.0);
    outBrlAmount = numDestAmount;
    inExchangeRate = 1.0;
    inBrlAmount = numDestAmount;
  }

  return {
    srcCurr,
    destCurr,
    outBrlAmount: Number(outBrlAmount.toFixed(2)),
    outExchangeRate,
    inBrlAmount: Number(inBrlAmount.toFixed(2)),
    inExchangeRate,
  };
}

async function findTransferPairById(txId: string): Promise<{
  sourceTransaction: Transaction | null;
  destinationTransaction: Transaction | null;
}> {
  const { data: txData, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', txId)
    .single();

  if (error || !txData) {
    return { sourceTransaction: null, destinationTransaction: null };
  }

  const tx = txData as Transaction;
  const pluggyId = tx.pluggy_transaction_id || '';
  const isOut = pluggyId.startsWith('transfer_out_') || (!pluggyId.startsWith('transfer_in_') && tx.amount < 0);

  let pairTx: Transaction | null = null;

  if (pluggyId.startsWith('transfer_out_')) {
    const suffix = pluggyId.slice('transfer_out_'.length);
    const { data: exact } = await supabase
      .from('transactions')
      .select('*')
      .eq('pluggy_transaction_id', `transfer_in_${suffix}`)
      .maybeSingle();
    if (exact) pairTx = exact as Transaction;
  } else if (pluggyId.startsWith('transfer_in_')) {
    const suffix = pluggyId.slice('transfer_in_'.length);
    const { data: exact } = await supabase
      .from('transactions')
      .select('*')
      .eq('pluggy_transaction_id', `transfer_out_${suffix}`)
      .maybeSingle();
    if (exact) pairTx = exact as Transaction;
  }

  if (!pairTx) {
    const { data: sameDayTxs } = await supabase
      .from('transactions')
      .select('*')
      .eq('date', tx.date)
      .neq('id', tx.id);

    const candidates = ((sameDayTxs ?? []) as Transaction[]).filter((c) => {
      const cIsTransfer =
        c.transaction_type === 'TRANSFER' ||
        c.category === 'Transferências' ||
        (c.pluggy_transaction_id || '').startsWith('transfer_');
      if (!cIsTransfer) return false;
      return isOut ? c.amount > 0 : c.amount < 0;
    });

    if (candidates.length === 1) {
      pairTx = candidates[0] ?? null;
    } else if (candidates.length > 1) {
      const txTime = tx.created_at ? new Date(tx.created_at).getTime() : 0;
      candidates.sort((a, b) => {
        const diffA = Math.abs((a.created_at ? new Date(a.created_at).getTime() : 0) - txTime);
        const diffB = Math.abs((b.created_at ? new Date(b.created_at).getTime() : 0) - txTime);
        return diffA - diffB;
      });
      pairTx = candidates[0] ?? null;
    }
  }

  return isOut
    ? { sourceTransaction: tx, destinationTransaction: pairTx }
    : { sourceTransaction: pairTx, destinationTransaction: tx };
}

/** POST /api/transactions/transfer — transfere valor entre duas contas do usuário. */
transactionsRouter.post('/transfer', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const {
      sourceAccountId,
      destinationAccountId,
      amount,
      date,
      description,
      currency,
      destinationAmount,
      destinationCurrency,
    } = req.body as {
      sourceAccountId: string;
      destinationAccountId: string;
      amount: number;
      date?: string;
      description?: string;
      currency?: string;
      destinationAmount?: number;
      destinationCurrency?: string;
    };

    if (!sourceAccountId || !destinationAccountId) {
      res.status(400).json({ error: 'Conta de origem e conta de destino são obrigatórias.' });
      return;
    }

    if (sourceAccountId === destinationAccountId) {
      res.status(400).json({ error: 'A conta de origem e destino não podem ser a mesma.' });
      return;
    }

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      res.status(400).json({ error: 'O valor da transferência deve ser maior que zero.' });
      return;
    }

    const txDate: string = date || new Date().toISOString().slice(0, 10);
    const numDestAmount = destinationAmount !== undefined && Number(destinationAmount) > 0
      ? Number(destinationAmount)
      : numAmount;

    const {
      srcCurr,
      destCurr,
      outBrlAmount,
      outExchangeRate,
      inBrlAmount,
      inExchangeRate,
    } = computeTransferBrlAndRates(numAmount, currency || 'BRL', numDestAmount, destinationCurrency || currency || 'BRL');

    // Busca dados das contas para compor as descrições automáticas
    const allAccs = await getAllAccounts(user);
    const srcAcc = allAccs.find((a) => a.id === sourceAccountId);
    const destAcc = allAccs.find((a) => a.id === destinationAccountId);

    const srcName = srcAcc?.institution_name === 'Dinheiro' ? 'Dinheiro em Espécie' : `${srcAcc?.institution_name} — ${srcAcc?.account_name}`;
    const destName = destAcc?.institution_name === 'Dinheiro' ? 'Dinheiro em Espécie' : `${destAcc?.institution_name} — ${destAcc?.account_name}`;

    const descOut = description?.trim() || `Transferência para ${destName}`;
    const descIn = description?.trim() || `Transferência de ${srcName}`;

    const transferGroupId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    // 1. Saída da conta de origem (débito)
    const outTx = await insertManualTransaction(
      {
        pluggy_transaction_id: `transfer_out_${transferGroupId}`,
        account_id: sourceAccountId,
        date: txDate,
        amount: -Math.abs(outBrlAmount),
        description: descOut,
        category: 'Transferências',
        transaction_type: 'TRANSFER',
        original_currency: srcCurr,
        original_amount: -Math.abs(numAmount),
        exchange_rate: outExchangeRate,
      },
      user,
    );

    // 2. Entrada na conta de destino (crédito)
    const inTx = await insertManualTransaction(
      {
        pluggy_transaction_id: `transfer_in_${transferGroupId}`,
        account_id: destinationAccountId,
        date: txDate,
        amount: Math.abs(inBrlAmount),
        description: descIn,
        category: 'Transferências',
        transaction_type: 'TRANSFER',
        original_currency: destCurr,
        original_amount: Math.abs(numDestAmount),
        exchange_rate: inExchangeRate,
      },
      user,
    );

    res.status(201).json({
      success: true,
      sourceTransaction: outTx,
      destinationTransaction: inTx,
    });
  } catch (err: any) {
    console.error('[transactions] transfer error:', err);
    res.status(500).json({ error: err.message || 'Falha ao realizar transferência entre contas.' });
  }
});

/** GET /api/transactions/:id/transfer-pair — retorna as duas pontas (origem e destino) de uma transferência. */
transactionsRouter.get('/:id/transfer-pair', async (req, res) => {
  try {
    const pair = await findTransferPairById(req.params.id);
    res.json(pair);
  } catch (err: any) {
    console.error('[transactions] get transfer pair error:', err);
    res.status(500).json({ error: err.message || 'Falha ao buscar dados da transferência.' });
  }
});

/** PUT /api/transactions/transfer/:id — atualiza uma transferência entre contas (ambas as pontas e saldos). */
transactionsRouter.put('/transfer/:id', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const {
      sourceAccountId,
      destinationAccountId,
      amount,
      date,
      description,
      currency,
      destinationAmount,
      destinationCurrency,
    } = req.body as {
      sourceAccountId: string;
      destinationAccountId: string;
      amount: number;
      date?: string;
      description?: string;
      currency?: string;
      destinationAmount?: number;
      destinationCurrency?: string;
    };

    if (!sourceAccountId || !destinationAccountId) {
      res.status(400).json({ error: 'Conta de origem e conta de destino são obrigatórias.' });
      return;
    }

    if (sourceAccountId === destinationAccountId) {
      res.status(400).json({ error: 'A conta de origem e destino não podem ser a mesma.' });
      return;
    }

    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      res.status(400).json({ error: 'O valor enviado deve ser maior que zero.' });
      return;
    }

    const numDestAmount = destinationAmount !== undefined && Number(destinationAmount) > 0
      ? Number(destinationAmount)
      : numAmount;

    const txDate: string = date || new Date().toISOString().slice(0, 10);
    const {
      srcCurr,
      destCurr,
      outBrlAmount,
      outExchangeRate,
      inBrlAmount,
      inExchangeRate,
    } = computeTransferBrlAndRates(numAmount, currency || 'BRL', numDestAmount, destinationCurrency || currency || 'BRL');

    const allAccs = await getAllAccounts(user);
    const srcAcc = allAccs.find((a) => a.id === sourceAccountId);
    const destAcc = allAccs.find((a) => a.id === destinationAccountId);

    const srcName = srcAcc?.institution_name === 'Dinheiro' ? 'Dinheiro em Espécie' : `${srcAcc?.institution_name} — ${srcAcc?.account_name}`;
    const destName = destAcc?.institution_name === 'Dinheiro' ? 'Dinheiro em Espécie' : `${destAcc?.institution_name} — ${destAcc?.account_name}`;

    const descOut = description?.trim() || `Transferência para ${destName}`;
    const descIn = description?.trim() || `Transferência de ${srcName}`;

    const { sourceTransaction, destinationTransaction } = await findTransferPairById(req.params.id);

    const transferGroupId = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

    let updatedOutTx: Transaction;
    if (sourceTransaction) {
      updatedOutTx = await updateTransactionById(sourceTransaction.id, {
        account_id: sourceAccountId,
        date: txDate,
        amount: -Math.abs(outBrlAmount),
        description: descOut,
        raw_description: descOut,
        category: 'Transferências',
        transaction_type: 'TRANSFER',
        original_currency: srcCurr,
        original_amount: -Math.abs(numAmount),
        exchange_rate: outExchangeRate,
      });
    } else {
      updatedOutTx = await insertManualTransaction(
        {
          pluggy_transaction_id: `transfer_out_${transferGroupId}`,
          account_id: sourceAccountId,
          date: txDate,
          amount: -Math.abs(outBrlAmount),
          description: descOut,
          category: 'Transferências',
          transaction_type: 'TRANSFER',
          original_currency: srcCurr,
          original_amount: -Math.abs(numAmount),
          exchange_rate: outExchangeRate,
        },
        user,
      );
    }

    let updatedInTx: Transaction;
    if (destinationTransaction) {
      updatedInTx = await updateTransactionById(destinationTransaction.id, {
        account_id: destinationAccountId,
        date: txDate,
        amount: Math.abs(inBrlAmount),
        description: descIn,
        raw_description: descIn,
        category: 'Transferências',
        transaction_type: 'TRANSFER',
        original_currency: destCurr,
        original_amount: Math.abs(numDestAmount),
        exchange_rate: inExchangeRate,
      });
    } else {
      updatedInTx = await insertManualTransaction(
        {
          pluggy_transaction_id: `transfer_in_${transferGroupId}`,
          account_id: destinationAccountId,
          date: txDate,
          amount: Math.abs(inBrlAmount),
          description: descIn,
          category: 'Transferências',
          transaction_type: 'TRANSFER',
          original_currency: destCurr,
          original_amount: Math.abs(numDestAmount),
          exchange_rate: inExchangeRate,
        },
        user,
      );
    }

    res.json({
      success: true,
      sourceTransaction: updatedOutTx,
      destinationTransaction: updatedInTx,
    });
  } catch (err: any) {
    console.error('[transactions] update transfer error:', err);
    res.status(500).json({ error: err.message || 'Falha ao atualizar a transferência.' });
  }
});

/** GET /api/transactions?month=YYYY-MM&category=&account= */
transactionsRouter.get('/', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { month, category, account } = req.query as Record<string, string>;
    const txs = await getTransactions({
      month,
      category,
      accountId: account,
    }, user);
    res.json({ transactions: txs });
  } catch (err) {
    console.error('[transactions] list:', err);
    res.status(500).json({ error: 'Falha ao listar transações.' });
  }
});

/** GET /api/transactions/summary?month=YYYY-MM — totais por categoria. */
transactionsRouter.get('/summary', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { month, account } = req.query as Record<string, string>;
    const txs = await getTransactions({ month, accountId: account }, user);

    const byCategory = new Map<string, number>();
    let totalSpent = 0;
    let totalIncome = 0;

    for (const t of txs) {
      // Transferências entre contas próprias não inflam o total gasto ou receita global
      if (!account && (t.transaction_type === 'TRANSFER' || t.category === 'Transferências')) {
        continue;
      }
      if (t.amount < 0) {
        totalSpent += Math.abs(t.amount);
        if (t.sub_transactions && t.sub_transactions.length > 0) {
          const rate = t.exchange_rate ?? 1;
          let allocatedBrl = 0;
          for (const sub of t.sub_transactions) {
            const subBrl = Math.abs(Number(sub.amount) || 0) * rate;
            allocatedBrl += subBrl;
            const subCat = sub.category || t.category || 'Cartão de Crédito';
            byCategory.set(subCat, (byCategory.get(subCat) ?? 0) + subBrl);
          }
          const diff = Math.abs(t.amount) - allocatedBrl;
          if (diff > 0.01) {
            const fallbackCat = t.category ?? 'Cartão de Crédito';
            byCategory.set(fallbackCat, (byCategory.get(fallbackCat) ?? 0) + diff);
          }
        } else {
          const cat = t.category ?? 'Outros';
          byCategory.set(cat, (byCategory.get(cat) ?? 0) + Math.abs(t.amount));
        }
      } else {
        totalIncome += t.amount;
      }
    }

    res.json({
      totalSpent,
      totalIncome,
      balance: totalIncome - totalSpent,
      count: txs.length,
      byCategory: [...byCategory.entries()]
        .map(([category, total]) => ({ category, total }))
        .sort((a, b) => b.total - a.total),
    });
  } catch (err) {
    console.error('[transactions] summary:', err);
    res.status(500).json({ error: 'Falha ao gerar o resumo.' });
  }
});

/** GET /api/transactions/anomalies — transações marcadas como anômalas. */
transactionsRouter.get('/anomalies', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!isLucasUser(user)) {
      res.json({ anomalies: [] });
      return;
    }
    const anomalies = await getAnomalies();
    res.json({ anomalies });
  } catch (err) {
    console.error('[transactions] anomalies:', err);
    res.status(500).json({ error: 'Falha ao listar anomalias.' });
  }
});

/**
 * PATCH /api/transactions/:id/category — correção manual de categoria.
 * Body: { category: string, subcategory?: string }
 */
transactionsRouter.patch('/:id/category', async (req, res) => {
  const { category, subcategory } = req.body as {
    category?: string;
    subcategory?: string;
  };
  if (!category) {
    res.status(400).json({ error: 'category é obrigatório.' });
    return;
  }
  try {
    const updated = await setTransactionCategoryById(
      req.params.id,
      category,
      subcategory ?? null,
    );
    res.json({ transaction: updated });
  } catch (err) {
    console.error('[transactions] patch category:', err);
    res.status(500).json({ error: 'Falha ao atualizar a categoria.' });
  }
});

/** POST /api/transactions/:id/recategorize — recategoriza via IA. */
transactionsRouter.post('/:id/recategorize', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error || !data) {
      res.status(404).json({ error: 'Transação não encontrada.' });
      return;
    }

    const [result] = await categorizeTransactions([data as Transaction]);
    if (!result) {
      res.status(500).json({ error: 'IA não retornou categorização.' });
      return;
    }

    const { data: updated, error: updErr } = await supabase
      .from('transactions')
      .update({
        category: result.category,
        subcategory: result.subcategory,
        is_essential: result.is_essential,
        is_recurring: result.is_recurring,
        merchant_name: result.merchant_name,
        ai_confidence: result.ai_confidence,
        ai_notes: result.ai_notes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();
    if (updErr) throw updErr;

    res.json({ transaction: updated });
  } catch (err) {
    console.error('[transactions] recategorize:', err);
    res.status(500).json({ error: 'Falha ao recategorizar.' });
  }
});

/** PUT /api/transactions/:id — atualiza uma transação inteira. */
transactionsRouter.put('/:id', async (req, res) => {
  try {
    const updated = await updateTransactionById(req.params.id, req.body);
    res.json({ transaction: updated });
  } catch (err) {
    console.error('[transactions] update:', err);
    res.status(500).json({ error: 'Falha ao atualizar a transação.' });
  }
});

/** DELETE /api/transactions/:id — exclui uma transação. */
transactionsRouter.delete('/:id', async (req, res) => {
  try {
    await deleteTransaction(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    console.error('[transactions] delete:', err);
    res.status(500).json({ error: 'Falha ao excluir a transação.' });
  }
});
