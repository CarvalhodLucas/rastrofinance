import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { supabase, getSetting, updateSetting } from './supabaseService.js';

export interface AppUser {
  id: string;
  username: string; // nickname (armazenado em minúsculas)
  password_hash: string;
  name: string;
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

export interface UserSessionPayload {
  id: string;
  username: string;
  name: string;
}

const SETTINGS_USERS_KEY = 'app_users';
let hasAppUsersTable: boolean | null = null;

/**
 * Gera o hash criptográfico seguro (scrypt) com salt aleatório de 16 bytes.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

/**
 * Valida a senha comparando o hash de forma resistente a timing attacks.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split(':');
    if (parts.length !== 2) return false;
    const [salt, originalHash] = parts;
    if (!salt || !originalHash) return false;
    const computedHash = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(
      Buffer.from(originalHash, 'hex'),
      Buffer.from(computedHash, 'hex'),
    );
  } catch {
    return false;
  }
}

/**
 * Gera um token JWT com validade de 180 dias (se rememberMe) ou 1 dia (sessão temporária).
 */
export function generateToken(payload: UserSessionPayload, rememberMe: boolean = true): string {
  const expiresIn = rememberMe ? '180d' : '1d';
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn });
}

/**
 * Valida o token JWT e retorna o payload da sessão.
 */
export function verifyToken(token: string): UserSessionPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as UserSessionPayload;
  } catch {
    return null;
  }
}

/**
 * Detecta se a tabela `app_users` existe no Supabase.
 */
async function checkTableSupport(): Promise<boolean> {
  if (hasAppUsersTable !== null) return hasAppUsersTable;
  try {
    const { error } = await supabase.from('app_users').select('id').limit(1);
    hasAppUsersTable = !error;
  } catch {
    hasAppUsersTable = false;
  }
  return hasAppUsersTable;
}

/**
 * Retorna todos os usuários (usando tabela dedicada ou tabela settings).
 */
async function getStoredUsers(): Promise<AppUser[]> {
  const useTable = await checkTableSupport();
  if (useTable) {
    const { data, error } = await supabase.from('app_users').select('*');
    if (!error && data) return data as AppUser[];
  }
  const fallback = await getSetting<AppUser[]>(SETTINGS_USERS_KEY);
  return fallback || [];
}

/**
 * Encontra usuário pelo nickname (case-insensitive).
 */
export async function findUserByUsername(username: string): Promise<AppUser | null> {
  const cleanUsername = username.trim().toLowerCase();
  const useTable = await checkTableSupport();
  if (useTable) {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .ilike('username', cleanUsername)
      .maybeSingle();
    if (!error && data) return data as AppUser;
  }

  const users = await getStoredUsers();
  return users.find((u) => u.username.toLowerCase() === cleanUsername) || null;
}

/**
 * Encontra usuário por ID.
 */
export async function findUserById(id: string): Promise<AppUser | null> {
  const useTable = await checkTableSupport();
  if (useTable) {
    const { data, error } = await supabase
      .from('app_users')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (!error && data) return data as AppUser;
  }

  const users = await getStoredUsers();
  return users.find((u) => u.id === id) || null;
}

/**
 * Registra um novo usuário no sistema.
 */
export async function registerUser(params: {
  username: string;
  password: string;
  name?: string;
}): Promise<AppUser> {
  const cleanUsername = params.username.trim().toLowerCase();
  const cleanName = (params.name || cleanUsername).trim();

  // Validar username (apenas letras, números, sublinhado e hífen, min 3 caracteres)
  if (!cleanUsername || cleanUsername.length < 3) {
    throw new Error('O nickname deve conter pelo menos 3 caracteres.');
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(cleanUsername)) {
    throw new Error('O nickname pode conter apenas letras, números, "-" e "_".');
  }

  // Validar senha (mínimo 6 caracteres)
  if (!params.password || params.password.length < 6) {
    throw new Error('A senha deve conter pelo menos 6 caracteres.');
  }

  const existing = await findUserByUsername(cleanUsername);
  if (existing) {
    throw new Error('Este nickname já está cadastrado. Escolha outro ou faça login.');
  }

  const passwordHash = hashPassword(params.password);
  const now = new Date().toISOString();
  const newUser: AppUser = {
    id: crypto.randomUUID(),
    username: cleanUsername,
    password_hash: passwordHash,
    name: cleanName,
    created_at: now,
    updated_at: now,
    last_login_at: now,
  };

  const useTable = await checkTableSupport();
  if (useTable) {
    const { error } = await supabase.from('app_users').insert(newUser);
    if (!error) return newUser;
  }

  // Fallback para settings
  const currentUsers = await getStoredUsers();
  currentUsers.push(newUser);
  await updateSetting(SETTINGS_USERS_KEY, currentUsers);
  return newUser;
}

/**
 * Realiza autenticação com nickname e senha.
 */
export async function authenticateUser(
  username: string,
  password: string,
  rememberMe: boolean = true,
): Promise<{ user: UserSessionPayload; token: string }> {
  const cleanUsername = username.trim().toLowerCase();
  const user = await findUserByUsername(cleanUsername);

  if (!user || !verifyPassword(password, user.password_hash)) {
    throw new Error('Nickname ou senha incorretos.');
  }

  // Atualizar data do último login
  const now = new Date().toISOString();
  user.last_login_at = now;
  user.updated_at = now;

  const useTable = await checkTableSupport();
  if (useTable) {
    await supabase
      .from('app_users')
      .update({ last_login_at: now, updated_at: now })
      .eq('id', user.id);
  } else {
    const currentUsers = await getStoredUsers();
    const idx = currentUsers.findIndex((u) => u.id === user.id);
    if (idx >= 0) {
      currentUsers[idx] = user;
      await updateSetting(SETTINGS_USERS_KEY, currentUsers);
    }
  }

  const sessionPayload: UserSessionPayload = {
    id: user.id,
    username: user.username,
    name: user.name,
  };

  const token = generateToken(sessionPayload, rememberMe);
  return { user: sessionPayload, token };
}
