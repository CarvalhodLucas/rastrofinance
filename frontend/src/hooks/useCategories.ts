import { useState, useEffect } from 'react';
import { CATEGORY_META } from '@/lib/categories';

const STORAGE_CUSTOM_KEY = 'rastro_custom_categories';
const STORAGE_DELETED_KEY = 'rastro_deleted_categories';

export interface CategoryItem {
  name: string;
  icon: string;
  color: string;
  isCustom: boolean;
}

export function getCategories(): CategoryItem[] {
  try {
    const deletedSet = new Set<string>(JSON.parse(localStorage.getItem(STORAGE_DELETED_KEY) || '[]'));
    const customList: CategoryItem[] = JSON.parse(localStorage.getItem(STORAGE_CUSTOM_KEY) || '[]');

    const defaultList: CategoryItem[] = Object.entries(CATEGORY_META).map(([name, meta]) => ({
      name,
      icon: meta.icon,
      color: meta.color,
      isCustom: false,
    }));

    const all = [...defaultList, ...customList];
    return all.filter((c) => !deletedSet.has(c.name));
  } catch {
    return Object.entries(CATEGORY_META).map(([name, meta]) => ({
      name,
      icon: meta.icon,
      color: meta.color,
      isCustom: false,
    }));
  }
}

export function addCustomCategory(name: string, icon = '🏷️', color = '#EAB308') {
  const trimmed = name.trim();
  if (!trimmed) return;

  try {
    const customList: CategoryItem[] = JSON.parse(localStorage.getItem(STORAGE_CUSTOM_KEY) || '[]');
    if (!customList.some((c) => c.name.toLowerCase() === trimmed.toLowerCase())) {
      customList.push({ name: trimmed, icon, color, isCustom: true });
      localStorage.setItem(STORAGE_CUSTOM_KEY, JSON.stringify(customList));
    }
    const deletedSet = new Set<string>(JSON.parse(localStorage.getItem(STORAGE_DELETED_KEY) || '[]'));
    if (deletedSet.has(trimmed)) {
      deletedSet.delete(trimmed);
      localStorage.setItem(STORAGE_DELETED_KEY, JSON.stringify(Array.from(deletedSet)));
    }
  } catch {
    // Fallback
  }

  window.dispatchEvent(new Event('categories_changed'));
}

export function removeCategory(name: string) {
  try {
    let customList: CategoryItem[] = JSON.parse(localStorage.getItem(STORAGE_CUSTOM_KEY) || '[]');
    customList = customList.filter((c) => c.name !== name);
    localStorage.setItem(STORAGE_CUSTOM_KEY, JSON.stringify(customList));

    const deletedSet = new Set<string>(JSON.parse(localStorage.getItem(STORAGE_DELETED_KEY) || '[]'));
    deletedSet.add(name);
    localStorage.setItem(STORAGE_DELETED_KEY, JSON.stringify(Array.from(deletedSet)));
  } catch {
    // Fallback
  }

  window.dispatchEvent(new Event('categories_changed'));
}

export function useCategories() {
  const [categories, setCategories] = useState<CategoryItem[]>(getCategories);

  useEffect(() => {
    const handleUpdate = () => setCategories(getCategories());
    window.addEventListener('categories_changed', handleUpdate);
    return () => window.removeEventListener('categories_changed', handleUpdate);
  }, []);

  return {
    categories,
    categoryNames: categories.map((c) => c.name),
    addCategory: addCustomCategory,
    deleteCategory: removeCategory,
  };
}
