import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import {
  getAllInvestments,
  getSetting,
  updateSetting,
  upsertInvestment,
  ensureAccountForInstitution,
  supabase,
} from './supabaseService.js';
import { getUsdBrlRate } from './quoteService.js';
import { parseBinanceExcelReport } from './binanceReportService.js';
import { fetchFullBinanceHistoryAPI } from './binanceTradeSync.js';
import { isLucasUser, getUserSettingKey } from './userScopeService.js';
import type { UserSessionPayload } from './authService.js';

export type TradeType = 'BUY' | 'SELL' | 'SWAP' | 'DEPOSIT' | 'EARN_SUB' | 'EARN_REDEEM' | 'EARN_INTEREST' | 'AIRDROP';
export type TradeAssetType = 'CRYPTO' | 'STOCK' | 'FII' | 'FIXED_INCOME' | 'OTHER';

export interface InvestmentTrade {
  id: string;
  trade_type: TradeType;
  asset_type: TradeAssetType;
  ticker: string;
  asset_name: string;
  institution: string;
  quantity: number;
  unit_price: number;
  total_value: number;
  from_ticker?: string;
  from_quantity?: number;
  to_ticker?: string;
  to_quantity?: number;
  date: string;
  source: string;
  notes?: string;
}

const TRADES_STORAGE_KEY = 'investment_all_trades_history';

/**
 * Lê todas as transações armazenadas ou compila a partir dos relatórios existentes (Binance + Gorila/B3).
 */
export async function getAllInvestmentTrades(user?: UserSessionPayload | null): Promise<InvestmentTrade[]> {
  const tradesKey = getUserSettingKey(TRADES_STORAGE_KEY, user);
  // 1. Tentar buscar transações salvas nas configurações do Supabase
  const savedTrades = await getSetting<InvestmentTrade[]>(tradesKey);
  if (savedTrades && Array.isArray(savedTrades) && savedTrades.length > 0) {
    return savedTrades.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  // 2. Se não for o Lucas, não compila arquivos legados do Lucas
  if (!isLucasUser(user)) {
    return [];
  }

  // 3. Se for o Lucas e ainda não inicializou, compila o histórico inicial dos arquivos existentes
  const initialTrades = await compileInitialTradesFromFiles();
  if (initialTrades.length > 0) {
    await updateSetting(tradesKey, initialTrades);
  }
  return initialTrades.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Registra uma nova operação de compra, venda ou troca no histórico unificado.
 */
export async function recordInvestmentTrade(
  trade: Omit<InvestmentTrade, 'id'>,
  user?: UserSessionPayload | null,
): Promise<InvestmentTrade> {
  const tradesKey = getUserSettingKey(TRADES_STORAGE_KEY, user);
  const currentTrades = await getAllInvestmentTrades(user);
  const newTrade: InvestmentTrade = {
    ...trade,
    id: `trade_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
  };

  const updated = [newTrade, ...currentTrades];
  await updateSetting(tradesKey, updated);
  return newTrade;
}

/**
 * Atualiza uma transação existente no histórico unificado.
 */
export async function updateInvestmentTrade(
  id: string,
  updates: Partial<InvestmentTrade>,
  user?: UserSessionPayload | null
): Promise<InvestmentTrade | null> {
  const tradesKey = getUserSettingKey(TRADES_STORAGE_KEY, user);
  const currentTrades = await getAllInvestmentTrades(user);
  const idx = currentTrades.findIndex((t) => t.id === id);
  if (idx === -1) return null;

  const existing = currentTrades[idx]!;
  const updatedTrade: InvestmentTrade = {
    ...existing,
    ...updates,
    id, // garante ID imutável
  };

  currentTrades[idx] = updatedTrade;
  await updateSetting(tradesKey, currentTrades);
  return updatedTrade;
}

/**
 * Sincroniza a data e dados da transação manual de um ativo para refletir na evolução histórica.
 */
export async function syncManualTradeDate(
  ticker: string,
  tradeDate: string,
  extra: {
    asset_type?: TradeAssetType;
    asset_name?: string;
    institution?: string;
    quantity?: number;
    unit_price?: number;
  },
  user?: UserSessionPayload | null
): Promise<void> {
  const tradesKey = getUserSettingKey(TRADES_STORAGE_KEY, user);
  const currentTrades = await getAllInvestmentTrades(user);
  const cleanTicker = ticker.toUpperCase();
  const matchingIndices = currentTrades
    .map((t, idx) => (t.ticker.toUpperCase() === cleanTicker && (t.source === 'MANUAL' || t.trade_type === 'BUY') ? idx : -1))
    .filter((idx) => idx !== -1);

  const qty = extra.quantity ?? 1;
  const price = extra.unit_price ?? 0;

  if (matchingIndices.length > 0) {
    for (const idx of matchingIndices) {
      const ex = currentTrades[idx];
      if (!ex) continue;
      currentTrades[idx] = {
        ...ex,
        date: tradeDate,
        quantity: qty,
        unit_price: price,
        total_value: qty * price,
        institution: extra.institution || ex.institution,
      };
    }
    await updateSetting(tradesKey, currentTrades);
  } else {
    await recordInvestmentTrade({
      trade_type: 'BUY',
      asset_type: extra.asset_type || 'STOCK',
      ticker: cleanTicker,
      asset_name: extra.asset_name || cleanTicker,
      institution: extra.institution || 'Manual',
      quantity: qty,
      unit_price: price,
      total_value: qty * price,
      date: tradeDate,
      source: 'MANUAL',
      notes: 'Aporte cadastrado',
    }, user);
  }
}

/**
 * Exclui uma transação do histórico unificado.
 */
export async function deleteInvestmentTrade(id: string, user?: UserSessionPayload | null): Promise<boolean> {
  const tradesKey = getUserSettingKey(TRADES_STORAGE_KEY, user);
  const currentTrades = await getAllInvestmentTrades(user);
  const filtered = currentTrades.filter((t) => t.id !== id);
  if (filtered.length === currentTrades.length) return false;

  await updateSetting(tradesKey, filtered);
  return true;
}

/**
 * Executa a venda (parcial ou total) de um ativo em carteira,
 * calculando o lucro/prejuízo realizado e integrando com o histórico e ganhos/perdas.
 */
export async function sellInvestmentPosition(
  investmentId: string,
  sellData: {
    quantity: number;
    unit_price: number;
    date: string;
    notes?: string;
  },
  user?: UserSessionPayload | null
): Promise<{
  ok: boolean;
  realized_pnl: number;
  gross_sale: number;
  remaining_qty: number;
  trade: InvestmentTrade;
}> {
  const allInvestments = await getAllInvestments(user);
  const investment = allInvestments.find((i) => i.id === investmentId);

  if (!investment) {
    throw new Error('Ativo não encontrado na carteira.');
  }

  const sellQty = Math.min(Math.max(0, sellData.quantity), investment.quantity);
  if (sellQty <= 0) {
    throw new Error('Quantidade de venda deve ser maior que zero.');
  }

  const sellPrice = sellData.unit_price;
  const costBasisUnit = investment.average_price || investment.current_price || 0;
  const grossSale = sellQty * sellPrice;
  const costBasisTotal = sellQty * costBasisUnit;
  const realizedPnl = grossSale - costBasisTotal;
  const remainingQty = investment.quantity - sellQty;

  // 1. Atualizar ou criar registro de posição encerrada (Histórico Realizado)
  if (remainingQty <= 0.00000001) {
    // Venda total da posição
    await upsertInvestment({
      id: investment.id,
      quantity: 0,
      current_price: sellPrice,
      total_value: realizedPnl, // Salva o lucro/prejuízo realizado
      sync_source: 'MANUAL_CLOSED',
      last_synced_at: new Date().toISOString(),
    }, user);
  } else {
    // Venda parcial: atualiza a posição ativa restante
    await upsertInvestment({
      id: investment.id,
      quantity: remainingQty,
      total_value: remainingQty * (investment.current_price || investment.average_price),
      last_synced_at: new Date().toISOString(),
    }, user);

    // Cria registro de posição encerrada referente à fatia vendida
    await upsertInvestment({
      name: `${investment.name} (Venda Parcial)`,
      code_ticker: investment.code_ticker,
      asset_type: investment.asset_type,
      institution: investment.institution,
      quantity: 0,
      average_price: costBasisUnit,
      current_price: sellPrice,
      total_value: realizedPnl,
      currency: investment.currency || 'BRL',
      sync_source: 'MANUAL_CLOSED',
      last_synced_at: new Date().toISOString(),
    }, user);
  }

  // 2. Registrar no Histórico Unificado de Transações (Extrato / TRADES)
  const tradeDate = sellData.date
    ? (sellData.date.includes('T') ? sellData.date : `${sellData.date}T12:00:00.000Z`)
    : new Date().toISOString();

  const trade = await recordInvestmentTrade({
    trade_type: 'SELL',
    asset_type: investment.asset_type as TradeAssetType,
    ticker: investment.code_ticker,
    asset_name: investment.name,
    institution: investment.institution,
    quantity: sellQty,
    unit_price: sellPrice,
    total_value: grossSale,
    from_ticker: investment.code_ticker,
    from_quantity: sellQty,
    date: tradeDate,
    source: 'MANUAL',
    notes: sellData.notes || `Venda manual (Resultado: ${realizedPnl >= 0 ? '+' : ''}R$ ${realizedPnl.toFixed(2)})`,
  }, user);

  // 3. Creditar o valor recebido na venda (grossSale) no saldo da conta da instituição correspondente
  if (grossSale > 0) {
    try {
      const targetAccount = await ensureAccountForInstitution(
        investment.institution,
        investment.currency || 'BRL',
      );
      const newBalance = (targetAccount.balance || 0) + grossSale;
      await supabase
        .from('connected_accounts')
        .update({
          balance: newBalance,
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', targetAccount.id);
    } catch (err) {
      console.error('[tradeService] Erro ao creditar saldo da venda no banco:', err);
    }
  }

  return {
    ok: true,
    realized_pnl: realizedPnl,
    gross_sale: grossSale,
    remaining_qty: Math.max(0, remainingQty),
    trade,
  };
}

/**
 * Compila todas as transações dos relatórios Binance e Gorila/B3.
 */
export async function compileInitialTradesFromFiles(): Promise<InvestmentTrade[]> {
  let rootDir = process.cwd();
  if (path.basename(rootDir) === 'backend') {
    rootDir = path.join(rootDir, '..');
  }
  const files = fs.readdirSync(rootDir);
  const trades: InvestmentTrade[] = [];
  const usdRate = await getUsdBrlRate();

  // A. Extrair do relatório da Binance (.xlsx ou .csv)
  let binancePath: string | null = null;
  const binanceFile = files.find((f) => (f.startsWith('Binance') || f.startsWith('binance')) && (f.endsWith('.xlsx') || f.endsWith('.csv')));
  if (binanceFile) {
    binancePath = path.join(rootDir, binanceFile);
  } else {
    const csv1 = path.join(rootDir, 'backend/src/data/binance_history.csv');
    const csv2 = path.join(rootDir, 'src/data/binance_history.csv');
    if (fs.existsSync(csv1)) binancePath = csv1;
    else if (fs.existsSync(csv2)) binancePath = csv2;
  }

  if (binancePath) {
    try {
      const rows = await parseBinanceExcelReport(binancePath);

      const converts: typeof rows = [];
      const individualRows: typeof rows = [];

      for (const r of rows) {
        if (r.operation === 'Binance Convert') {
          converts.push(r);
        } else {
          // Deposit, Simple Earn, Airdrop, Buy Crypto With Fiat — tratados individualmente
          individualRows.push(r);
        }
      }

      // ----- Processar pares Binance Convert (BUY / SWAP) -----
      converts.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());
      
      const runningCostMap: Record<string, { qty: number; costBrl: number }> = {};
      let pendingConvert: typeof rows[0] | null = null;
      for (const c of converts) {
        if (!pendingConvert) {
          pendingConvert = c;
        } else {
          const timeDiff = Math.abs(new Date(pendingConvert.time).getTime() - new Date(c.time).getTime());
          // Se tiverem sinais opostos e diferença de tempo < 15 segundos
          if ((pendingConvert.change < 0 && c.change > 0 || pendingConvert.change > 0 && c.change < 0) && timeDiff <= 15000) {
            const outItem = pendingConvert.change < 0 ? pendingConvert : c;
            const inItem = pendingConvert.change > 0 ? pendingConvert : c;
            
            const fromAsset = outItem.coin;
            const fromAmt = Math.abs(outItem.change);
            const toAsset = inItem.coin;
            const toAmt = inItem.change;
            const dateIso = new Date(inItem.time.replace(' ', 'T') + '+00:00').toISOString();
            const isFiatFrom = fromAsset === 'BRL' || fromAsset === 'USDT' || fromAsset === 'USD';

            let totalBrl = fromAmt;
            if (fromAsset === 'BRL') {
              totalBrl = fromAmt;
            } else if (fromAsset === 'USDT' || fromAsset === 'USD') {
              totalBrl = fromAmt * usdRate;
            } else if (fromAsset === 'EUR') {
              totalBrl = fromAmt * 6.0;
            } else {
              // Troca entre criptos: transfere o custo do ativo de origem
              const fromData = runningCostMap[fromAsset];
              const fromAvg = fromData && fromData.qty > 0 ? fromData.costBrl / fromData.qty : 0;
              totalBrl = fromAvg > 0 ? fromAmt * fromAvg : fromAmt * usdRate;
              if (fromData) {
                fromData.costBrl -= totalBrl;
                fromData.qty -= fromAmt;
              }
            }

            const unitPriceBrl = toAmt > 0 ? totalBrl / toAmt : 0;

            if (!runningCostMap[toAsset]) runningCostMap[toAsset] = { qty: 0, costBrl: 0 };
            runningCostMap[toAsset].qty += toAmt;
            runningCostMap[toAsset].costBrl += totalBrl;

            if (isFiatFrom) {
              trades.push({
                id: `bin_${inItem.time}_${toAsset}`,
                trade_type: 'BUY',
                asset_type: 'CRYPTO',
                ticker: toAsset,
                asset_name: toAsset,
                institution: 'Binance',
                quantity: toAmt,
                unit_price: unitPriceBrl,
                total_value: totalBrl,
                from_ticker: fromAsset,
                from_quantity: fromAmt,
                date: dateIso,
                source: 'BINANCE_EXCEL',
                notes: `Conversão ${fromAsset} ➔ ${toAsset}`,
              });
            } else {
              trades.push({
                id: `bin_${inItem.time}_swap_${fromAsset}_${toAsset}`,
                trade_type: 'SWAP',
                asset_type: 'CRYPTO',
                ticker: toAsset,
                asset_name: toAsset,
                institution: 'Binance',
                quantity: toAmt,
                unit_price: unitPriceBrl,
                total_value: totalBrl,
                from_ticker: fromAsset,
                from_quantity: fromAmt,
                to_ticker: toAsset,
                to_quantity: toAmt,
                date: dateIso,
                source: 'BINANCE_EXCEL',
                notes: `Troca: ${fromAmt} ${fromAsset} ➔ ${toAmt} ${toAsset} (Custo transferido: R$ ${totalBrl.toFixed(2)})`,
              });
            }
            pendingConvert = null; // Par fechado
          } else {
            // Se não der match, o atual vira o pendente (ignora o anterior)
            pendingConvert = c;
          }
        }
      }

      // ----- Processar linhas individuais (Deposit, Earn, Airdrop) -----
      for (const r of individualRows) {
        const dateIso = new Date(r.time.replace(' ', 'T') + '+00:00').toISOString();
        const isFiat = r.coin === 'BRL' || r.coin === 'EUR' || r.coin === 'USD';

        let totalBrl = r.change;
        if (r.coin === 'EUR') totalBrl = r.change * 5.6;
        else if (r.coin === 'USDT' || r.coin === 'USD') totalBrl = r.change * usdRate;
        else if (!isFiat) {
          // Cripto: valor em BRL é aproximado (sem cotação histórica exata, marca 0 para não distorcer)
          totalBrl = 0;
        }

        if (r.operation === 'Deposit' && r.change > 0) {
          trades.push({
            id: `bin_dep_${r.time}_${r.coin}`,
            trade_type: 'DEPOSIT',
            asset_type: isFiat ? 'OTHER' : 'CRYPTO',
            ticker: r.coin,
            asset_name: `Depósito ${r.coin}`,
            institution: 'Binance',
            quantity: r.change,
            unit_price: isFiat ? 1 : 0,
            total_value: isFiat ? totalBrl : r.change,
            date: dateIso,
            source: 'BINANCE_EXCEL',
            notes: `Depósito via PIX/Transferência`,
          });

        } else if (r.operation === 'Buy Crypto With Fiat') {
          // Quando compra com cartão/fiat e o Excel só mostra a linha positiva da cripto
          const toAmt = r.change;
          let estimatedBrl = 0;
          if (r.coin === 'BTC') estimatedBrl = toAmt * 330000;
          else if (r.coin === 'ETH') estimatedBrl = toAmt * 10000;
          else if (r.coin === 'SOL') estimatedBrl = toAmt * 750;
          else if (r.coin === 'ONDO') estimatedBrl = toAmt * 2.0;
          else if (r.coin === 'ROSE') estimatedBrl = toAmt * 0.15;
          else if (r.coin === 'VIRTUAL') estimatedBrl = toAmt * 3.5;
          else if (r.coin === 'XLM') estimatedBrl = toAmt * 1.2;
          else estimatedBrl = toAmt * usdRate;
          
          trades.push({
            id: `bin_fiat_${r.time}_${r.coin}`,
            trade_type: 'BUY',
            asset_type: 'CRYPTO',
            ticker: r.coin,
            asset_name: r.coin,
            institution: 'Binance',
            quantity: toAmt,
            unit_price: toAmt > 0 ? estimatedBrl / toAmt : 0,
            total_value: estimatedBrl,
            from_ticker: 'PIX/BRL (Estimado)',
            from_quantity: estimatedBrl,
            date: dateIso,
            source: 'BINANCE_EXCEL',
            notes: `Compra direta PIX/Cartão`,
          });
        } else if (r.operation === 'Simple Earn Flexible Subscription') {
          // Enviou cripto para a poupança Binance Earn
          trades.push({
            id: `bin_earn_sub_${r.time}_${r.coin}`,
            trade_type: 'EARN_SUB',
            asset_type: 'CRYPTO',
            ticker: r.coin,
            asset_name: r.coin,
            institution: 'Binance Earn',
            quantity: Math.abs(r.change),
            unit_price: 0,
            total_value: 0,
            date: dateIso,
            source: 'BINANCE_EXCEL',
            notes: `Inscrito no Earn Flexível — ${Math.abs(r.change)} ${r.coin} bloqueado`,
          });

        } else if (r.operation === 'Simple Earn Flexible Redemption') {
          // Resgatou cripto da poupança Binance Earn
          trades.push({
            id: `bin_earn_rdm_${r.time}_${r.coin}`,
            trade_type: 'EARN_REDEEM',
            asset_type: 'CRYPTO',
            ticker: r.coin,
            asset_name: r.coin,
            institution: 'Binance Earn',
            quantity: r.change,
            unit_price: 0,
            total_value: 0,
            date: dateIso,
            source: 'BINANCE_EXCEL',
            notes: `Resgate do Earn Flexível — ${r.change} ${r.coin} devolvido`,
          });

        } else if (r.operation === 'Simple Earn Flexible Interest') {
          // Rendimento de juros da poupança — agrupamos por dia+moeda para não ter 598 linhas separadas
          const dayKey = r.time.slice(0, 10);
          const existingIdx = trades.findIndex(
            (t) => t.trade_type === 'EARN_INTEREST' && t.ticker === r.coin &&
                   t.date.startsWith(dayKey) && t.source === 'BINANCE_EXCEL'
          );
          if (existingIdx >= 0) {
            // Acumular no mesmo dia
            const exTrade = trades[existingIdx];
            if (exTrade) {
              exTrade.quantity += r.change;
            }
          } else {
            trades.push({
              id: `bin_interest_${dayKey}_${r.coin}`,
              trade_type: 'EARN_INTEREST',
              asset_type: 'CRYPTO',
              ticker: r.coin,
              asset_name: r.coin,
              institution: 'Binance Earn',
              quantity: r.change,
              unit_price: 0,
              total_value: 0,
              date: new Date(dayKey + 'T12:00:00Z').toISOString(),
              source: 'BINANCE_EXCEL',
              notes: `Rendimento diário Earn Flexível`,
            });
          }

        } else if (r.operation === 'Airdrop Assets' && r.change > 0) {
          trades.push({
            id: `bin_airdrop_${r.time}_${r.coin}`,
            trade_type: 'AIRDROP',
            asset_type: 'CRYPTO',
            ticker: r.coin,
            asset_name: r.coin,
            institution: 'Binance',
            quantity: r.change,
            unit_price: 0,
            total_value: 0,
            date: dateIso,
            source: 'BINANCE_EXCEL',
            notes: `Airdrop recebido: ${r.change} ${r.coin}`,
          });
        }
      }
    } catch (e) {
      console.warn('[tradeService] Falha ao compilar Binance Excel:', e);
    }
  }

  // B. Extrair do Extrato de Movimentação B3 (Mais preciso, com datas reais)
  const b3File = files.find((f) => f.startsWith('movimentacao-') && f.endsWith('.xlsx'));
  if (b3File) {
    try {
      const fullPath = path.join(rootDir, b3File);
      const workbook = XLSX.readFile(fullPath);
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets['Movimentação'] || (firstSheetName ? workbook.Sheets[firstSheetName] : undefined);
      if (!sheet) throw new Error('Aba de movimentação não encontrada');
      const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

      const getAssetTypeAndName = (productStr: string): { assetType: TradeAssetType; ticker: string; name: string } => {
        const parts = (productStr || '').split(' - ');
        let ticker = (parts[0] || '').trim().toUpperCase();
        let name = parts[1] ? parts[1].trim() : ticker;

        let assetType: TradeAssetType = 'STOCK';
        const lowerProd = productStr.toLowerCase();

        if (ticker.startsWith('CDB') || ticker.startsWith('LCI') || ticker.startsWith('LCA') || ticker.startsWith('TESOURO') || lowerProd.includes('tesouro') || lowerProd.includes('cdb') || lowerProd.includes('debenture')) {
          assetType = 'FIXED_INCOME';
          if (lowerProd.includes('renda+')) {
            ticker = 'Tesouro Renda+ 2065';
            name = 'Tesouro Renda+ Aposentadoria Extra 2065';
          } else if (lowerProd.includes('prefixado')) {
            ticker = 'Tesouro Prefixado 2028';
            name = 'Tesouro Prefixado 2028';
          }
        } else if (ticker.endsWith('11')) {
          const isCommonUnit = ['KLBN11', 'BPAC11', 'SANB11', 'ALUP11', 'TIET11', 'TAEE11', 'SULA11'].includes(ticker);
          assetType = isCommonUnit ? 'STOCK' : 'FII';
        } else if (ticker.endsWith('34') || lowerProd.includes('bdr')) {
          assetType = 'STOCK';
        } else if (lowerProd.includes('cripto') || lowerProd.includes('moedas')) {
          assetType = 'CRYPTO';
        }

        return { assetType, ticker, name };
      };

      // Pular a primeira linha (cabeçalho)
      for (let i = 1; i < rawRows.length; i++) {
        const r = rawRows[i];
        if (!r || !r[2] || !r[3]) continue;

        const side = String(r[0] || '').trim();
        const dateRaw = r[1];
        const rawOp = String(r[2]).trim();
        const rawProduct = String(r[3]).trim();
        const institution = String(r[4] || 'B3').trim();
        const quantity = parseFloat(r[5]) || 0;
        const price = parseFloat(r[6]) || 0;
        const totalValue = parseFloat(r[7]) || 0;

        let dateIso = new Date().toISOString();
        if (typeof dateRaw === 'number') {
          const serial = dateRaw;
          const utc_days = Math.floor(serial - 25569);
          dateIso = new Date(utc_days * 86400 * 1000 + 12 * 60 * 60 * 1000).toISOString();
        } else if (typeof dateRaw === 'string') {
          const [d, m, y] = dateRaw.split('/');
          dateIso = new Date(`${y}-${m}-${d}T12:00:00Z`).toISOString();
        }

        const { assetType, ticker, name } = getAssetTypeAndName(rawProduct);

        // Identificar o Tipo de Operação
        let tradeType: TradeType | null = null;
        let notes = rawOp;

        const isTrade = ['Transferência - Liquidação', 'Compra', 'Venda', 'COMPRA / VENDA', 'Resgate'].includes(rawOp);
        const isDividend = ['Juros Sobre Capital Próprio', 'Dividendo', 'Rendimento', 'Rendimentos'].includes(rawOp);
        const isAirdrop = ['Bonificação em Ativos', 'Atualização', 'Desdobro', 'Leilão de Fração', 'Fração em Ativos'].includes(rawOp);

        if (isTrade) {
          // Pula empréstimos/transferências de garantia sem liquidação financeira
          if (price <= 0 && totalValue <= 0) continue;
          tradeType = side === 'Credito' ? 'BUY' : 'SELL';
        } else if (isDividend) {
          tradeType = 'EARN_INTEREST';
        } else if (isAirdrop) {
          tradeType = 'AIRDROP';
        }

        if (!tradeType) continue; // Pular movimentações irrelevantes

        const finalPrice = price > 0 ? price : (quantity > 0 ? totalValue / quantity : 0);
        const finalTotal = totalValue > 0 ? totalValue : (quantity * finalPrice);

        let instClean = institution
          .replace(' S.A. - CTVM', '')
          .replace(' CCTVM S/A.', '')
          .replace(' CCTVM S/A', '')
          .replace(' CORRETORA DE VALORES S.A.', '')
          .replace(' INVESTIMENTOS', '')
          .trim();
        if (instClean.includes('NU')) instClean = 'NuInvest';
        else if (instClean.includes('XP')) instClean = 'XP Investimentos';

        trades.push({
          id: `b3_mov_${ticker}_${i}_${typeof dateRaw === 'string' ? dateRaw.replace(/\//g, '') : dateRaw}`,
          trade_type: tradeType,
          asset_type: assetType,
          ticker,
          asset_name: name,
          institution: instClean,
          quantity,
          unit_price: finalPrice,
          total_value: finalTotal,
          date: dateIso,
          source: 'B3_IMPORT',
          notes,
        });
      }
    } catch (e) {
      console.warn('[tradeService] Falha ao compilar Extrato de Movimentação B3:', e);
    }
  } else {
    // Fallback para o Relatório antigo caso não encontre
    const gorilaFile = files.find((f) => f.toLowerCase().includes('relatorio_lucas') && f.endsWith('.xlsx'));
    if (gorilaFile) {
      try {
        const fullPath = path.join(rootDir, gorilaFile);
        const workbook = XLSX.readFile(fullPath);
        const firstSheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets['Relatório'] || (firstSheetName ? workbook.Sheets[firstSheetName] : undefined);
        if (!sheet) throw new Error('Aba de relatório não encontrada');
        const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        let reportDate = new Date('2026-08-11T12:00:00Z');
        for (const r of rawRows) {
          if (r && r[0] === 'Data Final' && typeof r[1] === 'number') {
            const serial = r[1];
            const utc_days = Math.floor(serial - 25569);
            reportDate = new Date(utc_days * 86400 * 1000 + 12 * 60 * 60 * 1000);
            break;
          }
        }

        for (let i = 34; i <= 76; i++) {
          const r = rawRows[i];
          if (!r || !r[1]) continue;

          const institution = String(r[0] || 'B3').trim();
          const ticker = String(r[1]).trim().toUpperCase();
          const subClasse = String(r[2] || '').trim();
          const classe = String(r[3] || '').trim();
          const quantity = parseFloat(r[4]) || 0;
          const totalValue = parseFloat(r[5]) || 0;
          const currentPrice = parseFloat(r[6]) || 0;
          const averagePrice = parseFloat(r[7]) || currentPrice;

          let assetType: TradeAssetType = 'STOCK';
          if (subClasse === 'FIIs' || ticker.endsWith('11')) assetType = 'FII';
          else if (classe === 'Renda Fixa' || subClasse.includes('Inflação') || subClasse.includes('Prefixado')) assetType = 'FIXED_INCOME';
          else if (subClasse === 'Criptomoeda') assetType = 'CRYPTO';

          if (institution.includes('BINANCE') && assetType === 'CRYPTO') continue;

          const isClosed = quantity === 0;
          const tradeType: TradeType = isClosed ? 'SELL' : 'BUY';

          trades.push({
            id: `gorila_${ticker}_${institution}_${i}`,
            trade_type: tradeType,
            asset_type: assetType,
            ticker,
            asset_name: ticker,
            institution: institution.includes('NU') ? 'Nu Invest' : institution.includes('XP') ? 'XP Investimentos' : institution,
            quantity: quantity > 0 ? quantity : 1,
            unit_price: averagePrice,
            total_value: quantity > 0 ? quantity * averagePrice : (currentPrice * (parseFloat(r[9]) || 1)),
            date: reportDate.toISOString(),
            source: 'GORILA_IMPORT',
            notes: isClosed ? 'Posição Histórica Encerrada' : 'Posição em Carteira',
          });
        }
      } catch (e) {
        console.warn('[tradeService] Falha ao compilar Gorila Excel:', e);
      }
    }
  }

  return trades.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Limpa o cache e recompila o histórico completo do zero a partir dos arquivos Excel.
 */
export async function recompileAllTrades(): Promise<InvestmentTrade[]> {
  const trades = await compileInitialTradesFromFiles();
  if (trades.length > 0) {
    await updateSetting(TRADES_STORAGE_KEY, trades);
  }
  return trades.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/**
 * Busca transações recentes da API da Binance e mescla com as existentes no banco
 * sem criar duplicatas, mantendo os dados originais do Excel intactos.
 */
export async function mergeBinanceApiTrades(
  apiKey: string,
  apiSecret: string,
  activeTickers: string[]
): Promise<InvestmentTrade[]> {
  const apiTrades = await fetchFullBinanceHistoryAPI(apiKey, apiSecret, activeTickers);
  if (apiTrades.length === 0) return await getAllInvestmentTrades();

  const currentTrades = await getAllInvestmentTrades();
  
  // Mapa das existentes por ID
  const existingMap = new Map<string, InvestmentTrade>();
  for (const t of currentTrades) {
    existingMap.set(t.id, t);
  }

  // Mesclar: só adiciona se não existir no Excel ou API antiga
  let addedNew = false;
  for (const t of apiTrades) {
    if (!existingMap.has(t.id)) {
      existingMap.set(t.id, t);
      addedNew = true;
    }
  }

  if (addedNew) {
    const mergedList = Array.from(existingMap.values());
    mergedList.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    await updateSetting(TRADES_STORAGE_KEY, mergedList);
    return mergedList;
  }

  return currentTrades;
}
