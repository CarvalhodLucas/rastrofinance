import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { useFmt, useFmtCompact } from '@/contexts/CurrencyContext';
import { useSmartSheet } from '@/contexts/SmartSheetContext';

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number; payload: { label: string; isProjection?: boolean } }>;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  const fmt = useFmt();
  if (!active || !payload?.length) return null;
  const entry = payload[0]!;
  const isProjection = entry.payload.isProjection;
  return (
    <div className="rounded-lg border border-border bg-bg-card px-3 py-2 shadow-lg">
      <p className="text-xs font-medium text-text-primary">
        {entry.payload.label}{isProjection ? ' (projeção)' : ''}
      </p>
      <p className="mt-0.5 font-mono text-sm font-semibold text-accent-gold">{fmt(entry.value)}</p>
    </div>
  );
}

export function ProjectionChart() {
  const fmtCompact = useFmtCompact();
  const { state } = useSmartSheet();
  const { viewType, chartData } = state;

  if (viewType !== 'projection' || chartData.length === 0) return null;

  return (
    <div className="border-t border-border bg-bg-card px-4 pb-4 pt-3 md:px-6">
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-text-secondary">
        <span>📈</span> Evolução e projeção
        <span className="ml-auto flex items-center gap-2 font-normal normal-case tracking-normal">
          <span className="inline-block h-2.5 w-4 rounded-sm bg-accent-gold/70" /> Real
          <span className="inline-block h-2.5 w-4 rounded-sm border border-dashed border-accent-gold bg-transparent" /> Projeção
        </span>
      </p>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(45,55,72,0.8)" />
          <XAxis dataKey="label" tick={{ fill: '#9CA3AF', fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={(v: number) => fmtCompact(v)} tick={{ fill: '#9CA3AF', fontSize: 10 }} axisLine={false} tickLine={false} width={60} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(245,158,11,0.05)' }} />
          <Bar dataKey="total" radius={[4, 4, 0, 0]}>
            {(chartData as Array<{ isProjection?: boolean }>).map((entry, i) => (
              <Cell key={i} fill={entry.isProjection ? 'transparent' : '#F59E0B'} stroke={entry.isProjection ? '#F59E0B' : 'none'} strokeWidth={entry.isProjection ? 1.5 : 0} strokeDasharray={entry.isProjection ? '4 2' : 'none'} fillOpacity={entry.isProjection ? 0.2 : 0.85} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
