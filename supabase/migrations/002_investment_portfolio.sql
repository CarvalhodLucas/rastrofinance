-- Transações de investimento (compra, venda, provento)
CREATE TABLE investment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_ticker TEXT NOT NULL,           -- ex: 'PETR4', 'HGLG11'
  asset_name TEXT,                       -- nome completo do ativo
  asset_type TEXT NOT NULL,              -- 'ACAO', 'FII', 'ETF', 'BDR', 'RENDA_FIXA', 'OUTRO'
  operation_type TEXT NOT NULL,          -- 'COMPRA', 'VENDA', 'PROVENTO', 'JCP', 'DESDOBRAMENTO', 'BONIFICACAO'
  quantity DECIMAL(15,6) NOT NULL,
  unit_price DECIMAL(15,6),
  total_value DECIMAL(15,2) NOT NULL,
  fees DECIMAL(15,2) DEFAULT 0,          -- taxas e corretagem
  broker TEXT,                            -- corretora
  operation_date DATE NOT NULL,
  source TEXT DEFAULT 'B3_IMPORT',       -- 'B3_IMPORT' | 'MANUAL'
  import_batch_id UUID,                   -- agrupa transações do mesmo upload
  raw_data JSONB,                         -- linha original do Excel, para auditoria
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lotes de importação (histórico de uploads)
CREATE TABLE import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  period_start DATE,
  period_end DATE,
  total_rows_found INTEGER,
  total_rows_imported INTEGER,
  status TEXT DEFAULT 'PROCESSING',      -- 'PROCESSING' | 'PREVIEW' | 'CONFIRMED' | 'ERROR'
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Snapshot diário de patrimônio (recalculado após cada importação)
CREATE TABLE portfolio_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL UNIQUE,
  total_invested DECIMAL(15,2) NOT NULL,      -- capital aportado acumulado
  total_market_value DECIMAL(15,2),            -- valor de mercado (preenchido depois, com cotações)
  total_dividends_received DECIMAL(15,2) DEFAULT 0,
  profitability_pct DECIMAL(8,4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Posição consolidada atual por ativo (view materializada simples via tabela)
CREATE TABLE current_holdings (
  asset_ticker TEXT PRIMARY KEY,
  asset_type TEXT NOT NULL,
  total_quantity DECIMAL(15,6) NOT NULL,
  average_price DECIMAL(15,6) NOT NULL,
  total_invested DECIMAL(15,2) NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_investment_transactions_ticker ON investment_transactions(asset_ticker);
CREATE INDEX idx_investment_transactions_date ON investment_transactions(operation_date DESC);
CREATE INDEX idx_investment_transactions_batch ON investment_transactions(import_batch_id);
