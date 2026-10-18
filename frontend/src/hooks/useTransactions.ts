import { useCallback, useEffect, useState } from 'react';
import { api } from '@/services/api';
import type { Transaction, TransactionsSummary } from '@/types/finance';

interface Filters {
  month?: string;
  category?: string;
  account?: string;
}

export function useTransactions(filters: Filters) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { month, category, account } = filters;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { transactions } = await api.getTransactions({
        month,
        category,
        account,
      });
      setTransactions(transactions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar transações.');
    } finally {
      setLoading(false);
    }
  }, [month, category, account]);

  useEffect(() => {
    void load();
  }, [load]);

  return { transactions, loading, error, reload: load };
}

export function useSummary(month?: string) {
  const [summary, setSummary] = useState<TransactionsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSummary(await api.getSummary(month));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar o resumo.');
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void load();
  }, [load]);

  return { summary, loading, error, reload: load };
}

export function useAnomalies() {
  const [anomalies, setAnomalies] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { anomalies } = await api.getAnomalies();
      setAnomalies(anomalies);
    } catch {
      setAnomalies([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { anomalies, loading, reload: load };
}
