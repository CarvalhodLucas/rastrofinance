import { getAllInvestments, upsertInvestment } from '../services/supabaseService.js';
import { getUsdBrlRate, processQuoteTicker } from '../services/quoteService.js';

export async function runUpdateQuotesJob(): Promise<number> {
  console.log('[updateQuotesJob] Iniciando atualização de cotações...');
  try {
    const investments = await getAllInvestments();
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

    const fetchWithTimeout = <T>(promise: Promise<T>, timeoutMs = 4000): Promise<T> => {
      let timer: any;
      const timeoutPromise = new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Timeout')), timeoutMs);
      });
      return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
    };

    const updatePromises = quoteEligibleInvestments.map(async (inv) => {
      try {
        const quote = await fetchWithTimeout(processQuoteTicker(inv.code_ticker, 'compact', true), 4000);
        if (quote && quote.price && quote.price > 0 && !quote.error) {
          const rawPrice = Number(quote.price);

          const isCryptoAsset =
            inv.asset_type === 'CRYPTO' ||
            inv.currency === 'USD' ||
            inv.currency === 'USDT' ||
            inv.institution === 'Binance' ||
            ['BTC', 'ETH', 'SOL', 'ONDO', 'SXT', 'LINK', 'RENDER', 'ROSE', 'VIRTUAL'].includes(inv.code_ticker.toUpperCase());

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
      } catch (e) {
        console.warn(`[updateQuotesJob] Falha/Timeout em ${inv.code_ticker}:`, e);
      }
      return false;
    });

    const results = await Promise.all(updatePromises);
    const updatedCount = results.filter(Boolean).length;
    console.log(`[updateQuotesJob] Concluído: ${updatedCount} ativos atualizados.`);
    return updatedCount;
  } catch (err) {
    console.error('[updateQuotesJob] Erro ao atualizar cotações:', err);
    return 0;
  }
}
