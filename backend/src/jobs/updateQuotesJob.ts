import { getAllInvestments, upsertInvestment } from '../services/supabaseService.js';
import { getUsdBrlRate, processQuoteTicker } from '../services/quoteService.js';
import type { UserSessionPayload } from '../services/authService.js';

const KNOWN_CRYPTOS = new Set([
  'BTC', 'ETH', 'SOL', 'ONDO', 'SXT', 'LINK', 'RENDER', 'ROSE', 'VIRTUAL',
  'XRP', 'ADA', 'DOGE', 'PEPE', 'TAO', 'XLM', 'BNB', 'AVAX', 'DOT', 'NEAR',
  'SUI', 'SHIB', 'LTC', 'UNI', 'ATOM', 'APT', 'ARB', 'OP', 'FET', 'ICP', 'TRX'
]);

export async function runUpdateQuotesJob(user?: UserSessionPayload | null): Promise<number> {
  console.log('[updateQuotesJob] Iniciando atualização de cotações...', user?.username ? `(user: ${user.username})` : '(sistema)');
  try {
    const investments = await getAllInvestments(user);
    const quoteEligibleInvestments = investments.filter(
      (i) =>
        i.code_ticker &&
        !i.code_ticker.includes('RENDA+') &&
        !i.code_ticker.startsWith('LTN') &&
        !i.code_ticker.startsWith('CDB') &&
        !i.code_ticker.startsWith('LCI') &&
        !i.code_ticker.startsWith('LCA') &&
        !i.code_ticker.startsWith('TESOURO')
    );

    const usdRate = await getUsdBrlRate();

    const fetchWithTimeout = <T>(promise: Promise<T>, timeoutMs = 8000): Promise<T> => {
      let timer: any;
      const timeoutPromise = new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Timeout')), timeoutMs);
      });
      return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
    };

    // Processamento em lotes de 6 para evitar bloqueio de rede ou timeouts
    const BATCH_SIZE = 6;
    let updatedCount = 0;

    for (let idx = 0; idx < quoteEligibleInvestments.length; idx += BATCH_SIZE) {
      const batch = quoteEligibleInvestments.slice(idx, idx + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (inv) => {
          try {
            const rawTicker = (inv.code_ticker || '').trim().toUpperCase();
            const quote = await fetchWithTimeout(processQuoteTicker(rawTicker, 'compact', true), 8000);
            if (quote && quote.price && quote.price > 0 && !quote.error) {
              const rawPrice = Number(quote.price);

              const isCryptoAsset =
                inv.asset_type === 'CRYPTO' ||
                inv.currency === 'USD' ||
                inv.currency === 'USDT' ||
                inv.institution === 'Binance' ||
                KNOWN_CRYPTOS.has(rawTicker);

              const isQuoteUsd = quote.currency === 'USD';
              const finalPrice = isCryptoAsset ? rawPrice : (isQuoteUsd ? rawPrice * usdRate : rawPrice);
              const newTotalVal = inv.quantity > 0 ? inv.quantity * finalPrice : inv.total_value;

              let updatedSyncSource = inv.sync_source;
              if (updatedSyncSource && updatedSyncSource.includes('#')) {
                const parts = updatedSyncSource.split('#');
                updatedSyncSource = `${parts[0] || 'MANUAL'}#${parts[1] || inv.average_price || 0}#${finalPrice}` as any;
              }

              await upsertInvestment({
                ...inv,
                current_price: finalPrice,
                total_value: newTotalVal,
                sync_source: updatedSyncSource,
                currency: isCryptoAsset ? 'USD' : 'BRL',
                last_synced_at: new Date().toISOString(),
              });
              return true;
            }
          } catch (e: any) {
            console.warn(`[updateQuotesJob] Falha/Timeout em ${inv.code_ticker}:`, e?.message || e);
          }
          return false;
        })
      );
      updatedCount += batchResults.filter(Boolean).length;
    }

    console.log(`[updateQuotesJob] Concluído: ${updatedCount} ativos atualizados.`);
    return updatedCount;
  } catch (err) {
    console.error('[updateQuotesJob] Erro ao atualizar cotações:', err);
    return 0;
  }
}
