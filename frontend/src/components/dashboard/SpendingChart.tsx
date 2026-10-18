import { useMemo } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  type TooltipProps,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ChartSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/States';
import { formatDateShort } from '@/lib/format';
import { useFmt, useFmtCompact } from '@/contexts/CurrencyContext';
import type { Transaction } from '@/types/finance';

interface SpendingChartProps {
  transactions: Transaction[];
  loading: boolean;
}

interface Point {
  date: string;
  label: string;
  total: number;
}

function CustomTooltip({
  active,
  payload,
  average,
}: TooltipProps<number, string> & { average: number }) {
  const fmt = useFmt();
  if (!active || !payload?.length) return null;
  const value = payload[0]?.value ?? 0;
  const diffPct =
    average > 0 ? ((value - average) / average) * 100 : 0;
  const above = diffPct >= 0;
  return (
    <div className="rounded-lg border border-border bg-bg-elevated px-3 py-2 text-sm shadow-lg">
      <p className="font-mono font-semibold tnum text-text-primary">
        {fmt(value)}
      </p>
      <p className="text-xs text-text-secondary">
        {Math.abs(diffPct).toFixed(0)}% {above ? 'acima' : 'abaixo'} da média
      </p>
    </div>
  );
}

export function SpendingChart({ transactions, loading }: SpendingChartProps) {
  const fmtCompact = useFmtCompact();
  const { points, average } = useMemo(() => {
    // Agrupa gastos (amount < 0) por dia dos últimos 30 dias.
    const map = new Map<string, number>();
    for (const t of transactions) {
      if (t.amount >= 0) continue;
      map.set(t.date, (map.get(t.date) ?? 0) + Math.abs(t.amount));
    }

    const today = new Date();
    const pts: Point[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().split('T')[0] ?? '';
      pts.push({ date: iso, label: formatDateShort(iso), total: map.get(iso) ?? 0 });
    }

    const spentDays = pts.filter((p) => p.total > 0);
    const avg =
      spentDays.length > 0
        ? spentDays.reduce((acc, p) => acc + p.total, 0) / spentDays.length
        : 0;

    return { points: pts, average: avg };
  }, [transactions]);

  if (loading) return <ChartSkeleton />;

  const hasData = points.some((p) => p.total > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gastos por dia — últimos 30 dias</CardTitle>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <EmptyState
            title="Sem gastos no período"
            description="Conecte uma conta para visualizar a evolução dos seus gastos."
          />
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={points}
                margin={{ top: 8, right: 8, left: -8, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#EF4444" stopOpacity={0.25} />
                    <stop offset="100%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#2D3748" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#9CA3AF', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: '#2D3748' }}
                  interval={4}
                />
                <YAxis
                  tick={{ fill: '#9CA3AF', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => fmtCompact(v)}
                  width={64}
                />
                <Tooltip
                  content={<CustomTooltip average={average} />}
                  cursor={{ stroke: '#F59E0B', strokeOpacity: 0.3 }}
                />
                <ReferenceLine
                  y={average}
                  stroke="#F59E0B"
                  strokeDasharray="6 4"
                  strokeWidth={1.5}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  stroke="#EF4444"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: '#EF4444' }}
                  fill="url(#spendFill)"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
