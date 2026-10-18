-- Nova coluna para rastrear a origem da conexão (Pluggy vs Enable Banking)
ALTER TABLE connected_accounts
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'PLUGGY';
-- provider aceita: 'PLUGGY' | 'ENABLE_BANKING'

-- Campos específicos do Enable Banking para gerenciar a sessão
ALTER TABLE connected_accounts
  ADD COLUMN IF NOT EXISTS enable_banking_session_id TEXT,
  ADD COLUMN IF NOT EXISTS enable_banking_account_id TEXT,
  ADD COLUMN IF NOT EXISTS session_expires_at TIMESTAMPTZ;

-- transactions.import_source já foi adicionado na migration 003
-- aqui só documentamos o novo valor aceito: 'ENABLE_BANKING' além dos já existentes
