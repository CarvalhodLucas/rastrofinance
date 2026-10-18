import path from 'path';
import XLSX from 'xlsx';
import {
  getAllInvestments,
  getSetting,
  updateSetting,
  upsertInvestment,
} from '../services/supabaseService.js';
import type { InvestmentTrade, TradeAssetType, TradeType } from '../services/tradeService.js';

const TRADES_STORAGE_KEY = 'investment_all_trades_history';
const EXCEL_PATH = 'C:/Users/Lucas de Carvalho/Documents/Sites/CRM FINANCIAS/movimentacao-2026-10-17-18-47-56.xlsx';

function getAssetTypeAndName(productStr: string): { assetType: TradeAssetType; ticker: string; name: string } {
  const parts = productStr.split(' - ');
  let ticker = parts[0].trim().toUpperCase();
  let name = parts[1] ? parts[1].trim() : ticker;
  let assetType: TradeAssetType = 'STOCK';
  const lowerProd = productStr.toLowerCase();

  if (
    ticker.startsWith('CDB') ||
    ticker.startsWith('LCI') ||
    ticker.startsWith('LCA') ||
    ticker.startsWith('TESOURO') ||
    lowerProd.includes('tesouro') ||
    lowerProd.includes('cdb') ||
    lowerProd.includes('debenture')
  ) {
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
  }

  return { assetType, ticker, name };
}

async function main() {
  console.log('--- Processando Planilha de Movimentação B3 ---');
  console.log('Arquivo:', EXCEL_PATH);

  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheet = workbook.Sheets['Movimentação'] || workbook.Sheets[workbook.SheetNames[0]];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });

  console.log(`Linhas totais na planilha: ${rawRows.length}`);

  const newB3Trades: InvestmentTrade[] = [];

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

    const isTrade = ['Transferência - Liquidação', 'Compra', 'Venda', 'COMPRA / VENDA', 'Resgate'].includes(rawOp);
    const isDividend = ['Juros Sobre Capital Próprio', 'Dividendo', 'Rendimento', 'Rendimentos'].includes(rawOp);
    const isAirdrop = ['Bonificação em Ativos', 'Desdobro', 'Leilão de Fração', 'Fração em Ativos'].includes(rawOp) && (price > 0 || totalValue > 0 || rawOp === 'Bonificação em Ativos');

    let tradeType: TradeType | null = null;
    if (isTrade) {
      // Ignora registros de custódia / empréstimo sem fluxo financeiro real
      if (price <= 0 && totalValue <= 0) continue;
      tradeType = side === 'Credito' ? 'BUY' : 'SELL';
    } else if (isDividend) {
      tradeType = 'EARN_INTEREST';
    } else if (isAirdrop) {
      tradeType = 'AIRDROP';
    }

    if (!tradeType) continue;

    const { assetType, ticker, name } = getAssetTypeAndName(rawProduct);

    let dateIso = new Date().toISOString();
    if (typeof dateRaw === 'number') {
      const serial = dateRaw;
      const utc_days = Math.floor(serial - 25569);
      dateIso = new Date(utc_days * 86400 * 1000 + 12 * 60 * 60 * 1000).toISOString();
    } else if (typeof dateRaw === 'string') {
      const [d, m, y] = dateRaw.split('/');
      dateIso = new Date(`${y}-${m}-${d}T12:00:00Z`).toISOString();
    }

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

    newB3Trades.push({
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
      notes: rawOp,
    });
  }

  console.log(`Transações válidas B3 extraídas: ${newB3Trades.length}`);
  const buys = newB3Trades.filter((t) => t.trade_type === 'BUY');
  const sells = newB3Trades.filter((t) => t.trade_type === 'SELL');
  const earnings = newB3Trades.filter((t) => t.trade_type === 'EARN_INTEREST');
  const airdrops = newB3Trades.filter((t) => t.trade_type === 'AIRDROP');

  console.log(`- Compras: ${buys.length}`);
  console.log(`- Vendas: ${sells.length}`);
  console.log(`- Proventos (Dividendos/JCP): ${earnings.length}`);
  console.log(`- Bonificações/Frações: ${airdrops.length}`);

  // 2. Mesclar com transações atuais da Binance e manuais existentes
  const savedTrades = (await getSetting<InvestmentTrade[]>(TRADES_STORAGE_KEY)) || [];
  const nonB3Trades = savedTrades.filter(
    (t) => t.source !== 'B3_IMPORT' && t.ticker !== 'POMO4' && t.ticker !== 'TOTS3'
  );
  console.log(`Transações preservadas (Binance e outras): ${nonB3Trades.length}`);

  const allMergedTrades = [...newB3Trades, ...nonB3Trades];
  allMergedTrades.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  await updateSetting(TRADES_STORAGE_KEY, allMergedTrades);
  console.log(`Histórico unificado atualizado com sucesso no banco: ${allMergedTrades.length} transações.`);

  // 3. Atualizar ativos em carteira com as datas reais de aporte para o gráfico de evolução
  const allInvestments = await getAllInvestments();

  const updatesMap: Record<string, { created_at: string; institution?: string; average_price?: number; quantity?: number }> = {
    POMO4: {
      created_at: '2026-08-25T12:00:00.000Z',
      institution: 'XP Investimentos',
      average_price: 4.48,
      quantity: 340,
    },
    TOTS3: {
      created_at: '2026-04-28T12:00:00.000Z',
      institution: 'XP Investimentos',
      average_price: 32.06,
      quantity: 60,
    },
    'Tesouro Renda+ 2065': {
      created_at: '2025-12-29T12:00:00.000Z',
      average_price: 173.73,
    },
    VULC3: {
      created_at: '2025-11-12T12:00:00.000Z',
      average_price: 19.56,
    },
    AXIA3: {
      created_at: '2025-12-19T12:00:00.000Z',
      average_price: 46.53,
    },
    AXIA7: {
      created_at: '2025-12-23T12:00:00.000Z',
      average_price: 51.52,
    },
    EMBJ3: {
      institution: 'XP Investimentos',
      average_price: 74.90,
      current_price: 100.00,
      total_value: 577.28,
      quantity: 0,
    },
    PRIO3: {
      average_price: 36.27,
      current_price: 71.00,
      total_value: 1944.62,
      quantity: 0,
    },
  };

  for (const inv of allInvestments) {
    const t = inv.code_ticker;
    if (updatesMap[t]) {
      const u = updatesMap[t];
      await upsertInvestment({
        id: inv.id,
        ...(u.created_at ? { created_at: u.created_at } : {}),
        ...(u.institution ? { institution: u.institution } : {}),
        ...(u.average_price !== undefined ? { average_price: u.average_price } : {}),
        ...(u.current_price !== undefined ? { current_price: u.current_price } : {}),
        ...(u.total_value !== undefined ? { total_value: u.total_value } : {}),
        ...(u.quantity !== undefined ? { quantity: u.quantity } : {}),
      });
      console.log(`Ativo ${t} atualizado.`);
    }
  }

  console.log('--- Sincronização B3 Finalizada com Sucesso! ---');
}

main().catch(console.error);
