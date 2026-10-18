-- Migration 007: Isolamento multi-usuários para CRM Finanças
-- Adiciona coluna user_id nas tabelas principais para isolamento completo

ALTER TABLE IF EXISTS investments ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE IF EXISTS connected_accounts ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE IF EXISTS transactions ADD COLUMN IF NOT EXISTS user_id UUID;
ALTER TABLE IF EXISTS investment_trades ADD COLUMN IF NOT EXISTS user_id UUID;

-- Cria índices para garantir alta performance nas consultas filtradas por usuário
CREATE INDEX IF NOT EXISTS idx_investments_user_id ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_connected_accounts_user_id ON connected_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_investment_trades_user_id ON investment_trades(user_id);
