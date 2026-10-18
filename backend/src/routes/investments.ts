import { Router } from 'express';
import {
  deleteInvestment,
  getAllInvestments,
  getSetting,
  updateSetting,
  upsertInvestment,
} from '../services/supabaseService.js';
import { getBinanceTradeHistory, syncBinancePortfolio } from '../services/binanceService.js';
import { syncAllPluggyInvestments } from '../services/pluggyService.js';
import { getDividendsFromReport, syncDividendsToTransactions } from '../services/dividendService.js';
import {
  getUsdBrlRate,
  getEurBrlRate,
  processQuoteTicker,
  getWatchlistData,
  DEFAULT_WATCHLIST_ITEMS,
  type WatchlistItem,
  getPriceAlerts,
  savePriceAlert,
  deletePriceAlert,
  type PriceAlert,
} from '../services/quoteService.js';
import { getBinanceExcelTradeHistory, syncBinanceExcelReport } from '../services/binanceReportService.js';
import {
  getAllInvestmentTrades,
  recordInvestmentTrade,
  recompileAllTrades,
  mergeBinanceApiTrades,
  sellInvestmentPosition,
  deleteInvestmentTrade,
  updateInvestmentTrade,
  syncManualTradeDate,
} from '../services/tradeService.js';
import type { AssetType, Investment, InvestmentSummary } from '../types.js';
import { env } from '../config/env.js';
import { getPortfolioEvolution } from '../services/evolutionService.js';
import { getRealizedOperations } from '../services/realizedService.js';
import { runUpdateQuotesJob } from '../jobs/updateQuotesJob.js';
import { applyMonthlyYields } from '../services/yieldService.js';
import type { AuthenticatedRequest } from '../middleware/authMiddleware.js';
import { getUserSettingKey, isLucasUser } from '../services/userScopeService.js';

export const investmentsRouter = Router();

/**
 * GET /api/investments — Lista todos os ativos de investimento e resumo consolidado.
 */
investmentsRouter.get('/', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const investments = await getAllInvestments(user);
    const [usdBrlRate, eurBrlRate] = await Promise.all([
      getUsdBrlRate(),
      getEurBrlRate(),
    ]);

    let totalNetWorth = 0;
    let totalInvested = 0;

    const typeTotals: Record<string, number> = {
      CRYPTO: 0,
      STOCK: 0,
      FII: 0,
      FIXED_INCOME: 0,
      OTHER: 0,
    };

    const instTotals: Record<string, number> = {};

    for (const inv of investments) {
      // Considerar apenas posições ativas com quantidade > 0 e que não sejam histórico de vendas encerradas
      if (inv.quantity <= 0 || inv.sync_source === 'GORILA_CLOSED') continue;

      const ticker = (inv.code_ticker || '').toUpperCase();
      const isUsd =
        inv.currency === 'USD' ||
        inv.currency === 'USDT' ||
        inv.asset_type === 'CRYPTO' ||
        inv.institution?.toUpperCase() === 'BINANCE' ||
        ticker.includes('WISE_USD');

      const isEur =
        inv.currency === 'EUR' ||
        ticker.includes('WISE_EUR');

      const currencyMultiplier = isUsd ? usdBrlRate : isEur ? eurBrlRate : 1.0;

      const rawVal = inv.total_value ?? (inv.quantity * (inv.current_price || inv.average_price || 0));
      const rawInvst = (inv.quantity ?? 0) * (inv.average_price || inv.current_price || 0);

      const valBrl = rawVal * currencyMultiplier;
      const invstBrl = rawInvst * currencyMultiplier;

      totalNetWorth += valBrl;
      totalInvested += invstBrl;

      const typeKey = inv.asset_type || 'OTHER';
      typeTotals[typeKey] = (typeTotals[typeKey] || 0) + valBrl;

      const instKey = inv.institution || 'Manual';
      instTotals[instKey] = (instTotals[instKey] || 0) + valBrl;
    }

    const totalProfitLoss = totalNetWorth - totalInvested;
    const profitLossPct = totalInvested > 0 ? (totalProfitLoss / totalInvested) * 100 : 0;

    const byAssetType = Object.entries(typeTotals)
      .filter(([_, total]) => total > 0)
      .map(([type, total]) => ({
        type: type as AssetType,
        total,
        percentage: totalNetWorth > 0 ? (total / totalNetWorth) * 100 : 0,
      }));

    const byInstitution = Object.entries(instTotals)
      .filter(([_, total]) => total > 0)
      .map(([institution, total]) => ({
        institution,
        total,
        percentage: totalNetWorth > 0 ? (total / totalNetWorth) * 100 : 0,
      }));

    const summary: InvestmentSummary = {
      total_net_worth: totalNetWorth,
      total_invested: totalInvested,
      total_profit_loss: totalProfitLoss,
      profit_loss_pct: profitLossPct,
      by_asset_type: byAssetType,
      by_institution: byInstitution,
    };

    res.json({ investments, summary });
  } catch (err) {
    console.error('[investments] GET error:', err);
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'object' && err && 'message' in err
        ? String((err as Record<string, unknown>).message)
        : 'Falha ao buscar ativos de investimento.';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/investments — Adiciona ou atualiza investimento manualmente.
 */
investmentsRouter.post('/', async (req, res) => {
  try {
    const {
      name,
      code_ticker,
      asset_type,
      institution,
      quantity,
      average_price,
      current_price,
      currency,
      yield_rate,
      yield_frequency,
      date,
    } = req.body;

    if (!name || !code_ticker || !asset_type) {
      res.status(400).json({ error: 'Nome, Ticker e Tipo de ativo são obrigatórios.' });
      return;
    }

    const qty = parseFloat(quantity) || 0;
    const avgPrice = parseFloat(average_price) || 0;
    const curPrice = parseFloat(current_price) || avgPrice;
    const totalVal = qty * curPrice;
    const tradeDate = date ? new Date(date).toISOString() : new Date().toISOString();

    const user = (req as AuthenticatedRequest).user;
    const investment = await upsertInvestment({
      name,
      code_ticker: code_ticker.toUpperCase(),
      asset_type,
      institution: institution || 'Manual',
      quantity: qty,
      average_price: avgPrice,
      current_price: curPrice,
      total_value: totalVal,
      currency: currency || 'BRL',
      sync_source: 'MANUAL',
      yield_rate: yield_rate !== undefined && yield_rate !== '' ? parseFloat(yield_rate) : undefined,
      yield_frequency: yield_frequency || 'MONTHLY',
      last_synced_at: new Date().toISOString(),
      created_at: tradeDate,
    }, user);

    // Registrar no histórico de transações unificado
    await recordInvestmentTrade({
      trade_type: 'BUY',
      asset_type,
      ticker: code_ticker.toUpperCase(),
      asset_name: name,
      institution: institution || 'Manual',
      quantity: qty,
      unit_price: avgPrice || curPrice,
      total_value: qty * (avgPrice || curPrice),
      date: tradeDate,
      source: 'MANUAL',
      notes: 'Aporte manual cadastrado',
    }, user);

    res.json({ investment });
  } catch (err) {
    console.error('[investments] POST error:', err);
    res.status(500).json({ error: 'Falha ao criar/atualizar investimento.' });
  }
});

/**
 * PUT /api/investments/:id — Edita um ativo existente.
 */
investmentsRouter.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { date, ...body } = req.body;

    const qty = body.quantity !== undefined ? parseFloat(body.quantity) : undefined;
    const avgPrice = body.average_price !== undefined ? parseFloat(body.average_price) : undefined;
    const curPrice = body.current_price !== undefined ? parseFloat(body.current_price) : undefined;
    const yieldRate = body.yield_rate !== undefined && body.yield_rate !== '' ? parseFloat(body.yield_rate) : (body.yield_rate === '' ? 0 : undefined);
    const yieldFreq = body.yield_frequency;

    let sync_source = body.sync_source;
    if (avgPrice !== undefined || curPrice !== undefined) {
      const srcPrefix = (sync_source || 'MANUAL').split('#')[0];
      const a = avgPrice ?? 0;
      const c = curPrice ?? a;
      sync_source = `${srcPrefix}#${a}#${c}`;
    }

    const payload: Partial<Investment> = {
      id,
      ...body,
      ...(qty !== undefined ? { quantity: qty } : {}),
      ...(avgPrice !== undefined ? { average_price: avgPrice } : {}),
      ...(curPrice !== undefined ? { current_price: curPrice } : {}),
      ...(sync_source !== undefined ? { sync_source } : {}),
      ...(yieldRate !== undefined ? { yield_rate: yieldRate } : {}),
      ...(yieldFreq !== undefined ? { yield_frequency: yieldFreq } : {}),
    };

    if (date) {
      const tradeDate = new Date(date).toISOString();
      payload.created_at = tradeDate;
    }

    if (qty !== undefined && (curPrice !== undefined || avgPrice !== undefined)) {
      const finalPrice = curPrice !== undefined ? curPrice : (avgPrice ?? 0);
      payload.total_value = qty * finalPrice;
    }

    const user = (req as AuthenticatedRequest).user;
    const updated = await upsertInvestment(payload, user);

    if (date && updated.code_ticker) {
      const tradeDate = new Date(date).toISOString();
      await syncManualTradeDate(updated.code_ticker, tradeDate, {
        asset_type: updated.asset_type,
        asset_name: updated.name,
        institution: updated.institution,
        quantity: updated.quantity,
        unit_price: updated.average_price || updated.current_price,
      }, user);
    }

    res.json({ investment: updated });
  } catch (err: any) {
    console.error('[investments] PUT error:', err);
    res.status(500).json({ error: err?.message || 'Falha ao atualizar investimento.' });
  }
});

/**
 * POST /api/investments/apply-yields — Aplica rendimento mensal para todos os ativos com taxa configurada.
 */
investmentsRouter.post('/apply-yields', async (req, res) => {
  try {
    const force = req.body?.force === true;
    const result = await applyMonthlyYields(undefined, force);
    res.json({ ok: true, ...result });
  } catch (err: any) {
    console.error('[investments] apply-yields error:', err);
    res.status(500).json({ error: err.message || 'Falha ao processar rendimentos mensais.' });
  }
});

/**
 * POST /api/investments/:id/apply-yield — Aplica rendimento do mês imediatamente para um ativo específico.
 */
investmentsRouter.post('/:id/apply-yield', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await applyMonthlyYields(id, true);
    res.json({ ok: true, ...result });
  } catch (err: any) {
    console.error('[investments] apply-yield individual error:', err);
    res.status(500).json({ error: err.message || 'Falha ao aplicar rendimento do ativo.' });
  }
});

/**
 * DELETE /api/investments/:id — Deleta um ativo.
 */
investmentsRouter.delete('/:id', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    await deleteInvestment(req.params.id, user);
    res.json({ ok: true });
  } catch (err) {
    console.error('[investments] DELETE error:', err);
    res.status(500).json({ error: 'Falha ao excluir investimento.' });
  }
});

/**
 * POST /api/investments/sync/binance — Sincroniza saldo e cotação da Binance via API.
 */
investmentsRouter.post('/sync/binance', async (req, res) => {
  try {
    let { apiKey, apiSecret } = req.body as { apiKey?: string; apiSecret?: string };

    if (!apiKey || !apiSecret) {
      // Tenta recuperar do process.env primeiro (permite ler alterações recentes sem reiniciar servidor)
      apiKey = process.env.BINANCE_API_KEY || env.BINANCE_API_KEY || undefined;
      apiSecret = process.env.BINANCE_SECRET_KEY || env.BINANCE_SECRET_KEY || undefined;

      if (!apiKey || !apiSecret) {
        // Tenta recarregar .env dinamicamente da raiz e da pasta backend
        const dotenv = await import('dotenv');
        const path = await import('path');
        dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });
        dotenv.config({ path: path.resolve(process.cwd(), '.env') });
        apiKey = process.env.BINANCE_API_KEY || undefined;
        apiSecret = process.env.BINANCE_SECRET_KEY || undefined;
      }

      // Se não tiver no .env, tenta recuperar das configurações salvas no banco
      if (!apiKey || !apiSecret) {
        apiKey = (await getSetting<string>('binance_api_key')) ?? undefined;
        apiSecret = (await getSetting<string>('binance_secret_key')) ?? undefined;
      }
    } else {
      // Salva para syncs futuros
      await updateSetting('binance_api_key', apiKey);
      await updateSetting('binance_secret_key', apiSecret);
    }

    if (!apiKey || !apiSecret) {
      res.status(400).json({
        error: 'Chaves API da Binance não informadas nem configuradas nas Opções.',
      });
      return;
    }

    const synced = await syncBinancePortfolio(apiKey, apiSecret);
    const activeTickers = Array.from(new Set(synced.map((i) => i.code_ticker)));
    
    // Atualiza automaticamente o histórico (extrato) com as novas movimentações
    await mergeBinanceApiTrades(apiKey, apiSecret, activeTickers);

    res.json({ ok: true, synced_count: synced.length, investments: synced });
  } catch (err) {
    console.error('[investments] sync Binance error:', err);
    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'object' && err && 'message' in err
        ? String((err as Record<string, unknown>).message)
        : 'Falha na sincronização com Binance.';
    res.status(500).json({ error: message });
  }
});

/**
 * POST /api/investments/import/b3 — Importa ativos do relatório de custódia da B3 em lote.
 */
investmentsRouter.post('/import/b3', async (req, res) => {
  try {
    const { items } = req.body as {
      items?: Array<{
        name: string;
        ticker: string;
        type?: AssetType;
        institution?: string;
        quantity: number;
        averagePrice?: number;
        currentPrice?: number;
      }>;
    };

    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Nenhum ativo válido informado para importação.' });
      return;
    }

    const imported: Investment[] = [];

    for (const item of items) {
      const qty = Number(item.quantity) || 0;
      const avgPrice = Number(item.averagePrice) || 0;
      const curPrice = Number(item.currentPrice) || avgPrice;
      const totalVal = qty * curPrice;

      let assetType: AssetType = item.type || 'STOCK';
      const tickerUpper = (item.ticker || '').toUpperCase();

      if (!item.type) {
        if (tickerUpper.endsWith('11')) {
          assetType = 'FII';
        } else if (tickerUpper.includes('TESOURO') || tickerUpper.includes('CDB') || tickerUpper.includes('LCI')) {
          assetType = 'FIXED_INCOME';
        }
      }

      const inv = await upsertInvestment({
        name: item.name || tickerUpper,
        code_ticker: tickerUpper,
        asset_type: assetType,
        institution: item.institution || 'B3',
        quantity: qty,
        average_price: avgPrice,
        current_price: curPrice,
        total_value: totalVal,
        currency: 'BRL',
        sync_source: 'B3_IMPORT',
        last_synced_at: new Date().toISOString(),
      });

      imported.push(inv);
    }

    res.json({ ok: true, count: imported.length, investments: imported });
  } catch (err) {
    console.error('[investments] import B3 error:', err);
    res.status(500).json({ error: 'Falha ao importar relatório da B3.' });
  }
});

/**
 * POST /api/investments/sync/b3 — Dispara sincronização via Open Finance Pluggy das contas conectadas B3/Corretoras.
 */
investmentsRouter.post('/sync/b3', async (_req, res) => {
  try {
    const investments = await syncAllPluggyInvestments();
    res.json({ ok: true, count: investments.length, investments });
  } catch (err) {
    console.error('[investments] sync B3 error:', err);
    res.status(500).json({ error: 'Falha ao sincronizar B3 / Corretoras via Open Finance.' });
  }
});

/**
 * GET /api/investments/quote — Endpoint de cotação com Yahoo Finance2 e Cache (lógica RASTRO).
 */
investmentsRouter.get('/quote', async (req, res) => {
  try {
    const tickerParam = (req.query.ticker as string) || '';
    const mode = (req.query.mode as 'compact' | 'full') || 'full';

    if (!tickerParam) {
      res.status(400).json({ error: 'Ticker não foi enviado na URL.' });
      return;
    }

    const tickers = tickerParam
      .split(',')
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean);

    const isBatch = tickers.length > 1;

    if (isBatch) {
      const results = await Promise.all(
        tickers.map((t) => processQuoteTicker(t, mode)),
      );
      res.json(results);
    } else {
      const firstTicker = tickers[0];
      if (!firstTicker) {
        res.status(400).json({ error: 'Ticker não informado.' });
        return;
      }
      const result = await processQuoteTicker(firstTicker, mode);
      res.json(result);
    }
  } catch (err: any) {
    console.error('[investments] GET quote error:', err);
    res.status(500).json({ error: err.message || 'Falha ao buscar cotação de mercado.' });
  }
});

/**
 * GET /api/investments/watchlist — Lista completa unificada de acompanhamento (Bolsa B3 + Binance Cripto) com sparklines e status.
 */
investmentsRouter.get('/watchlist', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const bypassCache = req.query.refresh === 'true';
    const data = await getWatchlistData(undefined, bypassCache, user);
    res.json(data);
  } catch (err: any) {
    console.error('[investments] GET watchlist error:', err);
    res.status(500).json({ error: err.message || 'Falha ao carregar lista de acompanhamento.' });
  }
});

/**
 * POST /api/investments/watchlist — Salva/reordena a lista de ativos de acompanhamento.
 */
investmentsRouter.post('/watchlist', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { items } = req.body;
    if (!Array.isArray(items)) {
      res.status(400).json({ error: 'Array "items" é obrigatório.' });
      return;
    }
    const watchlistKey = getUserSettingKey('watchlist_items', user);
    await updateSetting(watchlistKey, items);
    const data = await getWatchlistData(items, true, user);
    res.json({ ok: true, data });
  } catch (err: any) {
    console.error('[investments] POST watchlist error:', err);
    res.status(500).json({ error: err.message || 'Falha ao salvar lista de acompanhamento.' });
  }
});

/**
 * POST /api/investments/watchlist/add — Adiciona um novo ativo na lista de acompanhamento.
 */
investmentsRouter.post('/watchlist/add', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { ticker, type, name } = req.body;
    if (!ticker) {
      res.status(400).json({ error: 'Ticker é obrigatório.' });
      return;
    }
    const cleanTicker = ticker.trim().toUpperCase();
    const watchlistKey = getUserSettingKey('watchlist_items', user);
    const current = (await getSetting<WatchlistItem[]>(watchlistKey)) || [];
    const exists = current.some((it) => it.ticker.toUpperCase() === cleanTicker || it.ticker.replace(/\.SA$/, '').toUpperCase() === cleanTicker);
    if (exists) {
      res.status(400).json({ error: 'Este ativo já está na sua lista de acompanhamento.' });
      return;
    }

    const newItem: WatchlistItem = {
      ticker: cleanTicker,
      type: type || (cleanTicker.endsWith('11') || /^[A-Z]{4}[0-9]{1,2}$/.test(cleanTicker) ? 'STOCK' : 'CRYPTO'),
      name: name || undefined,
    };
    const updated = [newItem, ...current];
    await updateSetting(watchlistKey, updated);
    const data = await getWatchlistData(updated, true, user);
    res.json({ ok: true, data });
  } catch (err: any) {
    console.error('[investments] POST watchlist/add error:', err);
    res.status(500).json({ error: err.message || 'Falha ao adicionar ativo à lista.' });
  }
});

/**
 * DELETE /api/investments/watchlist/:symbol — Remove um ativo da lista de acompanhamento.
 */
investmentsRouter.delete('/watchlist/:symbol', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { symbol } = req.params;
    const clean = symbol.trim().toUpperCase();
    const watchlistKey = getUserSettingKey('watchlist_items', user);
    const current = (await getSetting<WatchlistItem[]>(watchlistKey)) || [];
    const updated = current.filter(
      (it) => it.ticker.toUpperCase() !== clean && it.ticker.replace(/\.SA$/, '').toUpperCase() !== clean,
    );
    await updateSetting(watchlistKey, updated);
    const data = await getWatchlistData(updated, true, user);
    res.json({ ok: true, data });
  } catch (err: any) {
    console.error('[investments] DELETE watchlist error:', err);
    res.status(500).json({ error: err.message || 'Falha ao remover ativo da lista.' });
  }
});

/**
 * GET /api/investments/watchlist/alerts — Lista todos os alertas de preço cadastrados.
 */
investmentsRouter.get('/watchlist/alerts', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const alerts = await getPriceAlerts(user);
    res.json({ alerts });
  } catch (err: any) {
    console.error('[investments] GET watchlist/alerts error:', err);
    res.status(500).json({ error: err.message || 'Falha ao buscar alertas.' });
  }
});

/**
 * POST /api/investments/watchlist/alerts — Cadastra um novo alerta de preço.
 */
investmentsRouter.post('/watchlist/alerts', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { ticker, targetPrice, condition, currency, note } = req.body;
    if (!ticker || targetPrice === undefined || !condition) {
      res.status(400).json({ error: 'Ticker, targetPrice e condition são obrigatórios.' });
      return;
    }

    const alert = await savePriceAlert({
      ticker: ticker.trim().toUpperCase(),
      targetPrice: parseFloat(targetPrice),
      condition: condition === 'BELOW' ? 'BELOW' : 'ABOVE',
      currency: currency || (ticker.trim().toUpperCase().endsWith('11') || /^[A-Z]{4}[0-9]{1,2}$/.test(ticker.trim().toUpperCase()) ? 'BRL' : 'USD'),
      note: note || undefined,
    }, user);

    res.json({ ok: true, alert });
  } catch (err: any) {
    console.error('[investments] POST watchlist/alerts error:', err);
    res.status(500).json({ error: err.message || 'Falha ao cadastrar alerta de preço.' });
  }
});

/**
 * DELETE /api/investments/watchlist/alerts/:id — Remove um alerta de preço.
 */
investmentsRouter.delete('/watchlist/alerts/:id', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { id } = req.params;
    await deletePriceAlert(id, user);
    res.json({ ok: true });
  } catch (err: any) {
    console.error('[investments] DELETE watchlist/alerts error:', err);
    res.status(500).json({ error: err.message || 'Falha ao remover alerta.' });
  }
});

/**
 * POST /api/investments/update-quotes — Atualiza os preços atuais de todos os ativos no banco usando o Yahoo Finance2.
 */
investmentsRouter.post('/update-quotes', async (_req, res) => {
  try {
    const updatedCount = await runUpdateQuotesJob();
    res.json({ ok: true, updated_count: updatedCount });
  } catch (err: any) {
    console.error('[investments] POST update-quotes error:', err);
    res.status(500).json({ error: err.message || 'Falha ao atualizar cotações.' });
  }
});
/**
 * GET /api/investments/binance-history — Retorna todo o histórico de compras/conversões do arquivo Excel da Binance.
 */
investmentsRouter.get('/binance-history', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!isLucasUser(user)) {
      res.json({ history: [] });
      return;
    }

    const fs = await import('fs');
    const path = await import('path');
    const rootDir = process.cwd();
    const files = fs.readdirSync(rootDir);
    const binanceFile = files.find((f) => f.startsWith('Binance') && f.endsWith('.xlsx'));

    if (binanceFile) {
      const filePath = path.join(rootDir, binanceFile);
      const history = await getBinanceExcelTradeHistory(filePath);
      res.json({ history });
      return;
    }

    let apiKey = process.env.BINANCE_API_KEY || env.BINANCE_API_KEY || undefined;
    let apiSecret = process.env.BINANCE_SECRET_KEY || env.BINANCE_SECRET_KEY || undefined;

    if (!apiKey || !apiSecret) {
      apiKey = (await getSetting<string>('binance_api_key')) ?? undefined;
      apiSecret = (await getSetting<string>('binance_secret_key')) ?? undefined;
    }

    if (!apiKey || !apiSecret) {
      res.status(400).json({ error: 'Relatório Excel ou Chaves API da Binance não encontrados.' });
      return;
    }

    const history = await getBinanceTradeHistory(apiKey, apiSecret);
    res.json({ history });
  } catch (err) {
    console.error('[investments] GET binance-history error:', err);
    res.status(500).json({ error: 'Falha ao buscar histórico da Binance.' });
  }
});

/**
 * GET /api/investments/dividends — Retorna a lista e o resumo de dividendos do relatório Excel.
 */
investmentsRouter.get('/dividends', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const summary = await getDividendsFromReport(user);
    res.json(summary);
  } catch (err) {
    console.error('[investments] GET dividends error:', err);
    res.status(500).json({ error: 'Falha ao buscar dividendos e proventos.' });
  }
});

/**
 * POST /api/investments/dividends/sync-transactions — Sincroniza os proventos para a tabela de transações sem duplicar.
 */
investmentsRouter.post('/dividends/sync-transactions', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const result = await syncDividendsToTransactions(user);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[investments] sync dividends to transactions error:', err);
    res.status(500).json({ error: 'Falha ao sincronizar dividendos com as transações.' });
  }
});

/**
 * POST /api/investments/import/binance-excel — Processa o relatório Excel exportado da Binance e atualiza saldos e preço médio.
 */
investmentsRouter.post('/import/binance-excel', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!isLucasUser(user)) {
      res.status(403).json({ error: 'Operação de importação legada não disponível.' });
      return;
    }

    const fs = await import('fs');
    const path = await import('path');
    const rootDir = process.cwd();
    const files = fs.readdirSync(rootDir);
    let filePath = files.find((f) => (f.startsWith('Binance') || f.startsWith('binance')) && (f.endsWith('.xlsx') || f.endsWith('.csv')))
      ? path.join(rootDir, files.find((f) => (f.startsWith('Binance') || f.startsWith('binance')) && (f.endsWith('.xlsx') || f.endsWith('.csv')))!)
      : null;

    if (!filePath) {
      const csvDataPath = path.join(rootDir, 'src/data/binance_history.csv');
      const backendCsvDataPath = path.join(rootDir, 'backend/src/data/binance_history.csv');
      if (fs.existsSync(csvDataPath)) filePath = csvDataPath;
      else if (fs.existsSync(backendCsvDataPath)) filePath = backendCsvDataPath;
    }

    if (!filePath) {
      res.status(404).json({ error: 'Relatório da Binance (Excel ou CSV) não foi encontrado.' });
      return;
    }

    const updated = await syncBinanceExcelReport(filePath);

    res.json({ ok: true, count: updated.length, investments: updated });
  } catch (err: any) {
    console.error('[investments] import binance excel error:', err);
    res.status(500).json({ error: err.message || 'Falha ao processar relatório da Binance.' });
  }
});

/**
 * GET /api/investments/trades — Retorna o histórico unificado de compras, vendas, swaps e depósitos de TODOS os ativos.
 */
investmentsRouter.get('/trades', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const trades = await getAllInvestmentTrades(user);
    res.json({ ok: true, count: trades.length, trades });
  } catch (err: any) {
    console.error('[investments] GET trades error:', err);
    res.status(500).json({ error: err.message || 'Falha ao buscar histórico de transações.' });
  }
});

/**
 * GET /api/investments/realized — Retorna operações realizadas.
 */
investmentsRouter.get('/realized', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const operations = await getRealizedOperations(user);
    res.json({ ok: true, operations });
  } catch (err: any) {
    console.error('[investments] GET realized error:', err);
    res.status(500).json({ error: err.message || 'Falha ao calcular operações realizadas.' });
  }
});

/**
 * PUT /api/investments/realized/:id/date — Atualiza a data de uma operação encerrada/realizada
 */
investmentsRouter.put('/realized/:id/date', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { id } = req.params;
    const { date } = req.body;
    if (!date) {
      res.status(400).json({ error: 'Data é obrigatória.' });
      return;
    }

    const cleanDate = date.substring(0, 10);
    const isoDate = `${cleanDate}T12:00:00.000Z`;

    if (id.startsWith('legacy_')) {
      const invId = id.replace('legacy_', '');
      const investments = await getAllInvestments(user);
      const inv = investments.find((i) => i.id === invId);
      if (!inv) {
        res.status(404).json({ error: 'Operação legada não encontrada.' });
        return;
      }
      const rawPrefix = (inv.sync_source || 'GORILA_CLOSED').replace(/#date=[^#]+/g, '');
      const updatedSync = `${rawPrefix}#date=${cleanDate}`;
      await upsertInvestment({
        id: invId,
        sync_source: updatedSync as any,
        created_at: isoDate,
      }, user);
      res.json({ ok: true, id, date: isoDate });
      return;
    }

    // Se for uma operação originada de uma transação
    const tradeId = id.replace('realized_', '');
    const updated = await updateInvestmentTrade(tradeId, { date: isoDate }, user);
    res.json({ ok: true, id, date: isoDate, trade: updated });
  } catch (err: any) {
    console.error('[investments] PUT realized date error:', err);
    res.status(500).json({ error: err?.message || 'Falha ao atualizar data da operação.' });
  }
});

investmentsRouter.get('/evolution', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const evolution = await getPortfolioEvolution(user);
    res.json({ ok: true, evolution });
  } catch (err: any) {
    console.error('[investments] GET evolution error:', err);
    res.status(500).json({ error: err.message || 'Falha ao buscar evolução do patrimônio.' });
  }
});

/**
 * POST /api/investments/trades — Registra manualmente uma nova transação (compra, venda ou troca).
 */
investmentsRouter.post('/trades', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const tradeData = req.body;
    if (!tradeData.ticker || !tradeData.trade_type || !tradeData.quantity) {
      res.status(400).json({ error: 'Ticker, tipo de operação e quantidade são obrigatórios.' });
      return;
    }

    const trade = await recordInvestmentTrade(tradeData, user);
    res.json({ ok: true, trade });
  } catch (err: any) {
    console.error('[investments] POST trade error:', err);
    res.status(500).json({ error: err.message || 'Falha ao salvar transação de investimento.' });
  }
});

/**
 * POST /api/investments/:id/sell — Realiza a venda de um ativo com cálculo de lucro/prejuízo.
 */
investmentsRouter.post('/:id/sell', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { id } = req.params;
    const { quantity, unit_price, date, notes } = req.body;

    if (!quantity || quantity <= 0) {
      res.status(400).json({ error: 'Quantidade de venda inválida.' });
      return;
    }
    if (unit_price === undefined || unit_price < 0) {
      res.status(400).json({ error: 'Preço unitário de venda inválido.' });
      return;
    }

    const result = await sellInvestmentPosition(id, {
      quantity: parseFloat(quantity),
      unit_price: parseFloat(unit_price),
      date: date || new Date().toISOString(),
      notes,
    }, user);

    res.json(result);
  } catch (err: any) {
    console.error('[investments] POST sell error:', err);
    res.status(500).json({ error: err.message || 'Falha ao processar venda do ativo.' });
  }
});

/**
 * PUT /api/investments/trades/:id — Atualiza uma transação do histórico.
 */
investmentsRouter.put('/trades/:id', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { id } = req.params;
    const updates = req.body;

    const updated = await updateInvestmentTrade(id, updates, user);
    if (!updated) {
      res.status(404).json({ error: 'Transação não encontrada.' });
      return;
    }

    res.json({ ok: true, trade: updated });
  } catch (err: any) {
    console.error('[investments] PUT trade error:', err);
    res.status(500).json({ error: err.message || 'Falha ao atualizar transação.' });
  }
});

/**
 * DELETE /api/investments/trades/:id — Exclui uma transação do histórico.
 */
investmentsRouter.delete('/trades/:id', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { id } = req.params;
    const success = await deleteInvestmentTrade(id, user);
    if (!success) {
      res.status(404).json({ error: 'Transação não encontrada.' });
      return;
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error('[investments] DELETE trade error:', err);
    res.status(500).json({ error: err.message || 'Falha ao excluir transação.' });
  }
});

/**
 * POST /api/investments/trades/recompile — Recompila o histórico completo do zero a partir dos arquivos Excel.
 */
investmentsRouter.post('/trades/recompile', async (req, res) => {
  try {
    const user = (req as AuthenticatedRequest).user;
    if (!isLucasUser(user)) {
      res.json({ ok: true, count: 0, trades: [] });
      return;
    }
    const trades = await recompileAllTrades();
    res.json({ ok: true, count: trades.length, trades });
  } catch (err: any) {
    console.error('[investments] POST trades/recompile error:', err);
    res.status(500).json({ error: err.message || 'Falha ao recompilar histórico de transações.' });
  }
});

