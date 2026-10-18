import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type Dispatch,
  type ReactNode,
} from 'react';
import { api } from '@/services/api';
import type { SheetColumn, SheetRow, ChartDataPoint, SummaryPill, Suggestion, SheetResult } from '@/types/smartsheet';

const HISTORY_KEY = 'rastro_smartsheet_history';
const DISMISSED_KEY = 'rastro_smartsheet_dismissed';

function loadHistory(): string[] {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '[]') as string[]; } catch { return []; }
}
function saveHistory(h: string[]) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, 20))); } catch { /* */ }
}
function loadDismissed(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(DISMISSED_KEY) ?? '{}') as Record<string, number>; } catch { return {}; }
}
function saveDismissed(d: Record<string, number>) {
  try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(d)); } catch { /* */ }
}

// Fallback generator when backend is offline
function getMockViewResult(viewId: string): SheetResult {
  if (viewId === 'comparison') {
    return {
      viewType: 'comparison',
      title: 'Comparar Meses (Receitas x Débitos)',
      columns: [
        { key: 'category', label: 'Rubrica / Categoria', type: 'badge', sortable: true, width: 'lg' },
        { key: 'm0', label: 'Jun/26', type: 'currency', sortable: true, width: 'md' },
        { key: 'm1', label: 'Jul/26', type: 'currency', sortable: true, width: 'md' },
        { key: 'm2', label: 'Ago/26', type: 'currency', sortable: true, width: 'md' },
        { key: 'trend', label: 'Tendência', type: 'trend', sortable: false, width: 'sm' },
        { key: 'totalVariation', label: 'Variação', type: 'variation', sortable: true, width: 'sm' },
      ],
      rows: [
        { id: 'cmp-inc', category: '🟢 TOTAL RECEITAS', m0: 8900, m1: 9200, m2: 9380, trend: '↗', totalVariation: 5.4, isSectionHeader: true, rowType: 'income' },
        { id: 'cmp-exp', category: '🔴 TOTAL DÉBITOS', m0: 6200, m1: 5850, m2: 6040, trend: '↘', totalVariation: -2.5, isSectionHeader: true, rowType: 'expense' },
        { id: 'cmp-net', category: '⚖️ SOBRA LÍQUIDA', m0: 2700, m1: 3350, m2: 3340, trend: '↗', totalVariation: 23.7, isSectionHeader: true, rowType: 'net' },
        { id: 'cmp-1', category: 'Moradia & Aluguel', m0: 2400, m1: 2400, m2: 2400, trend: '→', totalVariation: 0, rowType: 'expense' },
        { id: 'cmp-2', category: 'Alimentação & Mercado', m0: 1450, m1: 1300, m2: 1350, trend: '↘', totalVariation: -6.8, rowType: 'expense' },
        { id: 'cmp-3', category: 'Investimentos & Dividendos', m0: 450, m1: 600, m2: 680, trend: '↗', totalVariation: 51.1, rowType: 'income' },
        { id: 'cmp-4', category: 'Restaurantes & Delivery', m0: 950, m1: 780, m2: 850, trend: '↘', totalVariation: -10.5, rowType: 'expense' },
        { id: 'cmp-5', category: 'Transporte & Uber', m0: 700, m1: 650, m2: 620, trend: '↘', totalVariation: -11.4, rowType: 'expense' },
      ],
      summaryPills: [
        { label: 'Jun/26 (Saldo)', value: '2700.00', color: 'green' },
        { label: 'Jul/26 (Saldo)', value: '3350.00', color: 'green' },
        { label: 'Ago/26 (Saldo)', value: '3340.00', color: 'green' },
        { label: 'Crescimento de Sobra', value: '+23.7%', color: 'gold' },
      ],
      insight: 'Sua sobra líquida cresceu +23.7% nos últimos 3 meses graças ao aumento dos dividendos e redução nos gastos com restaurantes e transporte.',
      chartData: [
        { label: 'Jun/26', Receitas: 8900, Débitos: 6200, Saldo: 2700 },
        { label: 'Jul/26', Receitas: 9200, Débitos: 5850, Saldo: 3350 },
        { label: 'Ago/26', Receitas: 9380, Débitos: 6040, Saldo: 3340 },
      ],
      suggestions: [],
    };
  }
  if (viewId === 'cashflow') {
    return {
      viewType: 'cashflow',
      title: 'Fluxo de Caixa (Extrato de Lançamentos)',
      columns: [
        { key: 'date',        label: 'Data',             type: 'date',     sortable: true,  width: 'sm' },
        { key: 'description', label: 'Descrição / Lançamento', type: 'text', sortable: false, width: 'lg' },
        { key: 'txType',      label: 'Tipo',              type: 'badge',    sortable: false, width: 'sm' },
        { key: 'entrada',     label: 'Entrada (+)',       type: 'currency', sortable: true,  width: 'md' },
        { key: 'saida',       label: 'Saída (-)',         type: 'currency', sortable: true,  width: 'md' },
        { key: 'saldo',       label: 'Saldo Acumulado',   type: 'currency', sortable: false, width: 'md' },
      ],
      rows: [
        { id: 'cf-1', date: '2026-08-01', description: 'Salário Mensal Empresa XYZ', txType: 'Receita', rowType: 'income', entrada: 7500, saida: null, saldo: 7500 },
        { id: 'cf-2', date: '2026-08-02', description: 'Supermercado Continente', txType: 'Débito', rowType: 'expense', entrada: null, saida: 520, saldo: 6980 },
        { id: 'cf-3', date: '2026-08-03', description: 'Posto Galp Combustível', txType: 'Débito', rowType: 'expense', entrada: null, saida: 360, saldo: 6620 },
        { id: 'cf-4', date: '2026-08-05', description: 'Aluguel do Imóvel Mensal', txType: 'Débito', rowType: 'expense', entrada: null, saida: 1900, saldo: 4720 },
        { id: 'cf-5', date: '2026-08-08', description: 'Rendimentos PETR4 / VALE3', txType: 'Receita', rowType: 'income', entrada: 680, saida: null, saldo: 5400 },
        { id: 'cf-6', date: '2026-08-10', description: 'Consultoria Web Extra', txType: 'Receita', rowType: 'income', entrada: 1200, saida: null, saldo: 6600 },
        { id: 'cf-7', date: '2026-08-12', description: 'Restaurante O Basílio', txType: 'Débito', rowType: 'expense', entrada: null, saida: 290, saldo: 6310 },
      ],
      summaryPills: [
        { label: 'Total Entradas', value: '9380.00', color: 'green' },
        { label: 'Total Saídas',   value: '3070.00', color: 'red' },
        { label: 'Saldo Atual',    value: '6310.00', color: 'green' },
        { label: 'Lançamentos',    value: '7' },
      ],
      insight: 'Seu saldo acumulado no mês permaneceu positivo em todas as datas.',
      chartData: [],
      suggestions: [],
    };
  }

  if (viewId === 'categories') {
    return {
      viewType: 'categories',
      title: 'Visão por Categoria',
      columns: [
        { key: 'category',  label: 'Categoria',         type: 'badge',      sortable: true,  width: 'md' },
        { key: 'count',     label: 'Qtd Tx',            type: 'count',      sortable: true,  width: 'sm' },
        { key: 'total',     label: 'Total Movimentado', type: 'currency',   sortable: true,  width: 'md' },
        { key: 'pct',       label: '% do Total',        type: 'percentage', sortable: true,  width: 'md' },
        { key: 'maxSingle', label: 'Maior Valor',       type: 'currency',   sortable: true,  width: 'md' },
        { key: 'avg',       label: 'Média/Tx',          type: 'currency',   sortable: true,  width: 'md' },
      ],
      rows: [
        { id: 'cat-1', category: 'Salário & Remuneração', count: 1, total: 7500, pct: 48.6, maxSingle: 7500, avg: 7500, rowType: 'income' },
        { id: 'cat-2', category: 'Moradia & Aluguel', count: 3, total: 2400, pct: 15.6, maxSingle: 1900, avg: 800, rowType: 'expense' },
        { id: 'cat-3', category: 'Alimentação & Supermercado', count: 22, total: 1350, pct: 8.8, maxSingle: 520, avg: 61.3, rowType: 'expense' },
        { id: 'cat-4', category: 'Freelance & Projeto Extra', count: 2, total: 1200, pct: 7.8, maxSingle: 800, avg: 600, rowType: 'income' },
        { id: 'cat-5', category: 'Restaurantes & Delivery', count: 9, total: 850, pct: 5.5, maxSingle: 380, avg: 94.4, rowType: 'expense' },
        { id: 'cat-6', category: 'Saúde, Educação & Lazer', count: 9, total: 820, pct: 5.3, maxSingle: 320, avg: 91.1, rowType: 'expense' },
        { id: 'cat-7', category: 'Dividendos B3', count: 2, total: 680, pct: 4.4, maxSingle: 420, avg: 340, rowType: 'income' },
        { id: 'cat-8', category: 'Transporte & Combustível', count: 16, total: 620, pct: 4.0, maxSingle: 360, avg: 38.7, rowType: 'expense' },
      ],
      summaryPills: [
        { label: 'Movimentação Total', value: '15420.00', color: 'gold' },
        { label: 'Categorias Ativas',  value: '8' },
        { label: 'Maior Peso',         value: 'Salário (48.6%)' },
      ],
      insight: 'Moradia e Alimentação representam as duas maiores categorias de despesas.',
      chartData: [],
      suggestions: [],
    };
  }

  if (viewId === 'origin') {
    return {
      viewType: 'origin',
      title: 'Origem e Destino de Recursos',
      columns: [
        { key: 'category', label: 'Fonte de Origem (Entradas)', type: 'badge', sortable: true, width: 'lg' },
        { key: 'total',    label: 'Total Recebido',           type: 'currency', sortable: true, width: 'md' },
        { key: 'pct',      label: '% das Receitas',           type: 'percentage', sortable: true, width: 'md' },
      ],
      rows: [
        { id: 'ori-1', category: 'Empresa XYZ (Salário Direct Deposit)', total: 7500, pct: 80.0, rowType: 'income' },
        { id: 'ori-2', category: 'Clientes Freelance (PIX/Transferência)', total: 1200, pct: 12.8, rowType: 'income' },
        { id: 'ori-3', category: 'Corretora B3 (Proventos & FIIs)', total: 680, pct: 7.2, rowType: 'income' },
      ],
      extraColumns: [
        { key: 'category', label: 'Destino de Uso (Saídas)', type: 'badge', sortable: true, width: 'lg' },
        { key: 'total',    label: 'Total Pago',              type: 'currency', sortable: true, width: 'md' },
        { key: 'pct',      label: '% das Saídas',            type: 'percentage', sortable: true, width: 'md' },
      ],
      extraRows: [
        { id: 'dst-1', category: 'Imobiliária (Aluguel & Condomínio)', total: 2400, pct: 39.7, rowType: 'expense' },
        { id: 'dst-2', category: 'Supermercados & Mercados', total: 1350, pct: 22.4, rowType: 'expense' },
        { id: 'dst-3', category: 'Restaurantes & Apps de Entrega', total: 850, pct: 14.1, rowType: 'expense' },
        { id: 'dst-4', category: 'Postos de Combustível & Transporte', total: 620, pct: 10.3, rowType: 'expense' },
        { id: 'dst-5', category: 'Farmácias & Lazer', total: 820, pct: 13.5, rowType: 'expense' },
      ],
      summaryPills: [
        { label: 'Fontes Principais', value: '3 origens' },
        { label: 'Destinos Principais', value: '5 categorias' },
      ],
      insight: '80% da sua renda é proveniente do Salário principal.',
      chartData: [],
      suggestions: [],
    };
  }

  if (viewId === 'subscriptions') {
    return {
      viewType: 'subscriptions',
      title: 'Assinaturas e Recorrências',
      columns: [
        { key: 'service', label: 'Serviço / Assinatura', type: 'badge', sortable: true, width: 'lg' },
        { key: 'cost', label: 'Custo Mensal', type: 'currency', sortable: true, width: 'md' },
        { key: 'status', label: 'Status', type: 'badge', sortable: false, width: 'sm' },
        { key: 'dueDate', label: 'Próxima Cobrança', type: 'date', sortable: true, width: 'sm' },
      ],
      rows: [
        { id: 'sub-1', service: 'Netflix Premium 4K', cost: 55.90, status: 'Ativo', dueDate: '2026-08-15', rowType: 'expense' },
        { id: 'sub-2', service: 'Spotify Family Plan', cost: 34.90, status: 'Ativo', dueDate: '2026-08-18', rowType: 'expense' },
        { id: 'sub-3', service: 'Academia Mensalidade', cost: 149.00, status: 'Ativo', dueDate: '2026-08-20', rowType: 'expense' },
        { id: 'sub-4', service: 'Amazon Prime Video', cost: 19.90, status: 'Ativo', dueDate: '2026-08-25', rowType: 'expense' },
        { id: 'sub-5', service: 'iCloud 200GB Storage', cost: 14.90, status: 'Ativo', dueDate: '2026-08-28', rowType: 'expense' },
      ],
      summaryPills: [
        { label: 'Custo Total Recorrente', value: '274.60', color: 'red' },
        { label: 'Assinaturas Ativas', value: '5' },
      ],
      insight: 'Você gasta R$ 274,60 por mês com 5 assinaturas recorrentes.',
      chartData: [],
      suggestions: [],
    };
  }

  // Default DRE / Matriz mock view
  return {
    viewType: 'dre',
    title: 'Receitas x Débitos (Demonstração Financeira)',
    columns: [
      { key: 'category', label: 'Categoria / Rubrica', type: 'badge', sortable: true, width: 'lg' },
      { key: 'count', label: 'Qtd Tx', type: 'count', sortable: true, width: 'sm' },
      { key: 'total', label: 'Valor Total', type: 'currency', sortable: true, width: 'md' },
      { key: 'pct', label: '% do Grupo', type: 'percentage', sortable: true, width: 'md' },
    ],
    rows: [
      {
        id: 'hdr-income',
        category: '🟢 RECEITAS (ENTRADAS)',
        count: 5,
        total: 9380,
        pct: 100,
        isSectionHeader: true,
        rowType: 'header',
        formula: '=SOMA(RECEITAS)',
      },
      {
        id: 'inc-1',
        category: 'Salário & Remuneração',
        count: 1,
        total: 7500,
        pct: 80.0,
        rowType: 'income',
        subRows: [{ id: 'inc-sub-1', category: 'Folha de Pagamento Empresa XYZ', count: null, total: 7500, pct: null, date: '2026-08-05' }],
      },
      {
        id: 'inc-2',
        category: 'Freelance & Projeto Extra',
        count: 2,
        total: 1200,
        pct: 12.8,
        rowType: 'income',
        subRows: [
          { id: 'inc-sub-2a', category: 'Consultoria Web App', count: null, total: 800, pct: null, date: '2026-08-10' },
          { id: 'inc-sub-2b', category: 'Design Landing Page', count: null, total: 400, pct: null, date: '2026-08-12' },
        ],
      },
      {
        id: 'inc-3',
        category: 'Dividendos & Rendimentos B3',
        count: 2,
        total: 680,
        pct: 7.2,
        rowType: 'income',
        subRows: [
          { id: 'inc-sub-3a', category: 'Proventos PETR4 / VALE3', count: null, total: 420, pct: null, date: '2026-08-08' },
          { id: 'inc-sub-3b', category: 'Rendimento FIIs HGLG11', count: null, total: 260, pct: null, date: '2026-08-11' },
        ],
      },
      {
        id: 'hdr-expense',
        category: '🔴 DÉBITOS (SAÍDAS)',
        count: 59,
        total: 6040,
        pct: 100,
        isSectionHeader: true,
        rowType: 'header',
        formula: '=SOMA(DÉBITOS)',
      },
      {
        id: 'exp-1',
        category: 'Moradia & Aluguel',
        count: 3,
        total: 2400,
        pct: 39.7,
        rowType: 'expense',
        subRows: [
          { id: 'exp-sub-1a', category: 'Aluguel do Imóvel', count: null, total: 1900, pct: null, date: '2026-08-01' },
          { id: 'exp-sub-1b', category: 'Condomínio & IPTU', count: null, total: 500, pct: null, date: '2026-08-05' },
        ],
      },
      {
        id: 'exp-2',
        category: 'Alimentação & Supermercado',
        count: 22,
        total: 1350,
        pct: 22.4,
        rowType: 'expense',
        subRows: [
          { id: 'exp-sub-2a', category: 'Continente Bom Dia - Supermercado', count: null, total: 520, pct: null, date: '2026-08-02' },
          { id: 'exp-sub-2b', category: 'Pingo Doce Hipermercado', count: null, total: 430, pct: null, date: '2026-08-08' },
          { id: 'exp-sub-2c', category: 'Mercadona Alimentação', count: null, total: 400, pct: null, date: '2026-08-11' },
        ],
      },
      {
        id: 'exp-3',
        category: 'Restaurantes & Delivery',
        count: 9,
        total: 850,
        pct: 14.1,
        rowType: 'expense',
        subRows: [
          { id: 'exp-sub-3a', category: 'iFood & UberEats Delivery', count: null, total: 380, pct: null, date: '2026-08-04' },
          { id: 'exp-sub-3b', category: 'Restaurante O Basílio', count: null, total: 290, pct: null, date: '2026-08-09' },
          { id: 'exp-sub-3c', category: 'Café & Confeitaria Regional', count: null, total: 180, pct: null, date: '2026-08-12' },
        ],
      },
      {
        id: 'exp-4',
        category: 'Transporte & Combustível',
        count: 16,
        total: 620,
        pct: 10.3,
        rowType: 'expense',
        subRows: [
          { id: 'exp-sub-4a', category: 'Posto Galp / Combustível', count: null, total: 360, pct: null, date: '2026-08-03' },
          { id: 'exp-sub-4b', category: 'Uber Viagens Urbanas', count: null, total: 170, pct: null, date: '2026-08-07' },
          { id: 'exp-sub-4c', category: 'Estacionamento & Vias', count: null, total: 90, pct: null, date: '2026-08-10' },
        ],
      },
      {
        id: 'exp-5',
        category: 'Saúde, Educação & Lazer',
        count: 9,
        total: 820,
        pct: 13.5,
        rowType: 'expense',
        subRows: [
          { id: 'exp-sub-5a', category: 'Farmácia & Cuidados de Saúde', count: null, total: 290, pct: null, date: '2026-08-05' },
          { id: 'exp-sub-5b', category: 'Academia & Treinos Mensalidade', count: null, total: 210, pct: null, date: '2026-08-06' },
          { id: 'exp-sub-5c', category: 'Cinema & Streaming Entretenimento', count: null, total: 320, pct: null, date: '2026-08-09' },
        ],
      },
      {
        id: 'net-result',
        category: '⚖️ SOBRA LÍQUIDA DO PERÍODO',
        count: 64,
        total: 3340,
        pct: 35.6,
        isSectionHeader: true,
        rowType: 'net',
        formula: '=TOTAL_RECEITAS (9.380,00) - TOTAL_DÉBITOS (6.040,00)',
      },
    ],
    summaryPills: [
      { label: 'Total Receitas', value: '9380.00', color: 'green' },
      { label: 'Total Débitos', value: '6040.00', color: 'red' },
      { label: 'Saldo Líquido', value: '3340.00', color: 'green' },
      { label: 'Taxa de Poupança', value: '35.6%', color: 'gold' },
    ],
    insight: 'Excelente desempenho no mês! Suas receitas superaram os débitos em R$ 3.340,00, gerando uma taxa de poupança de 35.6%.',
    chartData: [
      { label: 'Receitas', valor: 9380 },
      { label: 'Débitos', valor: 6040 },
      { label: 'Sobra Líquida', valor: 3340 },
    ],
    suggestions: [
      { id: 'sug-1', message: 'Você poupou 35.6% da renda este mês. Que tal aplicar R$ 2.000 em investimentos?', action: 'VIEW_DRE', actionLabel: 'Ver Detalhes' },
    ],
  };
}

export interface SmartSheetState {
  activeView: string;
  period: string;
  viewType: string;
  title: string;
  columns: SheetColumn[];
  rows: SheetRow[];
  extraRows: SheetRow[];
  extraColumns: SheetColumn[];
  insight: string;
  isLoading: boolean;
  suggestions: Suggestion[];
  commandHistory: string[];
  chartData: ChartDataPoint[];
  summaryPills: SummaryPill[];
  error: string | null;
}

type Action =
  | { type: 'LOADING' }
  | { type: 'SET_RESULT'; payload: Partial<SmartSheetState> }
  | { type: 'SET_VIEW'; payload: string }
  | { type: 'SET_PERIOD'; payload: string }
  | { type: 'SET_SUGGESTIONS'; payload: Suggestion[] }
  | { type: 'DISMISS_SUGGESTION'; payload: string }
  | { type: 'ADD_HISTORY'; payload: string }
  | { type: 'SET_ERROR'; payload: string | null };

const initial: SmartSheetState = {
  activeView: 'dre',
  period: 'current_month',
  viewType: 'dre',
  title: 'Receitas x Débitos',
  columns: [],
  rows: [],
  extraRows: [],
  extraColumns: [],
  insight: '',
  isLoading: true,
  suggestions: [],
  commandHistory: loadHistory(),
  chartData: [],
  summaryPills: [],
  error: null,
};

function reducer(state: SmartSheetState, action: Action): SmartSheetState {
  switch (action.type) {
    case 'LOADING':
      return { ...state, isLoading: true, error: null };
    case 'SET_RESULT':
      return { ...state, isLoading: false, error: null, ...action.payload };
    case 'SET_VIEW':
      return { ...state, activeView: action.payload };
    case 'SET_PERIOD':
      return { ...state, period: action.payload };
    case 'SET_SUGGESTIONS':
      return { ...state, suggestions: action.payload };
    case 'DISMISS_SUGGESTION': {
      const dismissed = loadDismissed();
      dismissed[action.payload] = Date.now();
      saveDismissed(dismissed);
      return { ...state, suggestions: state.suggestions.filter((s) => s.id !== action.payload) };
    }
    case 'ADD_HISTORY': {
      const next = [action.payload, ...state.commandHistory.filter((c) => c !== action.payload)].slice(0, 20);
      saveHistory(next);
      return { ...state, commandHistory: next };
    }
    case 'SET_ERROR':
      return { ...state, isLoading: false, error: action.payload };
    default:
      return state;
  }
}

interface SmartSheetContextValue {
  state: SmartSheetState;
  dispatch: Dispatch<Action>;
  loadView: (viewId: string, period?: string, category?: string) => Promise<void>;
  executeCommand: (command: string) => Promise<void>;
  refreshSuggestions: () => Promise<void>;
}

const SmartSheetContext = createContext<SmartSheetContextValue | null>(null);

function applyResult(dispatch: Dispatch<Action>, result: Awaited<ReturnType<typeof api.smartsheetView>>, viewId?: string) {
  dispatch({
    type: 'SET_RESULT',
    payload: {
      viewType: result.viewType,
      title: result.title,
      columns: result.columns,
      rows: result.rows,
      extraRows: result.extraRows ?? [],
      extraColumns: result.extraColumns ?? [],
      insight: result.insight,
      chartData: result.chartData,
      summaryPills: result.summaryPills,
      suggestions: result.suggestions,
      ...(viewId ? { activeView: viewId } : {}),
    },
  });
}

export function SmartSheetProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const viewCache = useRef<Record<string, SheetResult>>({});

  const loadView = useCallback(async (viewId: string, period?: string, category?: string) => {
    const effectivePeriod = period ?? state.period;
    const cacheKey = `${viewId}:${effectivePeriod}:${category ?? ''}`;

    dispatch({ type: 'SET_VIEW', payload: viewId });

    // 1. INSTANT DISPLAY: Show cached data if available (0ms latency!)
    if (viewCache.current[cacheKey]) {
      applyResult(dispatch, viewCache.current[cacheKey]!, viewId);
    } else {
      // Show clean loading skeleton while fetching live backend data (prevents mock data flicker)
      dispatch({ type: 'LOADING' });
    }

    // 2. FETCH LIVE DATA: Update with backend data asynchronously
    try {
      const result = await api.smartsheetView(viewId, effectivePeriod, category);
      if (result && result.rows) {
        viewCache.current[cacheKey] = result;
        applyResult(dispatch, result, viewId);
      }
    } catch {
      // If backend is offline or fails and no cache exists, use mock view fallback
      if (!viewCache.current[cacheKey]) {
        const fallback = getMockViewResult(viewId);
        applyResult(dispatch, fallback, viewId);
      }
    }
  }, [state.period]);

  const executeCommand = useCallback(async (command: string) => {
    dispatch({ type: 'LOADING' });
    dispatch({ type: 'ADD_HISTORY', payload: command });
    try {
      const result = await api.smartsheetCommand(command, state.period);
      applyResult(dispatch, result);
    } catch {
      const fallbackResult = getMockViewResult(state.activeView);
      applyResult(dispatch, fallbackResult);
    }
  }, [state.activeView, state.period]);

  const refreshSuggestions = useCallback(async () => {
    try {
      const { suggestions } = await api.smartsheetSuggestions();
      const dismissed = loadDismissed();
      const now = Date.now();
      const visible = suggestions.filter((s) => {
        const ts = dismissed[s.id];
        return !ts || now - ts > 24 * 60 * 60 * 1000;
      });
      dispatch({ type: 'SET_SUGGESTIONS', payload: visible });
    } catch { /* silently fail */ }
  }, []);

  // Load initial view
  useEffect(() => {
    void loadView('dre', 'current_month');
    void refreshSuggestions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload when period changes
  useEffect(() => {
    void loadView(state.activeView, state.period);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.period]);

  return (
    <SmartSheetContext.Provider value={{ state, dispatch, loadView, executeCommand, refreshSuggestions }}>
      {children}
    </SmartSheetContext.Provider>
  );
}

export function useSmartSheet() {
  const ctx = useContext(SmartSheetContext);
  if (!ctx) throw new Error('useSmartSheet must be used inside SmartSheetProvider');
  return ctx;
}

