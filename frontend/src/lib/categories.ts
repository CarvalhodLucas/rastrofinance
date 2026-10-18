/** Metadados de categoria (ícone + cor) — espelham o seed da migration. */
export interface CategoryMeta {
  icon: string;
  color: string;
}

export const CATEGORY_META: Record<string, CategoryMeta> = {
  Alimentação: { icon: '🛒', color: '#10B981' },
  'Restaurantes e Delivery': { icon: '🍕', color: '#F59E0B' },
  Transporte: { icon: '🚗', color: '#3B82F6' },
  Moradia: { icon: '🏠', color: '#8B5CF6' },
  Saúde: { icon: '🩺', color: '#EF4444' },
  'Lazer e Entretenimento': { icon: '🎬', color: '#EC4899' },
  Vestuário: { icon: '👕', color: '#F97316' },
  Tecnologia: { icon: '💻', color: '#06B6D4' },
  Educação: { icon: '📚', color: '#6366F1' },
  Viagem: { icon: '✈️', color: '#14B8A6' },
  'Serviços Financeiros': { icon: '🏦', color: '#64748B' },
  Transferências: { icon: '🔄', color: '#94A3B8' },
  Receita: { icon: '💰', color: '#22C55E' },
  Outros: { icon: '📦', color: '#4B5563' },
};

export const CATEGORY_NAMES = Object.keys(CATEGORY_META);

export function categoryMeta(name: string | null): CategoryMeta {
  if (!name) return { icon: '📦', color: '#4B5563' };
  if (CATEGORY_META[name]) return CATEGORY_META[name];

  try {
    const customList = JSON.parse(localStorage.getItem('rastro_custom_categories') || '[]');
    const found = customList.find((c: { name: string; icon: string; color: string }) => c.name.toLowerCase() === name.toLowerCase());
    if (found) return { icon: found.icon || '🏷️', color: found.color || '#EAB308' };
  } catch {
    // Fallback
  }

  return { icon: '🏷️', color: '#EAB308' };
}
