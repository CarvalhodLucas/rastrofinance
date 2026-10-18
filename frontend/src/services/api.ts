import type {
  AiInsight,
  AuthUser,
  ConnectedAccount,
  DividendsSummary,
  FinancialGoal,
  Investment,
  InvestmentSummary,
  RealizedOperation,
  Transaction,
  TransactionsSummary,
  WatchlistItem,
  WatchlistResponse,
  PriceAlert,
} from '@/types/finance';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export function getStoredToken(): string | null {
  return localStorage.getItem('rastro_token');
}

export function setStoredToken(token: string | null): void {
  if (token) {
    localStorage.setItem('rastro_token', token);
  } else {
    localStorage.removeItem('rastro_token');
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init?.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers,
    });
  } catch {
    // Falha de rede (backend offline, CORS, sem internet).
    throw new Error(
      'Não foi possível conectar ao servidor. Verifique se o backend está rodando.',
    );
  }

  if (res.status === 401 && !path.startsWith('/api/auth/login') && !path.startsWith('/api/auth/register')) {
    setStoredToken(null);
    window.dispatchEvent(new Event('auth:unauthorized'));
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error ?? `Erro ${res.status} ao chamar a API.`,
    );
  }
  return res.json() as Promise<T>;
}

export const api = {
  // --- Autenticação ---
  login: (username: string, password: string) =>
    request<{ message: string; user: AuthUser; token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  register: (username: string, password: string, name?: string) =>
    request<{ message: string; user: AuthUser; token: string }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, name }),
    }),

  getMe: () =>
    request<{ user: AuthUser }>('/api/auth/me'),

  logout: () =>
    request<{ message: string }>('/api/auth/logout', {
      method: 'POST',
    }),

  // --- Pluggy ---
  getConnectToken: () =>
    request<{ accessToken: string }>('/api/pluggy/connect-token'),

  saveItem: (itemId: string) =>
    request<{ accounts: ConnectedAccount[] }>('/api/pluggy/item', {
      method: 'POST',
      body: JSON.stringify({ itemId }),
    }),

  getAccounts: () =>
    request<{ accounts: ConnectedAccount[] }>('/api/pluggy/accounts'),

  sync: () =>
    request<{ synced: number; categorized: number; anomalies: number }>(
      '/api/pluggy/sync',
      { method: 'POST' },
    ),

  removeAccount: (id: string) =>
    request<{ ok: boolean }>(`/api/pluggy/accounts/${id}`, {
      method: 'DELETE',
    }),

  addManualAccount: (payload: {
    id?: string;
    institutionName?: string;
    accountName: string;
    accountType?: string;
    balance: number;
    currency?: string;
  }) =>
    request<{ account: ConnectedAccount }>('/api/pluggy/manual-account', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // --- Transações ---
  getTransactions: (params: {
    month?: string;
    category?: string;
    account?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params.month) qs.set('month', params.month);
    if (params.category) qs.set('category', params.category);
    if (params.account) qs.set('account', params.account);
    return request<{ transactions: Transaction[] }>(
      `/api/transactions?${qs.toString()}`,
    );
  },

  getSummary: (month?: string) => {
    const qs = month ? `?month=${month}` : '';
    return request<TransactionsSummary>(`/api/transactions/summary${qs}`);
  },

  getAnomalies: () =>
    request<{ anomalies: Transaction[] }>('/api/transactions/anomalies'),

  createTransaction: (payload: {
    date: string;
    amount: number;
    description: string;
    category?: string;
    transaction_type: string;
    account_id?: string;
    original_currency?: string;
    original_amount?: number;
    exchange_rate?: number;
  }) =>
    request<{ transaction: Transaction }>('/api/transactions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateTransaction: (id: string, payload: Partial<Transaction>) =>
    request<{ transaction: Transaction }>(`/api/transactions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  deleteTransaction: (id: string) =>
    request<{ ok: boolean }>(`/api/transactions/${id}`, {
      method: 'DELETE',
    }),

  updateCategory: (id: string, category: string, subcategory?: string) =>
    request<{ transaction: Transaction }>(`/api/transactions/${id}/category`, {
      method: 'PATCH',
      body: JSON.stringify({ category, subcategory }),
    }),

  recategorize: (id: string) =>
    request<{ transaction: Transaction }>(
      `/api/transactions/${id}/recategorize`,
      { method: 'POST' },
    ),

  scanReceipt: (image: string, mimeType = 'image/jpeg') =>
    request<{
      amount?: number;
      currency?: 'BRL' | 'USD' | 'EUR' | 'CLP';
      date?: string;
      description?: string;
      merchant_name?: string;
      category?: string;
      transaction_type?: 'DEBIT' | 'CREDIT' | 'PIX' | 'BOLETO' | 'TED';
      is_expense?: boolean;
      notes?: string;
    }>('/api/transactions/scan-receipt', {
      method: 'POST',
      body: JSON.stringify({ image, mimeType }),
    }),

  scanStatement: (image?: string, mimeType = 'image/jpeg', text?: string) =>
    request<{
      institution?: string;
      currency?: 'BRL' | 'USD' | 'EUR' | 'CLP';
      transactions: Array<{
        amount: number;
        currency?: 'BRL' | 'USD' | 'EUR' | 'CLP';
        date: string;
        description: string;
        merchant_name?: string;
        category?: string;
        transaction_type?: 'DEBIT' | 'CREDIT' | 'PIX' | 'BOLETO' | 'TED';
        is_expense?: boolean;
      }>;
    }>('/api/transactions/scan-statement', {
      method: 'POST',
      body: JSON.stringify({ image, mimeType, text }),
    }),

  createTransactionsBatch: (transactions: Array<{
    date: string;
    amount: number;
    description: string;
    category?: string;
    transaction_type?: string;
    account_id?: string;
    original_currency?: string;
    original_amount?: number;
    exchange_rate?: number;
  }>) =>
    request<{ transactions: Transaction[]; count: number }>('/api/transactions/batch', {
      method: 'POST',
      body: JSON.stringify({ transactions }),
    }),

  // --- Insights ---
  getInsights: (type?: string) => {
    const qs = type ? `?type=${type}` : '';
    return request<{ insights: AiInsight[] }>(`/api/insights${qs}`);
  },

  getLatestInsights: () =>
    request<{ insights: AiInsight[] }>('/api/insights/latest'),

  generateInsight: (type: 'DAILY' | 'MONTHLY') =>
    request<{ ok: boolean }>('/api/insights/generate', {
      method: 'POST',
      body: JSON.stringify({ type }),
    }),

  // --- Configurações & metas ---
  getSettings: () =>
    request<{ settings: Record<string, unknown>; goals: FinancialGoal[] }>(
      '/api/settings',
    ),

  updateSettings: (settings: Record<string, unknown>) =>
    request<{ ok: boolean }>('/api/settings', {
      method: 'PUT',
      body: JSON.stringify({ settings }),
    }),

  createGoal: (goal: {
    name: string;
    type: FinancialGoal['type'];
    target_amount: number;
    category?: string | null;
    deadline?: string | null;
  }) =>
    request<{ goal: FinancialGoal }>('/api/settings/goals', {
      method: 'POST',
      body: JSON.stringify(goal),
    }),

  deleteGoal: (id: string) =>
    request<{ ok: boolean }>(`/api/settings/goals/${id}`, {
      method: 'DELETE',
    }),

  // --- Planilha Inteligente ---
  smartsheetCommand: (command: string, period: string) =>
    request<import('@/types/smartsheet').SheetResult>('/api/smartsheet/command', {
      method: 'POST',
      body: JSON.stringify({ command, period }),
    }),

  smartsheetView: (viewName: string, period: string, category?: string) => {
    const qs = new URLSearchParams({ period });
    if (category) qs.set('category', category);
    return request<import('@/types/smartsheet').SheetResult>(
      `/api/smartsheet/view/${viewName}?${qs.toString()}`,
    );
  },

  smartsheetSuggestions: () =>
    request<{ suggestions: import('@/types/smartsheet').Suggestion[] }>('/api/smartsheet/suggestions'),

  smartsheetSendInsight: (text: string) =>
    request<{ ok: boolean }>('/api/smartsheet/send-insight', {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  // --- Investimentos ---
  getInvestments: () =>
    request<{ investments: Investment[]; summary: InvestmentSummary }>(
      '/api/investments',
    ),

  createInvestment: (data: {
    name: string;
    code_ticker: string;
    asset_type: string;
    institution?: string;
    quantity: number;
    average_price?: number;
    current_price?: number;
    currency?: string;
    yield_rate?: number;
    yield_frequency?: 'MONTHLY' | 'ANNUAL';
    date?: string;
  }) =>
    request<{ investment: Investment }>('/api/investments', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateInvestment: (id: string, data: Partial<Investment> & { date?: string }) =>
    request<{ investment: Investment }>(`/api/investments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getRealizedOperations: () =>
    request<{ ok: boolean; operations: RealizedOperation[] }>('/api/investments/realized'),

  updateRealizedOperationDate: (id: string, date: string) =>
    request<{ ok: boolean; id: string; date: string }>(`/api/investments/realized/${id}/date`, {
      method: 'PUT',
      body: JSON.stringify({ date }),
    }),

  deleteInvestment: (id: string) =>
    request<{ ok: boolean }>(`/api/investments/${id}`, {
      method: 'DELETE',
    }),

  applyYields: (force = false) =>
    request<{ ok: boolean; appliedCount: number; results: any[] }>('/api/investments/apply-yields', {
      method: 'POST',
      body: JSON.stringify({ force }),
    }),

  applyYieldForAsset: (id: string) =>
    request<{ ok: boolean; appliedCount: number; results: any[] }>(`/api/investments/${id}/apply-yield`, {
      method: 'POST',
    }),

  syncBinance: (keys?: { apiKey: string; apiSecret: string }) =>
    request<{ ok: boolean; synced_count: number; investments: Investment[] }>(
      '/api/investments/sync/binance',
      {
        method: 'POST',
        body: JSON.stringify(keys ?? {}),
      },
    ),

  importB3: (items: Array<{
    name: string;
    ticker: string;
    type?: string;
    institution?: string;
    quantity: number;
    averagePrice?: number;
    currentPrice?: number;
  }>) =>
    request<{ ok: boolean; count: number; investments: Investment[] }>(
      '/api/investments/import/b3',
      {
        method: 'POST',
        body: JSON.stringify({ items }),
      },
    ),

  getBinanceHistory: () =>
    request<{
      history: Array<{
        id: string;
        type: 'CONVERT' | 'FIAT';
        date: string;
        from_asset: string;
        from_amount: number;
        to_asset: string;
        to_amount: number;
        unit_price_brl: number;
        total_brl: number;
      }>;
    }>('/api/investments/binance-history'),
  importBinanceReport: () =>
    request<{ ok: boolean; count: number; investments: Investment[] }>(
      '/api/investments/import/binance-excel',
      { method: 'POST' }
    ),
  syncB3Investments: () =>
    request<{ ok: boolean; count: number; investments: Investment[] }>(
      '/api/investments/sync/b3',
      { method: 'POST' },
    ),

  getDividends: () =>
    request<DividendsSummary>('/api/investments/dividends'),

  syncDividendsToTransactions: () =>
    request<{
      ok: boolean;
      insertedCount: number;
      skippedCount: number;
      insertedItems: string[];
    }>('/api/investments/dividends/sync-transactions', { method: 'POST' }),

  getQuote: (ticker: string, mode: 'compact' | 'full' = 'full') =>
    request<any>(`/api/investments/quote?ticker=${encodeURIComponent(ticker)}&mode=${mode}`),

  getWatchlist: (refresh = false) =>
    request<WatchlistResponse>(`/api/investments/watchlist${refresh ? '?refresh=true' : ''}`),

  saveWatchlist: (items: WatchlistItem[]) =>
    request<{ ok: boolean; data: WatchlistResponse }>('/api/investments/watchlist', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),

  addWatchlistItem: (item: WatchlistItem) =>
    request<{ ok: boolean; data: WatchlistResponse }>('/api/investments/watchlist/add', {
      method: 'POST',
      body: JSON.stringify(item),
    }),

  removeWatchlistItem: (symbol: string) =>
    request<{ ok: boolean; data: WatchlistResponse }>(`/api/investments/watchlist/${encodeURIComponent(symbol)}`, {
      method: 'DELETE',
    }),

  getPriceAlerts: () =>
    request<{ alerts: PriceAlert[] }>('/api/investments/watchlist/alerts'),

  createPriceAlert: (alert: {
    ticker: string;
    targetPrice: number;
    condition: 'ABOVE' | 'BELOW';
    currency?: 'BRL' | 'USD';
    note?: string;
  }) =>
    request<{ ok: boolean; alert: PriceAlert }>('/api/investments/watchlist/alerts', {
      method: 'POST',
      body: JSON.stringify(alert),
    }),

  deletePriceAlert: (id: string) =>
    request<{ ok: boolean }>(`/api/investments/watchlist/alerts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  updateQuotes: () =>
    request<{ ok: boolean; updated_count: number }>('/api/investments/update-quotes', {
      method: 'POST',
    }),

  getTrades: () =>
    request<{ ok: boolean; count: number; trades: any[] }>('/api/investments/trades'),

  recordTrade: (trade: any) =>
    request<{ ok: boolean; trade: any }>('/api/investments/trades', {
      method: 'POST',
      body: JSON.stringify(trade),
    }),

  sellInvestment: (
    id: string,
    data: {
      quantity: number;
      unit_price: number;
      date: string;
      notes?: string;
    },
  ) =>
    request<{
      ok: boolean;
      realized_pnl: number;
      gross_sale: number;
      remaining_qty: number;
      trade: any;
    }>(`/api/investments/${id}/sell`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateTrade: (id: string, data: any) =>
    request<{ ok: boolean; trade: any }>(`/api/investments/trades/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteTrade: (id: string) =>
    request<{ ok: boolean }>(`/api/investments/trades/${id}`, {
      method: 'DELETE',
    }),

  recompileTrades: () =>
    request<{ ok: boolean; count: number; trades: any[] }>('/api/investments/trades/recompile', {
      method: 'POST',
    }),

  getInvestmentEvolution: () =>
    request<{
      ok: boolean;
      evolution: Array<{
        month: string;
        appliedValue: number;
        marketValue: number;
        capitalGain: number;
      }>;
    }>('/api/investments/evolution'),

  // --- Portfolio Import (B3 Extract) ---
  uploadB3Extract: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return fetch(`${BASE_URL}/api/portfolio/import/upload`, {
      method: 'POST',
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? `Erro ${res.status}`);
      }
      return res.json();
    }) as Promise<{ batchId: string; parsed: any[]; needsReview: any[]; totalRows: number }>;
  },

  getB3Preview: (batchId: string) =>
    request<{ batchId: string; parsed: any[]; needsReview: any[]; totalRows: number }>(
      `/api/portfolio/import/${batchId}/preview`
    ),

  confirmB3Import: (batchId: string, transactions: any[]) =>
    request<{ imported: number; newHoldings: number; totalInvested: number }>(
      `/api/portfolio/import/${batchId}/confirm`,
      {
        method: 'POST',
        body: JSON.stringify({ transactions }),
      }
    ),

  cancelB3Import: (batchId: string) =>
    request<{ ok: boolean }>(`/api/portfolio/import/${batchId}`, {
      method: 'DELETE',
    }),

  getB3ImportHistory: () =>
    request<any[]>(`/api/portfolio/import/history`),

  // --- Enable Banking (Santander) ---
  getEnableBankingASPSPs: () =>
    request<{ aspsps: Array<{ name: string; country: string }> }>('/api/enablebanking/aspsps'),

  connectEnableBanking: (aspspName: string) =>
    request<{ authorizationUrl: string; state: string }>('/api/enablebanking/connect', {
      method: 'POST',
      body: JSON.stringify({ aspspName }),
    }),

  syncEnableBanking: (accountId: string) =>
    request<{ newTransactions: number; lastSync: string }>(`/api/enablebanking/sync/${accountId}`, {
      method: 'POST',
    }),

  getEnableBankingStatus: (accountId: string) =>
    request<{ status: 'active' | 'expiring' | 'expired'; daysLeft: number; lastSync: string | null }>(`/api/enablebanking/status/${accountId}`),

  // --- Suporte IA (DeepSeek V4.1 Flash) ---
  sendSupportChatMessage: (
    messages: Array<{ role: 'user' | 'assistant'; content: string }>,
    currentPage?: string
  ) =>
    request<{ reply: string; model: string }>('/api/support/chat', {
      method: 'POST',
      body: JSON.stringify({ messages, currentPage }),
    }),
};

