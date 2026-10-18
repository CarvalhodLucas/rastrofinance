import OpenAI from 'openai';
import { env } from '../config/env.js';
import { supabase } from './supabaseService.js';

const openai = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: env.OPENROUTER_API_KEY,
  defaultHeaders: { 'X-Title': 'Rastro Finance' },
});

// --- Types ---

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

export interface SheetResult {
  viewType: string;
  title: string;
  columns: SheetColumn[];
  rows: SheetRow[];
  summaryPills: SummaryPill[];
  insight: string;
  chartData: ChartDataPoint[];
  suggestions: Array<{ id: string; message: string; action: string; actionLabel: string }>;
  extraRows?: SheetRow[];
  extraColumns?: SheetColumn[];
}

// --- Period helpers ---

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getPeriodDates(period: string): { start: string; end: string } {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  const d15 = new Date(); d15.setDate(now.getDate() - 15);
  const d30 = new Date(); d30.setDate(now.getDate() - 30);

  const cases: Record<string, [Date, Date]> = {
    last_15_days:  [d15, now],
    last_30_days:  [d30, now],
    last_month:    [new Date(y, m - 1, 1), new Date(y, m, 0)],
    last_3_months: [new Date(y, m - 2, 1), new Date(y, m + 1, 0)],
    last_6_months: [new Date(y, m - 5, 1), new Date(y, m + 1, 0)],
    this_year:     [new Date(y, 0, 1),     new Date(y, 11, 31)],
    current_month: [new Date(y, m, 1),     new Date(y, m + 1, 0)],
  };

  if (period.includes(':')) {
    const [startStr, endStr] = period.split(':');
    if (startStr && endStr) return { start: startStr, end: endStr };
  }

  const pair = cases[period] ?? cases['current_month']!;
  return { start: fmt(pair[0]), end: fmt(pair[1]) };
}

function getMonthDates(ym: string): { start: string; end: string } {
  const [y, mo] = ym.split('-').map(Number) as [number, number];
  return { start: fmt(new Date(y, mo - 1, 1)), end: fmt(new Date(y, mo, 0)) };
}

function fmtMonthLabel(ym: string): string {
  const [y, mo] = ym.split('-').map(Number) as [number, number];
  return new Date(y, mo - 1, 1).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}

// --- View builders ---

async function buildDREView(period: string): Promise<SheetResult> {
  const { start, end } = getPeriodDates(period);
  const { data, error } = await supabase
    .from('transactions')
    .select('id, category, amount, merchant_name, description, date, transaction_type')
    .gte('date', start).lte('date', end);
  if (error) throw error;

  let totalIncome = 0;
  let totalExpense = 0;

  const incomeGrouped: Record<string, { category: string; count: number; total: number; subItems: SheetRow[] }> = {};
  const expenseGrouped: Record<string, { category: string; count: number; total: number; subItems: SheetRow[] }> = {};

  for (const tx of (data ?? [])) {
    const amt = tx.amount as number;
    const cat = (tx.category as string) || (amt > 0 ? 'Receitas Diversas' : 'Outros');
    const absVal = Math.abs(amt);

    if (amt > 0) {
      totalIncome += amt;
      if (!incomeGrouped[cat]) incomeGrouped[cat] = { category: cat, count: 0, total: 0, subItems: [] };
      incomeGrouped[cat].count++;
      incomeGrouped[cat].total += amt;
      incomeGrouped[cat].subItems.push({
        id: tx.id as string, category: ((tx.merchant_name ?? tx.description) as string) || cat,
        count: null, total: amt, pct: null, rowType: 'income', date: tx.date as string,
      });
    } else {
      totalExpense += absVal;
      if (!expenseGrouped[cat]) expenseGrouped[cat] = { category: cat, count: 0, total: 0, subItems: [] };
      expenseGrouped[cat].count++;
      expenseGrouped[cat].total += absVal;
      expenseGrouped[cat].subItems.push({
        id: tx.id as string, category: ((tx.merchant_name ?? tx.description) as string) || cat,
        count: null, total: absVal, pct: null, rowType: 'expense', date: tx.date as string,
      });
    }
  }

  const sortedIncome = Object.values(incomeGrouped).sort((a, b) => b.total - a.total);
  const sortedExpense = Object.values(expenseGrouped).sort((a, b) => b.total - a.total);
  const netBalance = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? (netBalance / totalIncome) * 100 : 0;

  const rows: SheetRow[] = [
    // Header 1: RECEITAS
    {
      id: 'hdr-income',
      category: '🟢 RECEITAS (ENTRADAS)',
      count: sortedIncome.reduce((s, i) => s + i.count, 0),
      total: totalIncome,
      pct: 100,
      isSectionHeader: true,
      rowType: 'header',
      formula: '=SOMA(RECEITAS_CATEGORIAS)',
    },
    ...sortedIncome.map((g) => ({
      id: `inc-cat-${g.category}`,
      category: g.category,
      count: g.count,
      total: g.total,
      pct: totalIncome > 0 ? (g.total / totalIncome) * 100 : 0,
      rowType: 'income' as const,
      subRows: g.subItems,
    })),

    // Header 2: DÉBITOS
    {
      id: 'hdr-expense',
      category: '🔴 DÉBITOS (SAÍDAS)',
      count: sortedExpense.reduce((s, e) => s + e.count, 0),
      total: totalExpense,
      pct: 100,
      isSectionHeader: true,
      rowType: 'header',
      formula: '=SOMA(DÉBITOS_CATEGORIAS)',
    },
    ...sortedExpense.map((g) => ({
      id: `exp-cat-${g.category}`,
      category: g.category,
      count: g.count,
      total: g.total,
      pct: totalExpense > 0 ? (g.total / totalExpense) * 100 : 0,
      rowType: 'expense' as const,
      subRows: g.subItems,
    })),

    // Net Result Row
    {
      id: 'net-result',
      category: netBalance >= 0 ? '⚖️ SOBRA LÍQUIDA (LUCRO)' : '⚠️ DÉFICIT DO PERÍODO',
      count: (data ?? []).length,
      total: netBalance,
      pct: savingsRate,
      isSectionHeader: true,
      rowType: 'net' as const,
      formula: '=TOTAL_RECEITAS - TOTAL_DÉBITOS',
    },
  ];

  return {
    viewType: 'dre',
    title: 'Receitas x Débitos (Demonstração Financeira)',
    columns: [
      { key: 'category', label: 'Categoria / Rubrica', type: 'badge', sortable: true, width: 'lg' },
      { key: 'count',    label: 'Qtd Tx',             type: 'count', sortable: true, width: 'sm' },
      { key: 'total',    label: 'Valor Total',        type: 'currency', sortable: true, width: 'md' },
      { key: 'pct',      label: '% do Grupo',         type: 'percentage', sortable: true, width: 'md' },
    ],
    rows,
    summaryPills: [
      { label: 'Total Receitas', value: totalIncome.toFixed(2), color: 'green' },
      { label: 'Total Débitos',  value: totalExpense.toFixed(2), color: 'red' },
      { label: 'Saldo Líquido',  value: netBalance.toFixed(2), color: netBalance >= 0 ? 'green' : 'red' },
      { label: 'Taxa de Poupança', value: `${savingsRate.toFixed(1)}%`, color: savingsRate >= 20 ? 'green' : savingsRate >= 0 ? 'gold' : 'red' },
    ],
    insight: totalIncome > 0 || totalExpense > 0
      ? `Sobra líquida do período: ${netBalance >= 0 ? '+' : ''}${netBalance.toFixed(2)} com taxa de poupança de ${savingsRate.toFixed(1)}%. (Receitas: ${totalIncome.toFixed(2)} | Débitos: ${totalExpense.toFixed(2)})`
      : 'Nenhuma transação encontrada para este período.',
    chartData: [
      { label: 'Receitas', valor: totalIncome },
      { label: 'Débitos',  valor: totalExpense },
      { label: 'Saldo Líquido', valor: netBalance },
    ],
    suggestions: [],
  };
}

async function buildCashflowView(period: string): Promise<SheetResult> {
  const { start, end } = getPeriodDates(period);
  const { data, error } = await supabase
    .from('transactions')
    .select('id, date, description, merchant_name, transaction_type, amount')
    .gte('date', start).lte('date', end)
    .order('date', { ascending: true });
  if (error) throw error;

  let balance = 0;
  let totalIn = 0;
  let totalOut = 0;

  const rows: SheetRow[] = (data ?? []).map((tx) => {
    const amt = tx.amount as number;
    if (amt > 0) totalIn += amt; else totalOut += Math.abs(amt);
    balance += amt;
    return {
      id: tx.id as string,
      date: tx.date as string,
      description: ((tx.merchant_name ?? tx.description) as string) || '',
      txType: tx.transaction_type as string,
      rowType: amt > 0 ? 'income' : 'expense',
      entrada: amt > 0 ? amt : null,
      saida: amt < 0 ? Math.abs(amt) : null,
      saldo: balance,
      formula: `=BALANÇO_ANTERIOR ${amt >= 0 ? '+' : '-'} ${Math.abs(amt).toFixed(2)}`,
    };
  });

  return {
    viewType: 'cashflow', title: 'Fluxo de Caixa',
    columns: [
      { key: 'date',        label: 'Data',            type: 'date',     sortable: true,  width: 'sm' },
      { key: 'description', label: 'Descrição',        type: 'text',     sortable: false, width: 'lg' },
      { key: 'txType',      label: 'Tipo',             type: 'badge',    sortable: false, width: 'sm' },
      { key: 'entrada',     label: 'Entrada (Receita)', type: 'currency', sortable: true,  width: 'md' },
      { key: 'saida',       label: 'Saída (Débito)',   type: 'currency', sortable: true,  width: 'md' },
      { key: 'saldo',       label: 'Saldo Acumulado',  type: 'currency', sortable: false, width: 'md' },
    ],
    rows,
    summaryPills: [
      { label: 'Total entradas', value: totalIn.toFixed(2),              color: 'green' },
      { label: 'Total saídas',   value: totalOut.toFixed(2),             color: 'red' },
      { label: 'Saldo',          value: (totalIn - totalOut).toFixed(2), color: totalIn >= totalOut ? 'green' : 'red' },
      { label: 'Transações',     value: String(rows.length) },
    ],
    insight: '', chartData: [], suggestions: [],
  };
}

async function buildCategoryView(period: string): Promise<SheetResult> {
  const { start, end } = getPeriodDates(period);
  const { data, error } = await supabase
    .from('transactions')
    .select('id, category, amount, merchant_name, description, date')
    .gte('date', start).lte('date', end);
  if (error) throw error;

  const grouped: Record<string, {
    category: string; count: number; total: number; max: number; isIncome: boolean;
    subItems: Array<{ id: string; label: string; value: number; date: string }>;
  }> = {};

  for (const tx of (data ?? [])) {
    const cat = (tx.category as string) ?? 'Outros';
    const isIncome = (tx.amount as number) > 0;
    if (!grouped[cat]) grouped[cat] = { category: cat, count: 0, total: 0, max: 0, isIncome, subItems: [] };
    const abs = Math.abs(tx.amount as number);
    grouped[cat].count++;
    grouped[cat].total += abs;
    if (abs > grouped[cat].max) grouped[cat].max = abs;
    grouped[cat].subItems.push({ id: tx.id as string, label: ((tx.merchant_name ?? tx.description) as string) ?? '', value: abs, date: tx.date as string });
  }

  const grandTotal = Object.values(grouped).reduce((s, g) => s + g.total, 0);
  const sorted = Object.values(grouped).sort((a, b) => b.total - a.total);

  const rows: SheetRow[] = sorted.map((g) => ({
    id: `cat-${g.category}`,
    category: g.category, count: g.count, total: g.total,
    pct: grandTotal > 0 ? (g.total / grandTotal) * 100 : 0,
    maxSingle: g.max,
    avg: g.count > 0 ? g.total / g.count : 0,
    rowType: g.isIncome ? 'income' : 'expense',
    subRows: g.subItems.map((item) => ({
      id: item.id, category: item.label, count: null, total: item.value,
      pct: null, maxSingle: null, avg: null, date: item.date, rowType: g.isIncome ? 'income' : 'expense',
    })),
  }));

  return {
    viewType: 'categories', title: 'Visão por Categoria',
    columns: [
      { key: 'category',  label: 'Categoria',       type: 'badge',      sortable: true,  width: 'md' },
      { key: 'count',     label: 'Qtd',             type: 'count',      sortable: true,  width: 'sm' },
      { key: 'total',     label: 'Total Movimentado', type: 'currency', sortable: true,  width: 'md' },
      { key: 'pct',       label: '% do Total',      type: 'percentage', sortable: true,  width: 'md' },
      { key: 'maxSingle', label: 'Maior Valor',     type: 'currency',   sortable: true,  width: 'md' },
      { key: 'avg',       label: 'Média/Transação', type: 'currency',   sortable: true,  width: 'md' },
    ],
    rows,
    summaryPills: [
      { label: 'Movimentação total', value: grandTotal.toFixed(2), color: 'gold' },
      { label: 'Categorias',         value: String(sorted.length) },
      { label: 'Transações',         value: String(data?.length ?? 0) },
      { label: 'Maior categoria',    value: sorted[0]?.category ?? '—' },
    ],
    insight: '',
    chartData: sorted.slice(0, 6).map((g) => ({ label: g.category, valor: g.total })),
    suggestions: [],
  };
}

async function buildComparisonView(): Promise<SheetResult> {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth() + 1;

  const getYm = (offset: number) => {
    let yr = y; let mo = m - offset;
    while (mo <= 0) { mo += 12; yr--; }
    return `${yr}-${String(mo).padStart(2, '0')}`;
  };
  const compareMonths = [getYm(2), getYm(1), getYm(0)];

  const monthIncome: Record<string, number> = {};
  const monthExpense: Record<string, number> = {};
  const monthCatData: Record<string, Record<string, number>> = {};

  for (const ym of compareMonths) {
    const { start, end } = getMonthDates(ym);
    const { data } = await supabase.from('transactions').select('category, amount')
      .gte('date', start).lte('date', end);

    monthIncome[ym] = 0;
    monthExpense[ym] = 0;
    monthCatData[ym] = {};

    for (const tx of (data ?? [])) {
      const cat = (tx.category as string) ?? 'Outros';
      const amt = tx.amount as number;
      if (amt > 0) {
        monthIncome[ym] = (monthIncome[ym] ?? 0) + amt;
      } else {
        const absVal = Math.abs(amt);
        monthExpense[ym] = (monthExpense[ym] ?? 0) + absVal;
      }
      monthCatData[ym][cat] = (monthCatData[ym][cat] ?? 0) + Math.abs(amt);
    }
  }

  const allCats = new Set<string>();
  for (const mData of Object.values(monthCatData)) for (const cat of Object.keys(mData)) allCats.add(cat);

  const categoryRows: SheetRow[] = Array.from(allCats).map((cat) => {
    const vals = compareMonths.map((ym) => monthCatData[ym]?.[cat] ?? 0);
    const first = vals[0] ?? 0;
    const last = vals[vals.length - 1] ?? 0;
    const prev = vals[vals.length - 2] ?? 0;
    const variation = first > 0 ? ((last - first) / first) * 100 : 0;
    const trend = last > prev * 1.05 ? '↗' : last < prev * 0.95 ? '↘' : '→';
    const row: SheetRow = { id: `cmp-${cat}`, category: cat, trend, totalVariation: variation };
    compareMonths.forEach((ym, i) => { row[`m${i}`] = vals[i] ?? 0; });
    return row;
  }).sort((a, b) => ((b[`m${compareMonths.length - 1}`] as number) ?? 0) - ((a[`m${compareMonths.length - 1}`] as number) ?? 0));

  const m0 = compareMonths[0] ?? '';
  const m1 = compareMonths[1] ?? '';
  const m2 = compareMonths[2] ?? '';

  const incM0 = monthIncome[m0] ?? 0;
  const incM1 = monthIncome[m1] ?? 0;
  const incM2 = monthIncome[m2] ?? 0;

  const expM0 = monthExpense[m0] ?? 0;
  const expM1 = monthExpense[m1] ?? 0;
  const expM2 = monthExpense[m2] ?? 0;

  // Build top comparison rows for Income, Expenses, and Net Result
  const incomeRow: SheetRow = {
    id: 'cmp-row-income',
    category: '🟢 TOTAL RECEITAS',
    trend: incM2 > incM1 ? '↗' : '↘',
    totalVariation: incM0 > 0 ? ((incM2 - incM0) / incM0) * 100 : 0,
    rowType: 'income' as const,
    isSectionHeader: true,
  };
  compareMonths.forEach((ym, i) => { incomeRow[`m${i}`] = monthIncome[ym] ?? 0; });

  const expenseRow: SheetRow = {
    id: 'cmp-row-expense',
    category: '🔴 TOTAL DÉBITOS',
    trend: expM2 > expM1 ? '↗' : '↘',
    totalVariation: expM0 > 0 ? ((expM2 - expM0) / expM0) * 100 : 0,
    rowType: 'expense' as const,
    isSectionHeader: true,
  };
  compareMonths.forEach((ym, i) => { expenseRow[`m${i}`] = monthExpense[ym] ?? 0; });

  const netRow: SheetRow = {
    id: 'cmp-row-net',
    category: '⚖️ SOBRA LÍQUIDA',
    trend: (incM2 - expM2) >= 0 ? '↗' : '↘',
    totalVariation: 0,
    rowType: 'net' as const,
    isSectionHeader: true,
  };
  compareMonths.forEach((ym, i) => { netRow[`m${i}`] = (monthIncome[ym] ?? 0) - (monthExpense[ym] ?? 0); });

  const rows: SheetRow[] = [incomeRow, expenseRow, netRow, ...categoryRows];

  return {
    viewType: 'comparison', title: 'Comparar Meses (Receitas x Débitos)',
    columns: [
      { key: 'category', label: 'Rubrica / Categoria', type: 'badge', sortable: true, width: 'lg' },
      ...compareMonths.map((ym, i) => ({ key: `m${i}`, label: fmtMonthLabel(ym), type: 'currency' as const, sortable: true, width: 'md' as const })),
      { key: 'trend',         label: 'Tendência', type: 'trend',     sortable: false, width: 'sm' },
      { key: 'totalVariation',label: 'Variação',  type: 'variation', sortable: true,  width: 'sm' },
    ],
    rows,
    summaryPills: compareMonths.map((ym, i) => ({
      label: `${fmtMonthLabel(ym)} (Saldo)`,
      value: ((monthIncome[ym] ?? 0) - (monthExpense[ym] ?? 0)).toFixed(2),
      color: ((monthIncome[ym] ?? 0) - (monthExpense[ym] ?? 0)) >= 0 ? 'green' : 'red',
    })),
    insight: '',
    chartData: compareMonths.map((ym) => ({
      label: fmtMonthLabel(ym),
      Receitas: monthIncome[ym] ?? 0,
      Débitos: monthExpense[ym] ?? 0,
      Saldo: (monthIncome[ym] ?? 0) - (monthExpense[ym] ?? 0),
    })),
    suggestions: [],
  };
}

async function buildSubscriptionsView(period: string): Promise<SheetResult> {
  const { start, end } = getPeriodDates(period);
  const { data, error } = await supabase
    .from('transactions')
    .select('merchant_name, description, category, amount, date')
    .eq('is_recurring', true).lt('amount', 0)
    .gte('date', start).lte('date', end);
  if (error) throw error;

  const grouped: Record<string, { merchant: string; category: string; value: number; lastDate: string }> = {};
  for (const tx of (data ?? [])) {
    const key = ((tx.merchant_name ?? tx.description) as string) ?? 'Desconhecido';
    if (!grouped[key] || (tx.date as string) > grouped[key].lastDate) {
      grouped[key] = { merchant: key, category: (tx.category as string) ?? 'Outros', value: Math.abs(tx.amount as number), lastDate: tx.date as string };
    }
  }

  const today = new Date();
  const rows: SheetRow[] = Object.values(grouped)
    .sort((a, b) => b.value - a.value)
    .map((s, idx) => {
      const daysSince = Math.floor((today.getTime() - new Date(s.lastDate).getTime()) / 86400000);
      return { id: `sub-${idx}`, merchant: s.merchant, category: s.category, monthly: s.value, annual: s.value * 12, lastPayment: s.lastDate, status: daysSince > 35 ? 'Suspeito' : 'Ativo' };
    });

  const totalMonthly = rows.reduce((s, r) => s + (r.monthly as number), 0);
  return {
    viewType: 'subscriptions', title: 'Assinaturas e Recorrentes',
    columns: [
      { key: 'merchant',    label: 'Serviço',          type: 'text',     sortable: true,  width: 'md' },
      { key: 'category',   label: 'Categoria',         type: 'badge',    sortable: true,  width: 'sm' },
      { key: 'monthly',    label: 'Valor Mensal',      type: 'currency', sortable: true,  width: 'md' },
      { key: 'annual',     label: 'Valor Anual',       type: 'currency', sortable: true,  width: 'md' },
      { key: 'lastPayment',label: 'Último Pagamento',  type: 'date',     sortable: true,  width: 'sm' },
      { key: 'status',     label: 'Status',            type: 'badge',    sortable: false, width: 'sm' },
    ],
    rows,
    summaryPills: [
      { label: 'Total/mês',    value: totalMonthly.toFixed(2),         color: 'red' },
      { label: 'Total/ano',    value: (totalMonthly * 12).toFixed(2),  color: 'red' },
      { label: 'Assinaturas',  value: String(rows.length) },
      { label: 'Ativos',       value: String(rows.filter((r) => r.status === 'Ativo').length), color: 'green' },
    ],
    insight: '', chartData: [], suggestions: [],
  };
}

async function buildProjectionView(): Promise<SheetResult> {
  const now = new Date();
  const y = now.getFullYear();
  const mo = now.getMonth() + 1;
  const ninetyAgo = new Date(now.getTime() - 90 * 86400000);
  const ninetyStart = fmt(ninetyAgo);
  const currentStart = `${y}-${String(mo).padStart(2, '0')}-01`;
  const today = fmt(now);
  const daysInMonth = new Date(y, mo, 0).getDate();
  const dayOfMonth = now.getDate();
  const histDays = Math.floor((now.getTime() - ninetyAgo.getTime()) / 86400000);
  const remaining = daysInMonth - dayOfMonth;

  const [{ data: histData }, { data: curData }] = await Promise.all([
    supabase.from('transactions').select('category, amount').gte('date', ninetyStart).lt('date', currentStart).lt('amount', 0),
    supabase.from('transactions').select('category, amount').gte('date', currentStart).lte('date', today).lt('amount', 0),
  ]);

  const dailyAvg: Record<string, number> = {};
  for (const tx of (histData ?? [])) {
    const cat = (tx.category as string) ?? 'Outros';
    dailyAvg[cat] = (dailyAvg[cat] ?? 0) + Math.abs(tx.amount as number);
  }
  for (const cat of Object.keys(dailyAvg)) dailyAvg[cat] = (dailyAvg[cat] ?? 0) / histDays;

  const curByCat: Record<string, number> = {};
  for (const tx of (curData ?? [])) {
    const cat = (tx.category as string) ?? 'Outros';
    curByCat[cat] = (curByCat[cat] ?? 0) + Math.abs(tx.amount as number);
  }

  const allCats = new Set([...Object.keys(dailyAvg), ...Object.keys(curByCat)]);
  const rows: SheetRow[] = Array.from(allCats)
    .map((cat) => {
      const avg3m = (dailyAvg[cat] ?? 0) * 30;
      const current = curByCat[cat] ?? 0;
      const projected = current + (dailyAvg[cat] ?? 0) * remaining;
      const variation = avg3m > 0 ? ((projected - avg3m) / avg3m) * 100 : 0;
      return { id: `proj-${cat}`, category: cat, avg3m, currentMonth: current, projected, variation };
    })
    .sort((a, b) => (b.projected as number) - (a.projected as number));

  const totalProjected = rows.reduce((s, r) => s + (r.projected as number), 0);
  const totalCurrent   = rows.reduce((s, r) => s + (r.currentMonth as number), 0);
  const totalAvg       = rows.reduce((s, r) => s + (r.avg3m as number), 0);

  return {
    viewType: 'projection', title: 'Projeção do Mês',
    columns: [
      { key: 'category',    label: 'Categoria',       type: 'badge',     sortable: true,  width: 'md' },
      { key: 'avg3m',       label: 'Média 3 Meses',   type: 'currency',  sortable: true,  width: 'md' },
      { key: 'currentMonth',label: 'Mês Atual',       type: 'currency',  sortable: true,  width: 'md' },
      { key: 'projected',   label: 'Projeção',        type: 'currency',  sortable: true,  width: 'md' },
      { key: 'variation',   label: 'Variação',        type: 'variation', sortable: true,  width: 'sm' },
    ],
    rows,
    summaryPills: [
      { label: 'Já gasto',       value: totalCurrent.toFixed(2),   color: 'red' },
      { label: 'Projeção total', value: totalProjected.toFixed(2), color: 'gold' },
      { label: 'Média histórica',value: totalAvg.toFixed(2) },
      { label: 'Dias restantes', value: String(remaining) },
    ],
    insight: '',
    chartData: [
      { label: 'Média 3m',  total: totalAvg },
      { label: 'Mês atual', total: totalCurrent },
      { label: 'Projeção',  total: totalProjected, isProjection: true },
    ],
    suggestions: [],
  };
}

async function buildOriginView(period: string): Promise<SheetResult> {
  const { start, end } = getPeriodDates(period);

  const [{ data: incData }, { data: expData }] = await Promise.all([
    supabase.from('transactions').select('description, merchant_name, transaction_type, amount').gte('date', start).lte('date', end).gt('amount', 0),
    supabase.from('transactions').select('merchant_name, description, category, amount').gte('date', start).lte('date', end).lt('amount', 0),
  ]);

  const incGrouped: Record<string, { label: string; type: string; total: number }> = {};
  let totalIncome = 0;
  for (const tx of (incData ?? [])) {
    const key = ((tx.merchant_name ?? tx.description) as string) ?? 'Outros';
    if (!incGrouped[key]) incGrouped[key] = { label: key, type: (tx.transaction_type as string) ?? 'CREDIT', total: 0 };
    incGrouped[key].total += tx.amount as number;
    totalIncome += tx.amount as number;
  }

  const expGrouped: Record<string, { label: string; category: string; total: number }> = {};
  let totalExpense = 0;
  for (const tx of (expData ?? [])) {
    const key = ((tx.merchant_name ?? tx.description) as string) ?? 'Outros';
    if (!expGrouped[key]) expGrouped[key] = { label: key, category: (tx.category as string) ?? 'Outros', total: 0 };
    expGrouped[key].total += Math.abs(tx.amount as number);
    totalExpense += Math.abs(tx.amount as number);
  }

  const incRows: SheetRow[] = Object.values(incGrouped).sort((a, b) => b.total - a.total)
    .map((g, i) => ({ id: `inc-${i}`, source: g.label, txType: g.type, value: g.total, pct: totalIncome > 0 ? (g.total / totalIncome) * 100 : 0 }));

  const expRows: SheetRow[] = Object.values(expGrouped).sort((a, b) => b.total - a.total).slice(0, 15)
    .map((g, i) => ({ id: `exp-${i}`, source: g.label, category: g.category, value: g.total, pct: totalExpense > 0 ? (g.total / totalExpense) * 100 : 0 }));

  return {
    viewType: 'origin', title: 'Origem / Destino',
    columns: [
      { key: 'source', label: 'Fonte',      type: 'text',       sortable: true,  width: 'lg' },
      { key: 'txType', label: 'Tipo',       type: 'badge',      sortable: false, width: 'sm' },
      { key: 'value',  label: 'Valor',      type: 'currency',   sortable: true,  width: 'md' },
      { key: 'pct',    label: '% Receita',  type: 'percentage', sortable: true,  width: 'md' },
    ],
    rows: incRows,
    summaryPills: [
      { label: 'Total entradas', value: totalIncome.toFixed(2),  color: 'green' },
      { label: 'Fontes',         value: String(incRows.length) },
      { label: 'Total saídas',   value: totalExpense.toFixed(2), color: 'red' },
      { label: 'Destinos',       value: String(expRows.length) },
    ],
    insight: '',
    chartData: incRows.slice(0, 5).map((r) => ({ label: r.source as string, valor: r.value as number })),
    suggestions: [],
    extraRows: expRows,
    extraColumns: [
      { key: 'source',   label: 'Destino',   type: 'text',       sortable: true,  width: 'lg' },
      { key: 'category', label: 'Categoria', type: 'badge',      sortable: true,  width: 'sm' },
      { key: 'value',    label: 'Total',     type: 'currency',   sortable: true,  width: 'md' },
      { key: 'pct',      label: '% Gasto',   type: 'percentage', sortable: true,  width: 'md' },
    ],
  };
}

async function buildXrayView(period: string, category = 'Alimentação'): Promise<SheetResult> {
  const { start, end } = getPeriodDates(period);
  const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  const { data } = await supabase
    .from('transactions')
    .select('id, date, merchant_name, description, amount, ai_notes')
    .eq('category', category)
    .gte('date', start).lte('date', end).lt('amount', 0)
    .order('date', { ascending: false });

  const rows: SheetRow[] = (data ?? []).map((tx) => ({
    id: tx.id as string,
    date: tx.date as string,
    merchant: ((tx.merchant_name ?? tx.description) as string) ?? '',
    value: Math.abs(tx.amount as number),
    dayOfWeek: DAY_NAMES[new Date(tx.date as string).getDay()] ?? '',
    notes: (tx.ai_notes as string) ?? '',
  }));

  const total = rows.reduce((s, r) => s + (r.value as number), 0);
  const max   = rows.reduce((m, r) => Math.max(m, r.value as number), 0);

  return {
    viewType: 'xray', title: `Raio-X: ${category}`,
    columns: [
      { key: 'date',      label: 'Data',            type: 'date',     sortable: true,  width: 'sm' },
      { key: 'merchant',  label: 'Estabelecimento', type: 'text',     sortable: true,  width: 'lg' },
      { key: 'value',     label: 'Valor',           type: 'currency', sortable: true,  width: 'md' },
      { key: 'dayOfWeek', label: 'Dia',             type: 'text',     sortable: false, width: 'sm' },
      { key: 'notes',     label: 'Observação IA',   type: 'text',     sortable: false, width: 'lg' },
    ],
    rows,
    summaryPills: [
      { label: 'Total gasto',      value: total.toFixed(2), color: 'red' },
      { label: 'Maior transação',  value: max.toFixed(2) },
      { label: 'Média/transação',  value: rows.length > 0 ? (total / rows.length).toFixed(2) : '0.00' },
      { label: 'Frequência',       value: `${rows.length}x` },
    ],
    insight: '',
    chartData: [...rows].reverse().slice(0, 30).map((r) => ({ label: r.date as string, valor: r.value as number })),
    suggestions: [],
  };
}

// --- AI ---

const COMMAND_SYSTEM = `Você é o motor de análise financeira do Rastro Finance.
Interprete comandos em português e retorne APENAS um JSON sem markdown.
Estrutura: {"view_type":"cashflow"|"categories"|"comparison"|"subscriptions"|"projection"|"origin"|"xray","period":"current_month"|"last_month"|"last_3_months"|"last_6_months","category_filter":null,"insight_prompt":"string"}
Exemplos:
- "compare junho com maio" → view_type:"comparison"
- "mostre assinaturas" → view_type:"subscriptions"
- "raio-x de delivery" → view_type:"xray",category_filter:"Restaurantes e Delivery"
- "de onde veio meu dinheiro" → view_type:"origin"
- "projete julho" → view_type:"projection"
Retorne APENAS o JSON.`;

const INSIGHT_SYSTEM = `Você é um analista financeiro pessoal brasileiro, direto e útil.
Com base nos dados financeiros, gere um insight narrativo em português.
Máximo 3 frases. Use números reais dos dados. Termine com sugestão prática. Tom conversacional, nunca formal.`;

export async function interpretCommand(command: string, period: string): Promise<SheetResult> {
  const aiRes = await openai.chat.completions.create({
    model: env.OPENROUTER_MODEL,
    max_tokens: 250,
    messages: [
      { role: 'system', content: COMMAND_SYSTEM },
      { role: 'user', content: `Período: ${period}\nComando: ${command}` },
    ],
  });

  const rawJson = aiRes.choices[0]?.message?.content ?? '{}';
  let instr: { view_type?: string; period?: string; category_filter?: string | null; insight_prompt?: string };

  try {
    const match = rawJson.match(/\{[\s\S]+\}/);
    instr = JSON.parse(match ? match[0] : rawJson) as typeof instr;
  } catch {
    throw new Error('Não entendi esse comando. Tente: "mostre gastos por categoria" ou "compare os últimos meses".');
  }

  const effectivePeriod = instr.period ?? period ?? 'current_month';
  const result = await getViewData(instr.view_type ?? 'categories', effectivePeriod, instr.category_filter ?? undefined);
  result.insight = await generateSheetInsight(result, instr.insight_prompt ?? `Analise ${result.title}`);
  return result;
}

export async function getViewData(viewName: string, period: string, categoryFilter?: string): Promise<SheetResult> {
  switch (viewName) {
    case 'dre':          return buildDREView(period);
    case 'grid':         return buildDREView(period);
    case 'cashflow':     return buildCashflowView(period);
    case 'categories':   return buildCategoryView(period);
    case 'comparison':   return buildComparisonView();
    case 'origin':       return buildOriginView(period);
    case 'subscriptions':return buildSubscriptionsView(period);
    case 'projection':   return buildProjectionView();
    case 'xray':         return buildXrayView(period, categoryFilter);
    default:             return buildDREView(period);
  }
}

export async function generateSheetInsight(data: SheetResult, prompt: string): Promise<string> {
  try {
    const summary = {
      viewType: data.viewType, title: data.title, pills: data.summaryPills,
      topRows: data.rows.slice(0, 5).map(({ subRows: _sub, ...rest }) => rest),
      prompt,
    };
    const res = await openai.chat.completions.create({
      model: env.OPENROUTER_MODEL, max_tokens: 300,
      messages: [
        { role: 'system', content: INSIGHT_SYSTEM },
        { role: 'user', content: JSON.stringify(summary) },
      ],
    });
    return res.choices[0]?.message?.content ?? '';
  } catch {
    return '';
  }
}

export async function getProactiveSuggestions(): Promise<Array<{ id: string; message: string; action: string; actionLabel: string }>> {
  const suggestions: Array<{ id: string; message: string; action: string; actionLabel: string }> = [];
  const now = new Date();
  const currentStart = fmt(new Date(now.getFullYear(), now.getMonth(), 1));
  const today = fmt(now);

  try {
    const { count: unc } = await supabase.from('transactions').select('id', { count: 'exact', head: true })
      .gte('date', currentStart).lte('date', today).or('category.is.null,category.eq.Outros');

    if ((unc ?? 0) > 3) {
      suggestions.push({ id: 'uncategorized', message: `Você tem ${unc ?? 0} transações sem categoria definida este mês.`, action: 'VIEW_CATEGORIES', actionLabel: 'Ver por categoria' });
    }

    if (suggestions.length < 2) {
      const ninetyAgo = fmt(new Date(now.getTime() - 90 * 86400000));
      const [{ data: histData }, { data: curData }] = await Promise.all([
        supabase.from('transactions').select('category, amount').gte('date', ninetyAgo).lt('date', currentStart).lt('amount', 0),
        supabase.from('transactions').select('category, amount').gte('date', currentStart).lte('date', today).lt('amount', 0),
      ]);

      if (histData && curData) {
        const histDays = Math.floor((now.getTime() - new Date(ninetyAgo).getTime()) / 86400000);
        const dom = now.getDate();
        const histByCat: Record<string, number> = {};
        const curByCat: Record<string, number> = {};
        for (const tx of histData) { const cat = (tx.category as string) ?? 'Outros'; histByCat[cat] = (histByCat[cat] ?? 0) + Math.abs(tx.amount as number); }
        for (const tx of curData)  { const cat = (tx.category as string) ?? 'Outros'; curByCat[cat]  = (curByCat[cat]  ?? 0) + Math.abs(tx.amount as number); }

        for (const [cat, cur] of Object.entries(curByCat)) {
          const histMonthly = ((histByCat[cat] ?? 0) / histDays) * 30;
          const projMonthly = (cur / dom) * 30;
          if (histMonthly > 50 && projMonthly > histMonthly * 1.35) {
            const pct = Math.round(((projMonthly - histMonthly) / histMonthly) * 100);
            suggestions.push({ id: `spike-${cat}`, message: `Gastos com "${cat}" estão ${pct}% acima da média. Projeção: R$ ${projMonthly.toFixed(0)}/mês.`, action: `VIEW_XRAY:${cat}`, actionLabel: 'Ver detalhes' });
            break;
          }
        }
      }
    }
  } catch { /* silently fail */ }

  return suggestions.slice(0, 2);
}
