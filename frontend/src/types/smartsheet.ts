export interface SheetColumn {
  key: string;
  label: string;
  type: 'text' | 'currency' | 'percentage' | 'variation' | 'trend' | 'badge' | 'date' | 'count';
  sortable: boolean;
  width: 'auto' | 'sm' | 'md' | 'lg';
}

export interface SheetRow {
  id: string;
  subRows?: SheetRow[];
  isSectionHeader?: boolean;
  rowType?: 'income' | 'expense' | 'net' | 'header' | 'default';
  formula?: string;
  [key: string]: unknown;
}

export interface ChartDataPoint {
  label: string;
  [key: string]: string | number | boolean;
}

export interface SummaryPill {
  label: string;
  value: string;
  color?: string;
}

export interface Suggestion {
  id: string;
  message: string;
  action: string;
  actionLabel: string;
}

export interface SheetResult {
  viewType: string;
  title: string;
  columns: SheetColumn[];
  rows: SheetRow[];
  summaryPills: SummaryPill[];
  insight: string;
  chartData: ChartDataPoint[];
  suggestions: Suggestion[];
  extraRows?: SheetRow[];
  extraColumns?: SheetColumn[];
}

export const PERIOD_OPTIONS = [
  { value: 'current_month', label: 'Este mês (Padrão)' },
  { value: 'last_month',    label: 'Mês passado' },
  { value: 'last_15_days',  label: 'Últimos 15 dias' },
  { value: 'last_30_days',  label: 'Últimos 30 dias' },
  { value: 'last_3_months', label: 'Últimos 3 meses' },
  { value: 'last_6_months', label: 'Últimos 6 meses' },
  { value: 'this_year',     label: 'Este ano' },
  { value: 'custom',        label: '📅 Personalizado' },
] as const;

export const VIEWS = [
  { id: 'dre', label: 'Receitas x Débitos', icon: '⚖️' },
] as const;

