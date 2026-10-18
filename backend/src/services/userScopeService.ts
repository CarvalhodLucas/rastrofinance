import type { UserSessionPayload } from './authService.js';

export const PRIMARY_LUCAS_USERNAMES = ['carvalhodlucas', 'lucas_mobile'];
export const PRIMARY_LUCAS_IDS = [
  'cd2d8fdb-ad53-4ba0-8735-421e38db5d97',
  '6de291b2-b04e-4454-a53b-9c7e14921cba',
];

/**
 * Verifica se o usuário atual é o proprietário principal (Lucas de Carvalho).
 * Usuários legados ou sem usuário autenticado herdam a conta principal do Lucas.
 */
export function isLucasUser(user?: { id?: string; username?: string } | null): boolean {
  if (!user) return false;
  const username = (user.username || '').toLowerCase();
  const id = user.id || '';
  return PRIMARY_LUCAS_USERNAMES.includes(username) || PRIMARY_LUCAS_IDS.includes(id);
}

/**
 * Retorna a chave do `settings` escopada por usuário.
 * Para o Lucas, mantém as chaves originais sem prefixo para compatibilidade total.
 * Para outros usuários (ex: Maria Fernanda), usa `${baseKey}_${userId}`.
 */
export function getUserSettingKey(
  baseKey: string,
  user?: { id?: string; username?: string } | null,
): string {
  if (!user || !user.id || isLucasUser(user)) {
    return baseKey;
  }
  return `${baseKey}_${user.id}`;
}

/**
 * Formata o sync_source para conter a tag do usuário proprietário.
 */
export function tagSyncSourceWithUser(
  syncSource: string | undefined | null,
  userId: string | undefined,
): string {
  const base = syncSource || 'MANUAL';
  if (!userId) return base;
  if (base.startsWith(`USER:${userId}#`)) return base;
  return `USER:${userId}#${base}`;
}

/**
 * Extrai o ID do usuário de um sync_source taggeado, se houver.
 */
export function extractUserFromSyncSource(syncSource: string | undefined | null): string | null {
  if (!syncSource) return null;
  const match = syncSource.match(/^USER:([a-f0-9\-]+)#/i);
  return (match && match[1]) ? match[1] : null;
}

/**
 * Limpa a tag de usuário do sync_source para exibição interna se necessário.
 */
export function cleanSyncSource(syncSource: string | undefined | null): string {
  if (!syncSource) return 'MANUAL';
  return syncSource.replace(/^USER:[a-f0-9\-]+#/i, '');
}

/**
 * Verifica se um registro pertence ao usuário especificado.
 */
export function isRecordOwnedByUser(
  recordUserId: string | null | undefined,
  recordSyncSource: string | null | undefined,
  currentUser?: { id?: string; username?: string } | null,
): boolean {
  if (!currentUser) return isLucasUser(null);

  const currentIsLucas = isLucasUser(currentUser);
  const taggedUserId = recordUserId || extractUserFromSyncSource(recordSyncSource);

  if (taggedUserId) {
    return taggedUserId === currentUser.id;
  }

  // Registros legados sem nenhuma tag pertencem exclusivamente à conta do Lucas
  return currentIsLucas;
}
