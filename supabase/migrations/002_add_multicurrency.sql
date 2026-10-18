-- Adiciona novos campos de suporte a moedas estrangeiras na tabela de transações
ALTER TABLE transactions
ADD COLUMN original_currency TEXT DEFAULT 'BRL',
ADD COLUMN original_amount DECIMAL(15,2),
ADD COLUMN exchange_rate DECIMAL(15,6) DEFAULT 1.0;

-- Atualiza transações antigas de forma retroativa
UPDATE transactions
SET original_currency = 'BRL',
    original_amount = amount,
    exchange_rate = 1.0
WHERE original_currency IS NULL OR original_currency = 'BRL';
