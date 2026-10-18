import { Router } from 'express';
import {
  getAnomalies,
  getTransactions,
  insertManualTransaction,
  insertManualTransactionsBatch,
  setTransactionCategoryById,
  updateTransactionById,
  deleteTransaction,
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
  } catch (err) {
    console.error('[transactions] scan receipt error:', err);
    res.status(500).json({ error: 'Falha ao analisar o comprovante com a IA.' });
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
    transaction_type?: string;
    account_id?: string;
    is_recurring?: boolean;
    original_currency?: string;
    original_amount?: number;
    exchange_rate?: number;
  };
  if (!body.date || body.amount === undefined || !body.description) {
    res.status(400).json({ error: 'date, amount e description são obrigatórios.' });
    return;
  }
  try {
    const tx = await insertManualTransaction({
      pluggy_transaction_id: `manual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      account_id: body.account_id ?? null,
      date: body.date,
      amount: Number(body.amount),
      description: body.description,
      transaction_type: body.transaction_type ?? 'DEBIT',
      category: body.category ?? null,
      is_recurring: body.is_recurring ?? false,
      original_currency: body.original_currency,
      original_amount: body.original_amount !== undefined ? Number(body.original_amount) : undefined,
      exchange_rate: body.exchange_rate !== undefined ? Number(body.exchange_rate) : undefined,
    }, user);
    res.status(201).json({ transaction: tx });
  } catch (err) {
    console.error('[transactions] create manual:', err);
    res.status(500).json({ error: 'Falha ao criar transação.' });
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
      if (t.amount < 0) {
        totalSpent += Math.abs(t.amount);
        const cat = t.category ?? 'Outros';
        byCategory.set(cat, (byCategory.get(cat) ?? 0) + Math.abs(t.amount));
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
