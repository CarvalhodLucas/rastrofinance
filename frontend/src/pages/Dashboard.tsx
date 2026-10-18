import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { SummaryCards } from '@/components/dashboard/SummaryCards';
import { WatchlistQuickWidget } from '@/components/dashboard/WatchlistQuickWidget';
import { SpendingChart } from '@/components/dashboard/SpendingChart';
import { CategoryBreakdown } from '@/components/dashboard/CategoryBreakdown';
import { AIInsightPanel } from '@/components/dashboard/AIInsightPanel';
import { AnomalyAlerts } from '@/components/dashboard/AnomalyAlerts';
import { TransactionList } from '@/components/dashboard/TransactionList';
import { TransactionDrawer } from '@/components/transactions/TransactionDrawer';
import { useSummary, useAnomalies } from '@/hooks/useTransactions';
import { useLatestInsights } from '@/hooks/useInsights';
import { api } from '@/services/api';
import { Link } from 'react-router-dom';
import type { Transaction } from '@/types/finance';

function monthString(offset = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function Dashboard() {
  const month = monthString(0);
  const { summary, loading: summaryLoading, error, reload } = useSummary(month);
  const { byType, loading: insightsLoading } = useLatestInsights();
  const { anomalies } = useAnomalies();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [prevSpent, setPrevSpent] = useState<number | undefined>();
  const [selected, setSelected] = useState<Transaction | null>(null);

  useEffect(() => {
    let active = true;
    setTxLoading(true);
    void (async () => {
      try {
        const [{ transactions }, prev] = await Promise.all([
          api.getTransactions({ month }),
          api.getSummary(monthString(-1)),
        ]);
        if (!active) return;
        setTransactions(transactions);
        setPrevSpent(prev.totalSpent);
      } catch {
        if (active) setTransactions([]);
      } finally {
        if (active) setTxLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [month]);

  const recent = useMemo(() => transactions.slice(0, 10), [transactions]);

  if (error) {
    return (
      <div className="p-4 md:p-8">
        <ErrorState message={error} onRetry={reload} />
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-6 md:p-8">
      <SummaryCards
        summary={summary}
        previousSpent={prevSpent}
        loading={summaryLoading}
      />

      <WatchlistQuickWidget />

      <AnomalyAlerts anomalies={anomalies} />

      <SpendingChart transactions={transactions} loading={txLoading} />

      <div className="grid gap-6 lg:grid-cols-2">
        <CategoryBreakdown
          data={summary?.byCategory ?? []}
          loading={summaryLoading}
        />
        <AIInsightPanel
          insight={byType('DAILY_SUMMARY') ?? byType('WEEKLY_ANALYSIS')}
          loading={insightsLoading}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Últimas transações</CardTitle>
          <Link to="/transactions">
            <Button variant="ghost" size="sm">
              Ver todas
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {txLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <EmptyState
              title="Nenhuma transação encontrada para este período."
              description="Conecte sua conta bancária para começar a análise automática."
              action={
                <Link to="/connect">
                  <Button size="sm">Conectar banco</Button>
                </Link>
              }
            />
          ) : (
            <TransactionList transactions={recent} onSelect={setSelected} />
          )}
        </CardContent>
      </Card>

      <TransactionDrawer
        transaction={selected}
        onClose={() => setSelected(null)}
        onUpdated={(tx) => {
          setTransactions((prev) =>
            prev.map((t) => (t.id === tx.id ? tx : t)),
          );
          setSelected(tx);
        }}
        onEdit={() => {}}
        onDeleted={() => {
          setSelected(null);
          void reload();
        }}
      />
    </div>
  );
}
