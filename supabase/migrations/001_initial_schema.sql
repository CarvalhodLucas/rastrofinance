-- Instituições bancárias conectadas via Pluggy
CREATE TABLE connected_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pluggy_item_id TEXT UNIQUE NOT NULL,
  pluggy_account_id TEXT UNIQUE NOT NULL,
  institution_name TEXT NOT NULL,
  institution_logo TEXT,
  account_type TEXT NOT NULL, -- 'CHECKING', 'SAVINGS', 'CREDIT', 'INVESTMENT'
  account_name TEXT NOT NULL,
  account_number TEXT,
  balance DECIMAL(15,2) DEFAULT 0,
  currency TEXT DEFAULT 'BRL',
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transações financeiras brutas vindas do Pluggy
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pluggy_transaction_id TEXT UNIQUE NOT NULL,
  account_id UUID REFERENCES connected_accounts(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL, -- negativo = saída, positivo = entrada
  description TEXT NOT NULL,
  raw_description TEXT, -- descrição original do banco
  merchant_name TEXT,
  category TEXT, -- categoria definida pela IA
  subcategory TEXT, -- subcategoria definida pela IA
  is_essential BOOLEAN, -- IA define se é gasto essencial ou supérfluo
  is_recurring BOOLEAN DEFAULT false, -- IA detecta se é recorrente
  transaction_type TEXT NOT NULL, -- 'DEBIT', 'CREDIT', 'PIX', 'TED', 'BOLETO'
  ai_confidence DECIMAL(3,2), -- 0.0 a 1.0, confiança da categorização IA
  ai_notes TEXT, -- observações da IA sobre a transação
  is_anomaly BOOLEAN DEFAULT false, -- IA detectou como anômalo
  anomaly_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categorias de gastos (definidas pela IA, editáveis)
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  icon TEXT, -- emoji
  color TEXT, -- hex color
  budget_limit DECIMAL(15,2), -- limite mensal opcional
  is_essential BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insights e análises geradas pela IA
CREATE TABLE ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, -- 'DAILY_SUMMARY', 'WEEKLY_ANALYSIS', 'MONTHLY_REPORT', 'ANOMALY_ALERT', 'PATTERN_DETECTED'
  period_start DATE,
  period_end DATE,
  title TEXT NOT NULL,
  narrative TEXT NOT NULL, -- texto em português gerado pelo Claude
  data_snapshot JSONB, -- dados brutos que geraram o insight
  was_sent_whatsapp BOOLEAN DEFAULT false,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Metas financeiras pessoais
CREATE TABLE financial_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'SPENDING_LIMIT', 'SAVINGS_TARGET', 'CATEGORY_BUDGET'
  target_amount DECIMAL(15,2) NOT NULL,
  current_amount DECIMAL(15,2) DEFAULT 0,
  category TEXT,
  deadline DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Padrões detectados pela IA ao longo do tempo
CREATE TABLE spending_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_type TEXT NOT NULL, -- 'RECURRING_EXPENSE', 'SEASONAL_SPIKE', 'BEHAVIOR_CHANGE'
  description TEXT NOT NULL,
  category TEXT,
  average_amount DECIMAL(15,2),
  frequency TEXT, -- 'WEEKLY', 'MONTHLY', 'ANNUAL'
  first_detected_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  occurrence_count INTEGER DEFAULT 1
);

-- Configurações do sistema
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inserir configurações padrão
INSERT INTO settings (key, value) VALUES
  ('whatsapp_enabled', 'true'),
  ('daily_report_time', '"08:00"'),
  ('weekly_report_day', '"monday"'),
  ('currency', '"BRL"'),
  ('timezone', '"America/Sao_Paulo"'),
  ('ai_analysis_enabled', 'true');

-- Categorias padrão (alinhadas ao prompt de categorização da IA)
INSERT INTO categories (name, icon, color, is_essential) VALUES
  ('Alimentação',              '🛒', '#10B981', true),
  ('Restaurantes e Delivery',  '🍕', '#F59E0B', false),
  ('Transporte',               '🚗', '#3B82F6', true),
  ('Moradia',                  '🏠', '#8B5CF6', true),
  ('Saúde',                    '🩺', '#EF4444', true),
  ('Lazer e Entretenimento',   '🎬', '#EC4899', false),
  ('Vestuário',                '👕', '#F97316', false),
  ('Tecnologia',               '💻', '#06B6D4', false),
  ('Educação',                 '📚', '#6366F1', true),
  ('Viagem',                   '✈️', '#14B8A6', false),
  ('Serviços Financeiros',     '🏦', '#64748B', true),
  ('Transferências',           '🔄', '#94A3B8', false),
  ('Receita',                  '💰', '#22C55E', false),
  ('Outros',                   '📦', '#4B5563', false);

-- Índices para performance
CREATE INDEX idx_transactions_date ON transactions(date DESC);
CREATE INDEX idx_transactions_category ON transactions(category);
CREATE INDEX idx_transactions_account ON transactions(account_id);
CREATE INDEX idx_insights_type ON ai_insights(type, created_at DESC);
