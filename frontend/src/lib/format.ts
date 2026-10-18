/** Funções utilitárias de formatação (moeda e datas) — sempre pt-BR. */

export const formatBRL = (value: number): string =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

export const formatCurrency = formatBRL;

export const formatPercent = (value: number): string =>
  `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;

/** Valor compacto: R$ 12,4 mil / R$ 1,2 mi (para eixos de gráfico). */
export const formatBRLCompact = (value: number): string =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);

/** Data curta: "13 jun". */
export const formatDateShort = (date: string): string =>
  new Date(date).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });

/** Data completa: "sábado, 13 de junho de 2026". */
export const formatDateFull = (date: string): string =>
  new Date(date).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

/** Hora "14:32" a partir de timestamp ISO. */
export const formatTime = (date: string): string =>
  new Date(date).toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });

/** Classe de cor para valores: positivo verde, negativo vermelho. */
export const getAmountColor = (amount: number): string =>
  amount >= 0 ? 'text-accent-green' : 'text-accent-red';

/** Tempo relativo aproximado: "há 2h", "há 3 dias". */
export const timeAgo = (date: string | null): string => {
  if (!date) return 'nunca';
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `há ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days} dia${days > 1 ? 's' : ''}`;
};

/** Agrupa um rótulo de data legível: "Hoje", "Ontem" ou "13 jun". */
export const dateGroupLabel = (date: string): string => {
  const today = new Date();
  const d = new Date(`${date}T00:00:00`);
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const diffDays = Math.round(
    (startToday.getTime() - d.getTime()) / 86400000,
  );
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Ontem';
  return formatDateShort(date);
};
