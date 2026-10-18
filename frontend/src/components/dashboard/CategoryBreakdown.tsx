import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/States';
import { categoryMeta } from '@/lib/categories';
import { useFmt } from '@/contexts/CurrencyContext';
import type { CategorySummary } from '@/types/finance';

interface Props {
  data: CategorySummary[];
  loading: boolean;
}

export function CategoryBreakdown({ data, loading }: Props) {
  const fmt = useFmt();
  const slices = useMemo(() => {
    const total = data.reduce((acc, d) => acc + d.total, 0);
    return data.slice(0, 6).map((d) => ({
      ...d,
      pct: total > 0 ? (d.total / total) * 100 : 0,
      color: categoryMeta(d.category).color,
      icon: categoryMeta(d.category).icon,
    }));
  }, [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Categorias do mês</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-6">
            <Skeleton className="h-40 w-40 rounded-full" />
            <div className="flex-1 space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          </div>
        ) : slices.length === 0 ? (
          <EmptyState
            title="Sem dados de categoria"
            description="As categorias aparecem após a IA classificar suas transações."
          />
        ) : (
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <div className="h-40 w-40 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="total"
                    nameKey="category"
                    innerRadius={48}
                    outerRadius={72}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {slices.map((s) => (
                      <Cell key={s.category} fill={s.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => fmt(value)}
                    contentStyle={{
                      background: '#1C2333',
                      border: '1px solid #2D3748',
                      borderRadius: 8,
                      color: '#F9FAFB',
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex-1 space-y-2 self-stretch">
              {slices.map((s) => (
                <li
                  key={s.category}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span className="flex items-center gap-2 text-text-secondary">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: s.color }}
                    />
                    {s.category}
                  </span>
                  <span className="font-mono tabular-nums text-text-primary tnum">
                    {s.pct.toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
