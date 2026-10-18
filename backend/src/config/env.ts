import dotenv from 'dotenv';
import path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

/**
 * Carrega e valida as variáveis de ambiente do backend.
 * Em vez de espalhar `process.env.X` pelo código, centralizamos aqui
 * com tipagem estrita (sem `any`).
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(
      `Variável de ambiente obrigatória ausente: ${name}. ` +
        `Copie .env.example para .env e preencha os valores.`,
    );
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() !== '' ? value : fallback;
}

export const env = {
  // Supabase
  SUPABASE_URL: required('SUPABASE_URL'),
  SUPABASE_SERVICE_KEY: required('SUPABASE_SERVICE_KEY'),

  // Pluggy
  PLUGGY_CLIENT_ID: required('PLUGGY_CLIENT_ID'),
  PLUGGY_CLIENT_SECRET: required('PLUGGY_CLIENT_SECRET'),

  // OpenRouter
  OPENROUTER_API_KEY: required('OPENROUTER_API_KEY'),
  OPENROUTER_MODEL: optional('OPENROUTER_MODEL', 'deepseek/deepseek-v4-flash'),
  OPENROUTER_VISION_MODEL: optional('OPENROUTER_VISION_MODEL', 'google/gemini-2.0-flash-001'),

  // Telegram Bot
  TELEGRAM_BOT_TOKEN: optional('TELEGRAM_BOT_TOKEN', ''),
  TELEGRAM_CHAT_ID: optional('TELEGRAM_CHAT_ID', ''),

  // Evolution API (WhatsApp)
  EVOLUTION_API_URL: optional('EVOLUTION_API_URL', 'http://localhost:8080'),
  EVOLUTION_API_KEY: optional('EVOLUTION_API_KEY', ''),
  EVOLUTION_INSTANCE: optional('EVOLUTION_INSTANCE', 'rastro-finance'),
  WHATSAPP_NUMBER: optional('WHATSAPP_NUMBER', ''),

  // Binance
  BINANCE_API_KEY: optional('BINANCE_API_KEY', ''),
  BINANCE_SECRET_KEY: optional('BINANCE_SECRET_KEY', ''),

  // JWT Auth
  JWT_SECRET: optional('JWT_SECRET', 'rastro-finance-super-secret-jwt-key-2026'),

  // Servidor
  PORT: Number(optional('PORT', '3001')),
  NODE_ENV: optional('NODE_ENV', 'development'),
  TIMEZONE: optional('TZ', 'America/Sao_Paulo'),

  // Enable Banking
  ENABLE_BANKING_APPLICATION_ID: optional('ENABLE_BANKING_APPLICATION_ID', ''),
  ENABLE_BANKING_PRIVATE_KEY_PATH: optional('ENABLE_BANKING_PRIVATE_KEY_PATH', './key/4040c4c2-6d58-473d-a0a6-fe1dde10b38a.pem'),
  ENABLE_BANKING_ENV: optional('ENABLE_BANKING_ENV', 'sandbox'),
  ENABLE_BANKING_API_BASE_SANDBOX: optional('ENABLE_BANKING_API_BASE_SANDBOX', 'https://api.enablebanking.com'),
  ENABLE_BANKING_API_BASE_PRODUCTION: optional('ENABLE_BANKING_API_BASE_PRODUCTION', 'https://api.enablebanking.com'),
  ENABLE_BANKING_REDIRECT_URL: optional('ENABLE_BANKING_REDIRECT_URL', 'http://localhost:3001/api/enablebanking/callback'),

} as const;

