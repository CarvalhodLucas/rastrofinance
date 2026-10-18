import {
  getAllInvestments,
  getSetting,
  updateSetting,
  upsertInvestment,
} from './supabaseService.js';
import { recordInvestmentTrade } from './tradeService.js';
import type { Investment } from '../types.js';

export interface YieldConfig {
  yield_rate: number; // Ex: 0.35 para 0.35% a.m. ou 3.5 para 3.5% a.a.
  yield_frequency?: 'MONTHLY' | 'ANNUAL'; // 'MONTHLY' (default) ou 'ANNUAL'
  last_yield_date?: string | null; // Data do último rendimento aplicado: 'YYYY-MM-01'
}

export const YIELD_CONFIGS_KEY = 'investment_yield_configs';

/**
 * Retorna o mapa de configurações de rendimento de ativos { [investmentId]: YieldConfig }
 */
export async function getYieldConfigs(): Promise<Record<string, YieldConfig>> {
  const configs = await getSetting<Record<string, YieldConfig>>(YIELD_CONFIGS_KEY);
  return configs || {};
}

/**
 * Salva ou atualiza a taxa de rendimento de um ativo
 */
export async function saveYieldConfig(
  investmentId: string,
  config: Partial<YieldConfig>,
): Promise<YieldConfig> {
  const allConfigs = await getYieldConfigs();
  const existing = allConfigs[investmentId] || { yield_rate: 0, yield_frequency: 'MONTHLY' };

  const updated: YieldConfig = {
    ...existing,
    ...config,
    yield_rate: config.yield_rate !== undefined ? Number(config.yield_rate) : existing.yield_rate,
    yield_frequency: config.yield_frequency || existing.yield_frequency || 'MONTHLY',
  };

  allConfigs[investmentId] = updated;
  await updateSetting(YIELD_CONFIGS_KEY, allConfigs);
  return updated;
}

/**
 * Aplica o rendimento mensal de um ativo específico ou de todos os ativos com taxa configurada.
 * Todo dia 1º (ou quando forçado via botão/manual), o percentual é calculado sobre a quantidade e somado a ela.
 */
export async function applyMonthlyYields(targetInvestmentId?: string, force = false): Promise<{
  appliedCount: number;
  results: Array<{
    investmentId: string;
    ticker: string;
    name: string;
    previousQuantity: number;
    yieldAmount: number;
    newQuantity: number;
    yieldRateFormatted: string;
    currency: string;
  }>;
}> {
  const investments = await getAllInvestments();
  const yieldConfigs = await getYieldConfigs();

  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const firstOfMonthDate = `${currentYearMonth}-01`;

  const results: Array<{
    investmentId: string;
    ticker: string;
    name: string;
    previousQuantity: number;
    yieldAmount: number;
    newQuantity: number;
    yieldRateFormatted: string;
    currency: string;
  }> = [];

  for (const inv of investments) {
    if (targetInvestmentId && inv.id !== targetInvestmentId) continue;

    const config = yieldConfigs[inv.id];
    if (!config || !config.yield_rate || config.yield_rate <= 0) continue;
    if (inv.quantity <= 0) continue;

    // Se não for forçado, checa se hoje é dia 1 ou posterior e se já foi aplicado neste mês
    if (!force) {
      if (config.last_yield_date && config.last_yield_date.startsWith(currentYearMonth)) {
        // Já aplicado neste mês
        continue;
      }
    }

    const rate = config.yield_rate;
    const isAnnual = config.yield_frequency === 'ANNUAL';
    
    // Taxa mensal:
    // Se a.a.: (rate / 12) / 100
    // Se a.m.: rate / 100
    const monthlyRateFraction = isAnnual ? (rate / 12) / 100 : rate / 100;

    const yieldAmount = Number((inv.quantity * monthlyRateFraction).toFixed(4));
    if (yieldAmount <= 0) continue;

    const prevQty = inv.quantity;
    const newQty = Number((prevQty + yieldAmount).toFixed(4));
    const curPrice = inv.current_price || inv.average_price || 1.0;
    const newTotalVal = Number((newQty * curPrice).toFixed(2));

    // Atualiza a quantidade do investimento
    await upsertInvestment({
      id: inv.id,
      quantity: newQty,
      total_value: newTotalVal,
      last_synced_at: new Date().toISOString(),
    });

    // Registra como provento/rendimento no histórico de trades
    await recordInvestmentTrade({
      trade_type: 'EARN_INTEREST',
      asset_type: inv.asset_type,
      ticker: inv.code_ticker,
      asset_name: inv.name,
      institution: inv.institution || 'Wise',
      quantity: yieldAmount,
      unit_price: curPrice,
      total_value: Number((yieldAmount * curPrice).toFixed(2)),
      date: new Date().toISOString(),
      source: 'AUTO_YIELD',
      notes: `Rendimento automático de ${rate}% ${isAnnual ? 'a.a.' : 'a.m.'} somado ao saldo`,
    });

    // Atualiza last_yield_date no config
    config.last_yield_date = firstOfMonthDate;
    yieldConfigs[inv.id] = config;

    results.push({
      investmentId: inv.id,
      ticker: inv.code_ticker,
      name: inv.name,
      previousQuantity: prevQty,
      yieldAmount,
      newQuantity: newQty,
      yieldRateFormatted: `${rate}% ${isAnnual ? 'a.a.' : 'a.m.'}`,
      currency: inv.currency || 'USD',
    });
  }

  if (results.length > 0) {
    await updateSetting(YIELD_CONFIGS_KEY, yieldConfigs);
  }

  return {
    appliedCount: results.length,
    results,
  };
}
