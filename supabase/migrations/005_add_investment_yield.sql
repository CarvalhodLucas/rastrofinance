-- Migration: 005_add_investment_yield.sql
-- Adiciona suporte a taxa de rendimento automático (ex: Wise, Caixa, Renda Fixa)

ALTER TABLE IF EXISTS investments
ADD COLUMN IF NOT EXISTS yield_rate DECIMAL(10, 4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS yield_frequency TEXT DEFAULT 'MONTHLY',
ADD COLUMN IF NOT EXISTS last_yield_date DATE;

COMMENT ON COLUMN investments.yield_rate IS 'Taxa de rendimento em porcentagem (ex: 0.35 para 0.35% a.m. ou 3.5 para 3.5% a.a.)';
COMMENT ON COLUMN investments.yield_frequency IS 'Frequência do rendimento: MONTHLY (% a.m.) ou ANNUAL (% a.a.)';
COMMENT ON COLUMN investments.last_yield_date IS 'Data do último rendimento aplicado no saldo do ativo';
