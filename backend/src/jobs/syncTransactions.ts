import { syncAllAccounts } from '../services/pluggyService.js';
import {
  categorizeTransactions,
  detectAnomalies,
} from '../services/claudeService.js';
import {
  getPatterns,
  getRecentTransactions,
  getUncategorizedTransactions,
  insertInsight,
  markAnomaly,
  updateTransactionCategory,
} from '../services/supabaseService.js';
import { sendAnomalyAlert } from '../services/whatsappService.js';

/**
 * Pipeline completo de sincronização (roda às 06:00 e sob demanda):
 * 1) sync Pluggy → upsert no Supabase
 * 2) categoriza transações sem categoria (IA)
 * 3) grava categorias
 * 4) detecta anomalias (IA)
 * 5) marca anomalias + grava insight ANOMALY_ALERT
 * 6) envia alertas HIGH/MEDIUM no WhatsApp
 */
export async function runSync(force = false): Promise<{
  synced: number;
  categorized: number;
  anomalies: number;
}> {
  console.log('[job:sync] iniciando...');
  let synced = 0;
  try {
    synced = await syncAllAccounts(force);
  } catch (err) {
    console.error('[job:sync] erro ao sincronizar contas Pluggy:', err);
  }

  // --- Categorização ---
  let categorized = 0;
  try {
    const uncategorized = await getUncategorizedTransactions();
    if (uncategorized.length > 0) {
      const results = await categorizeTransactions(uncategorized);
      for (const r of results) {
        await updateTransactionCategory(r.pluggy_transaction_id, {
          category: r.category,
          subcategory: r.subcategory,
          is_essential: r.is_essential,
          is_recurring: r.is_recurring,
          merchant_name: r.merchant_name,
          ai_confidence: r.ai_confidence,
          ai_notes: r.ai_notes,
        });
        categorized += 1;
      }
    }
  } catch (err) {
    console.error('[job:sync] erro na categorização via IA:', err);
  }

  // --- Detecção de anomalias ---
  let anomaliesCount = 0;
  try {
    const [recent, patterns] = await Promise.all([
      getRecentTransactions(50),
      getPatterns(),
    ]);
    const anomalies = await detectAnomalies(recent, patterns);

    for (const anomaly of anomalies) {
      await markAnomaly(anomaly.pluggy_transaction_id, anomaly.reason);
      await insertInsight({
        type: 'ANOMALY_ALERT',
        period_start: anomaly.date,
        period_end: anomaly.date,
        title: `Anomalia ${anomaly.severity}: ${anomaly.description}`,
        narrative: anomaly.reason,
        data_snapshot: { ...anomaly },
      });
      await sendAnomalyAlert(anomaly).catch((err) =>
        console.error('[job:sync] falha ao enviar alerta WhatsApp:', err),
      );
    }
    anomaliesCount = anomalies.length;
  } catch (err) {
    console.error('[job:sync] erro na detecção de anomalias:', err);
  }

  console.log(
    `[job:sync] concluído — ${synced} sincronizadas, ${categorized} categorizadas, ${anomaliesCount} anomalias.`,
  );
  return { synced, categorized, anomalies: anomaliesCount };
}
