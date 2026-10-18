-- Tabela para carteira de investimentos (Criptos Binance, Ativos B3 e Gestão Manual)
CREATE TABLE IF NOT EXISTS investments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code_ticker TEXT NOT NULL,
  asset_type TEXT NOT NULL, -- 'CRYPTO', 'STOCK', 'FII', 'FIXED_INCOME', 'OTHER'
  institution TEXT NOT NULL DEFAULT 'Manual', -- 'Binance', 'B3', 'XP', etc.
  quantity DECIMAL(18,8) NOT NULL DEFAULT 0,
  average_price DECIMAL(18,8) DEFAULT 0,
  current_price DECIMAL(18,8) DEFAULT 0,
  total_value DECIMAL(15,2) DEFAULT 0,
  currency TEXT DEFAULT 'BRL',
  sync_source TEXT DEFAULT 'MANUAL', -- 'BINANCE_API', 'B3_IMPORT', 'MANUAL'
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para acelerar busca por tipo e fonte de sync
CREATE INDEX IF NOT EXISTS idx_investments_asset_type ON investments(asset_type);
CREATE INDEX IF NOT EXISTS idx_investments_institution ON investments(institution);
