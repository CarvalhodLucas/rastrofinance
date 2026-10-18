import { Router } from 'express';
import multer from 'multer';
import { parseB3File } from '../services/b3ExtractParser.js';
import { interpretB3Rows } from '../services/deepseekService.js';
import { recalculateHoldings, recalculateSnapshots } from '../services/portfolioSnapshotService.js';
import { supabase } from '../services/supabaseService.js';

export const portfolioImportRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // limite de 10MB
});

// Middleware auxiliar para tratar erros assíncronos no Express
const asyncHandler = (fn: any) => (req: any, res: any, next: any) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

portfolioImportRouter.post(
  '/upload',
  upload.single('file'),
  asyncHandler(async (req: any, res: any) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const { originalname, buffer } = req.file;

    // 1. Cria registro em import_batches com status PROCESSING
    const { data: batch, error: batchErr } = await supabase
      .from('import_batches')
      .insert({
        filename: originalname,
        status: 'PROCESSING',
      })
      .select()
      .single();

    if (batchErr) throw batchErr;

    try {
      // 2. Lê Excel/CSV
      const parsedData = parseB3File(buffer, originalname);
      
      if (parsedData.totalRows === 0) {
        await supabase
          .from('import_batches')
          .update({ status: 'ERROR', error_message: 'Nenhuma linha encontrada no arquivo.' })
          .eq('id', batch.id);
        return res.status(400).json({ error: 'Nenhuma linha de transação encontrada na planilha.' });
      }

      // 3. Chama DeepSeek API em batches de 30
      const aiResult = await interpretB3Rows(parsedData.headers, parsedData.rows);

      const allParsed = [...aiResult.parsed, ...aiResult.needsReview];

      if (allParsed.length === 0) {
        await supabase
          .from('import_batches')
          .update({ status: 'ERROR', error_message: 'Nenhuma transação interpretada pela IA.' })
          .eq('id', batch.id);
        return res.status(400).json({ error: 'Não conseguimos identificar transações neste arquivo. Verifique se é o Extrato de Negociação correto.' });
      }

      // Determina o período do lote
      const dates = allParsed.map(t => new Date(t.operation_date).getTime()).filter(t => !isNaN(t));
      let period_start = null;
      let period_end = null;
      if (dates.length > 0) {
        period_start = new Date(Math.min(...dates)).toISOString().split('T')[0];
        period_end = new Date(Math.max(...dates)).toISOString().split('T')[0];
      }

      // 4. Salva as transações em investment_transactions associadas ao batch
      const txsToInsert = allParsed.map(tx => ({
        asset_ticker: tx.asset_ticker,
        asset_name: tx.asset_name,
        asset_type: tx.asset_type,
        operation_type: tx.operation_type,
        quantity: tx.quantity,
        unit_price: tx.unit_price,
        total_value: tx.total_value,
        fees: tx.fees,
        broker: tx.broker,
        operation_date: tx.operation_date,
        source: 'B3_IMPORT',
        import_batch_id: batch.id,
        raw_data: {
          original_row: tx.raw_data,
          confidence: tx.confidence,
          needs_review: tx.needs_review
        }
      }));

      const { error: txErr } = await supabase
        .from('investment_transactions')
        .insert(txsToInsert);

      if (txErr) throw txErr;

      // 5. Atualiza o lote para PREVIEW
      await supabase
        .from('import_batches')
        .update({
          status: 'PREVIEW',
          period_start,
          period_end,
          total_rows_found: allParsed.length,
        })
        .eq('id', batch.id);

      return res.json({
        batchId: batch.id,
        parsed: aiResult.parsed,
        needsReview: aiResult.needsReview,
        totalRows: allParsed.length,
      });

    } catch (error: any) {
      await supabase
        .from('import_batches')
        .update({ status: 'ERROR', error_message: error.message })
        .eq('id', batch.id);
      throw error;
    }
  })
);

portfolioImportRouter.get(
  '/:batchId/preview',
  asyncHandler(async (req: any, res: any) => {
    const { batchId } = req.params;

    const { data: batch, error: batchErr } = await supabase
      .from('import_batches')
      .select('*')
      .eq('id', batchId)
      .maybeSingle();

    if (batchErr) throw batchErr;
    if (!batch) {
      return res.status(404).json({ error: 'Lote não encontrado.' });
    }

    const { data: txs, error: txsErr } = await supabase
      .from('investment_transactions')
      .select('*')
      .eq('import_batch_id', batchId);

    if (txsErr) throw txsErr;

    const parsed: any[] = [];
    const needsReview: any[] = [];

    for (const tx of (txs || [])) {
      const rawMeta = tx.raw_data || {};
      const mapped = {
        asset_ticker: tx.asset_ticker,
        asset_name: tx.asset_name,
        asset_type: tx.asset_type,
        operation_type: tx.operation_type,
        quantity: Number(tx.quantity),
        unit_price: tx.unit_price ? Number(tx.unit_price) : null,
        total_value: Number(tx.total_value),
        fees: Number(tx.fees),
        broker: tx.broker,
        operation_date: tx.operation_date,
        confidence: rawMeta.confidence ?? 1.0,
        needs_review: rawMeta.needs_review ?? false,
        raw_data: rawMeta.original_row
      };

      if (mapped.needs_review) {
        needsReview.push(mapped);
      } else {
        parsed.push(mapped);
      }
    }

    return res.json({
      batchId,
      parsed,
      needsReview,
      totalRows: txs?.length || 0,
    });
  })
);

portfolioImportRouter.post(
  '/:batchId/confirm',
  asyncHandler(async (req: any, res: any) => {
    const { batchId } = req.params;
    const { transactions } = req.body;

    if (!Array.isArray(transactions)) {
      return res.status(400).json({ error: 'O corpo da requisição deve conter um array de transações.' });
    }

    // 1. Limpa as antigas para reinserir as confirmadas/editadas
    const { error: deleteErr } = await supabase
      .from('investment_transactions')
      .delete()
      .eq('import_batch_id', batchId);

    if (deleteErr) throw deleteErr;

    // 2. Insere as novas revisadas pelo usuário
    const txsToInsert = transactions.map(tx => ({
      asset_ticker: tx.asset_ticker.toUpperCase(),
      asset_name: tx.asset_name,
      asset_type: tx.asset_type,
      operation_type: tx.operation_type,
      quantity: tx.quantity,
      unit_price: tx.unit_price,
      total_value: tx.total_value,
      fees: tx.fees || 0,
      broker: tx.broker,
      operation_date: tx.operation_date,
      source: 'B3_IMPORT',
      import_batch_id: batchId,
      raw_data: {
        original_row: tx.raw_data,
        confidence: tx.confidence ?? 1.0,
        needs_review: false
      }
    }));

    const { error: insertErr } = await supabase
      .from('investment_transactions')
      .insert(txsToInsert);

    if (insertErr) throw insertErr;

    // 3. Atualiza o status do lote
    const { error: batchErr } = await supabase
      .from('import_batches')
      .update({
        status: 'CONFIRMED',
        total_rows_imported: txsToInsert.length,
      })
      .eq('id', batchId);

    if (batchErr) throw batchErr;

    // 4. Recalcula carteira consolidada
    await recalculateHoldings();

    // 5. Recalcula snapshots históricos
    await recalculateSnapshots();

    // 6. Resume
    let totalInvestedBatch = 0;
    for (const tx of txsToInsert) {
      if (tx.operation_type === 'COMPRA') {
        totalInvestedBatch += Number(tx.total_value);
      } else if (tx.operation_type === 'VENDA') {
        totalInvestedBatch -= Number(tx.total_value);
      }
    }

    const { count: holdingsCount, error: countErr } = await supabase
      .from('current_holdings')
      .select('*', { count: 'exact', head: true });

    if (countErr) throw countErr;

    return res.json({
      imported: txsToInsert.length,
      newHoldings: holdingsCount || 0,
      totalInvested: totalInvestedBatch,
    });
  })
);

portfolioImportRouter.delete(
  '/:batchId',
  asyncHandler(async (req: any, res: any) => {
    const { batchId } = req.params;

    // Remove transações salvas temporariamente
    await supabase
      .from('investment_transactions')
      .delete()
      .eq('import_batch_id', batchId);

    // Remove lote
    await supabase
      .from('import_batches')
      .delete()
      .eq('id', batchId);

    return res.json({ ok: true });
  })
);

portfolioImportRouter.get(
  '/history',
  asyncHandler(async (req: any, res: any) => {
    const { data: batches, error } = await supabase
      .from('import_batches')
      .select('*')
      .eq('status', 'CONFIRMED')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return res.json(batches || []);
  })
);
