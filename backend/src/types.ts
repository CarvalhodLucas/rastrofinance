/** Tipos compartilhados pelo backend do Rastro Finance. */

export type AccountType = 'CHECKING' | 'SAVINGS' | 'CREDIT' | 'INVESTMENT';

export type TransactionType =
  | 'DEBIT'
  | 'CREDIT'
  | 'PIX'
  | 'TED'
  | 'BOLETO';

export type InsightType =
  | 'DAILY_SUMMARY'
  | 'WEEKLY_ANALYSIS'
  | 'MONTHLY_REPORT'
  | 'ANOMALY_ALERT'
  | 'PATTERN_DETECTED';

export type AnomalySeverity = 'LOW' | 'MEDIUM' | 'HIGH';

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

/** Linha de transação pronta para upsert (sem campos gerados pelo banco). */
export interface TransactionUpsert {
  pluggy_transaction_id: string;
  account_id: string;
  date: string;
  amount: number;
  description: string;
  raw_description: string | null;
  merchant_name: string | null;
  transaction_type: TransactionType;
  original_currency?: string;
  original_amount?: number;
  exchange_rate?: number;
}

export interface CategoryRow {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  budget_limit: number | null;
  is_essential: boolean;
  created_at: string;
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
  created_at: string;
}

export interface SpendingPattern {
  id: string;
  pattern_type: 'RECURRING_EXPENSE' | 'SEASONAL_SPIKE' | 'BEHAVIOR_CHANGE';
  description: string;
  category: string | null;
  average_amount: number | null;
  frequency: 'WEEKLY' | 'MONTHLY' | 'ANNUAL' | null;
  first_detected_at: string;
  last_seen_at: string;
  occurrence_count: number;
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

// --- Saídas estruturadas da IA ---

export interface CategorizationResult {
  pluggy_transaction_id: string;
  category: string;
  subcategory: string;
  is_essential: boolean;
  is_recurring: boolean;
  merchant_name: string;
  ai_confidence: number;
  ai_notes: string;
}

export interface WeeklyAnalysis {
  narrative: string;
  highlights: string[];
  warnings: string[];
  suggestions: string[];
}

export interface MonthlyReport {
  narrative: string;
  total_spent: number;
  total_received: number;
  balance: number;
  top_expenses: Array<{ description: string; amount: number; category: string }>;
  by_category: Array<{ category: string; total: number }>;
}

export interface Anomaly {
  pluggy_transaction_id: string;
  severity: AnomalySeverity;
  reason: string;
  amount: number;
  date: string;
  description: string;
}

export interface FinancialContext {
  spentByCategory: Array<{ category: string; total: number }>;
  previousMonthByCategory: Array<{ category: string; total: number }>;
  recentTransactions: Transaction[];
  goals: FinancialGoal[];
  patterns: SpendingPattern[];
}

// --- Investimentos ---

export type AssetType = 'CRYPTO' | 'STOCK' | 'FII' | 'FIXED_INCOME' | 'OTHER';
export type SyncSource = 'BINANCE_API' | 'BINANCE_REPORT' | 'B3_IMPORT' | 'B3_OPEN_FINANCE' | 'GORILA_IMPORT' | 'GORILA_CLOSED' | 'MANUAL' | 'MANUAL_CLOSED';

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

