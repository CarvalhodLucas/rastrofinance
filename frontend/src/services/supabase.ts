import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Cliente Supabase para leituras diretas no frontend quando conveniente.
 * A maior parte dos dados passa pela API própria (services/api.ts);
 * este cliente fica disponível para realtime/consultas pontuais.
 */
export const supabase =
  url && anonKey ? createClient(url, anonKey) : null;
