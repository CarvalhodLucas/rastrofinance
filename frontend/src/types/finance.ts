export interface AuthUser {
  id: string;
  username: string;
  name: string;
  last_login_at?: string;
  created_at?: string;
}

export type AccountType = 'CHECKING' | 'SAVINGS' | 'CREDIT' | 'INVESTMENT';

export type TransactionType = 'DEBIT' | 'CREDIT' | 'PIX' | 'TED' | 'BOLETO';

export type InsightType =
  | 'DAILY_SUMMARY'
  | 'WEEKLY_ANALYSIS'
  | 'MONTHLY_REPORT'
  | 'ANOMALY_ALERT'
  | 'PATTERN_DETECTED';

export interface ConnectedAccount {
  id: string;
  pluggy_item_id: string;
  pluggy_account_id: string;
  institution_name: string;
  institution_logo: string | null;
  account_type: AccountType;
  account_name: string;
  account_number: string | null;
  balance: number;
  currency: string;
  is_active: boolean;
  last_synced_at: string | null;
  created_at: string;
}

export interface Transaction {
  id: string;
  pluggy_transaction_id: string;
  account_id: string | null;
  date: string;
  amount: number;
  description: string;
  raw_description: string | null;
  merchant_name: string | null;
  category: string | null;
  subcategory: string | null;
  is_essential: boolean | null;
  is_recurring: boolean;
  transaction_type: TransactionType;
  ai_confidence: number | null;
  ai_notes: string | null;
  is_anomaly: boolean;
  anomaly_reason: string | null;
  original_currency?: string;
  original_amount?: number;
  exchange_rate?: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  budget_limit: number | null;
  is_essential: boolean;
}

export interface AiInsight {
  id: string;
  type: InsightType;
  period_start: string | null;
  period_end: string | null;
  title: string;
  narrative: string;
  data_snapshot: Record<string, unknown> | null;
  was_sent_whatsapp: boolean;
  sent_at: string | null;
  created_at: string;
}

export interface CategorySummary {
  category: string;
  total: number;
}

export interface TransactionsSummary {
  totalSpent: number;
  totalIncome: number;
  balance: number;
  count: number;
  byCategory: CategorySummary[];
}

export interface FinancialGoal {
  id: string;
  name: string;
  type: 'SPENDING_LIMIT' | 'SAVINGS_TARGET' | 'CATEGORY_BUDGET';
  target_amount: number;
  current_amount: number;
  category: string | null;
  deadline: string | null;
  is_active: boolean;
}

export type AssetType = 'CRYPTO' | 'STOCK' | 'FII' | 'FIXED_INCOME' | 'OTHER';
export type SyncSource = 'BINANCE_API' | 'B3_IMPORT' | 'B3_OPEN_FINANCE' | 'GORILA_IMPORT' | 'GORILA_CLOSED' | 'MANUAL';

export interface Investment {
  id: string;
  name: string;
  code_ticker: string;
  asset_type: AssetType;
  institution: string;
  quantity: number;
  average_price: number;
  current_price: number;
  total_value: number;
  currency: string;
  sync_source: SyncSource;
  yield_rate?: number;
  yield_frequency?: 'MONTHLY' | 'ANNUAL';
  last_yield_date?: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvestmentSummary {
  total_net_worth: number;
  total_invested: number;
  total_profit_loss: number;
  profit_loss_pct: number;
  by_asset_type: Array<{ type: AssetType; total: number; percentage: number }>;
  by_institution: Array<{ institution: string; total: number; percentage: number }>;
}

export interface RealizedOperation {
  id: string;
  kind: 'SELL' | 'SWAP' | 'LEGACY';
  date: string | null;
  ticker: string;
  asset_type: AssetType;
  institution: string;
  quantity: number;
  currency: 'BRL' | 'USD';
  avg_cost: number;
  sell_price: number;
  cost_total: number;
  proceeds_total: number;
  usd_brl: number;
  result_brl: number;
  result_pct: number;
  cost_missing?: boolean;
  to_ticker?: string;
  to_quantity?: number;
  notes?: string;
}

export interface DividendItem {
  id: string;
  ticker: string;
  institution: string;
  sub_category: string;
  asset_class: string;
  date?: string;
  dividends: number;
  jcp: number;
  bonification: number;
  fii_earnings: number;
  amortization: number;
  total_earnings: number;
  already_in_transactions?: boolean;
}

export interface DividendsSummary {
  total_dividends: number;
  total_jcp: number;
  total_fii_earnings: number;
  total_overall: number;
  items: DividendItem[];
}

export type TradeType = 'BUY' | 'SELL' | 'SWAP' | 'DEPOSIT' | 'EARN_SUB' | 'EARN_REDEEM' | 'EARN_INTEREST' | 'AIRDROP';

export interface InvestmentTrade {
  id: string;
  trade_type: TradeType;
  asset_type: AssetType;
  ticker: string;
  asset_name: string;
  institution: string;
  quantity: number;
  unit_price: number;
  total_value: number;
  from_ticker?: string;
  from_quantity?: number;
  to_ticker?: string;
  to_quantity?: number;
  date: string;
  source: string;
  notes?: string;
}

export interface RealizedOperation {
  id: string;
  kind: 'SELL' | 'SWAP' | 'LEGACY';
  date: string | null;
  ticker: string;
  asset_type: AssetType;
  institution: string;
  quantity: number;
  currency: 'BRL' | 'USD';
  avg_cost: number;
  sell_price: number;
  cost_total: number;
  proceeds_total: number;
  usd_brl: number;
  result_brl: number;
  result_pct: number;
  cost_missing?: boolean;
  to_ticker?: string;
  to_quantity?: number;
  notes?: string;
  investment_id?: string;
  trade_id?: string;
}

export interface WatchlistItem {
  ticker: string;
  type?: 'STOCK' | 'CRYPTO';
  name?: string;
}

export interface WatchlistQuoteResult {
  ticker: string;
  yahooSymbol?: string;
  name: string;
  type: 'STOCK' | 'CRYPTO';
  price: number;
  currency: 'BRL' | 'USD';
  variation: string;
  changeAmount: number;
  high24h: number;
  low24h: number;
  volume: number;
  marketCap: string;
  sparkline: number[];
  category: string;
}

export interface PriceAlert {
  id: string;
  ticker: string;
  targetPrice: number;
  condition: 'ABOVE' | 'BELOW';
  currency: 'BRL' | 'USD';
  createdAt: string;
  triggered: boolean;
  triggeredAt?: string;
  lastCheckedPrice?: number;
  note?: string;
}

export interface WatchlistResponse {
  items: WatchlistQuoteResult[];
  alerts?: PriceAlert[];
  triggeredAlerts?: PriceAlert[];
  b3Status: { isOpen: boolean; label: string; nextEvent: string };
  cryptoStatus: { isOpen: boolean; label: string };
  topGainer?: WatchlistQuoteResult;
  topLoser?: WatchlistQuoteResult;
  lastUpdated: string;
}

