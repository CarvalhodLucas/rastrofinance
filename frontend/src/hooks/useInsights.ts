import { useCallback, useEffect, useState } from 'react';
import { api } from '@/services/api';
import type { AiInsight, InsightType } from '@/types/finance';

export function useInsights(type?: InsightType) {
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { insights } = await api.getInsights(type);
      setInsights(insights);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar insights.');
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    void load();
  }, [load]);

  return { insights, loading, error, reload: load };
}

export function useLatestInsights() {
  const [insights, setInsights] = useState<AiInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { insights } = await api.getLatestInsights();
      setInsights(insights);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar insights.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** Helper: retorna o insight mais recente de um tipo. */
  const byType = useCallback(
    (type: InsightType): AiInsight | undefined =>
      insights.find((i) => i.type === type),
    [insights],
  );

  return { insights, byType, loading, error, reload: load };
}
