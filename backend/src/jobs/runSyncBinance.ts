import { getSetting } from '../services/supabaseService.js';
import { syncBinancePortfolio } from '../services/binanceService.js';
import { mergeBinanceApiTrades } from '../services/tradeService.js';

export async function runSyncBinance(): Promise<void> {
  console.log('[syncBinance] Iniciando sincronização diária da Binance...');

  try {
    const settings = await getSetting<{ 
      binance_api_key?: string; 
      binance_api_secret?: string; 
    }>('user_preferences');

    if (!settings?.binance_api_key || !settings?.binance_api_secret) {
      console.log('[syncBinance] Chaves da Binance não configuradas. Sincronização ignorada.');
      return;
    }

    const synced = await syncBinancePortfolio(settings.binance_api_key, settings.binance_api_secret);
    const activeTickers = Array.from(new Set(synced.map((i) => i.code_ticker)));
    
    // Atualiza automaticamente o histórico (extrato) com as novas movimentações
    await mergeBinanceApiTrades(settings.binance_api_key, settings.binance_api_secret, activeTickers);

    console.log(`[syncBinance] Sincronização concluída. ${synced.length} ativos atualizados.`);
  } catch (err) {
    console.error('[syncBinance] Falha na sincronização diária da Binance:', err);
  }
}
