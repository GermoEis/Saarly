import { DemoState, Item } from '@/types/domain';
import { ItemSortOrder, sortItems } from './itemSorting';

export type CategoryItemSortOrder = 'category' | ItemSortOrder;

export const normalizeCategoryName = (name: string) => name.trim().toLocaleLowerCase('et-EE');

export function categoryNameForItem(state: DemoState, item: Item) {
  return state.categories.find((category) => category.id === item.category_id)?.name ?? 'Üldine';
}

export function availableCategoryNames(state: DemoState) {
  const names = [...state.categoryTemplates.map((template) => template.name), ...state.categories.map((category) => category.name)];
  const unique = new Map<string, string>();
  names.forEach((name) => { const clean = name.trim(); if (clean) unique.set(normalizeCategoryName(clean), clean); });
  return [...unique.values()].sort((first, second) => first.localeCompare(second, 'et', { sensitivity: 'base' }));
}

export function filterItemsByCategory(state: DemoState, items: Item[], categoryName: string | null) {
  if (!categoryName) return items;
  const target = normalizeCategoryName(categoryName);
  return items.filter((item) => normalizeCategoryName(categoryNameForItem(state, item)) === target);
}

export function sortCategoryItems(state: DemoState, items: Item[], order: CategoryItemSortOrder) {
  if (order !== 'category') return sortItems(items, order);
  return [...items].sort((first, second) => {
    const category = categoryNameForItem(state, first).localeCompare(categoryNameForItem(state, second), 'et', { sensitivity: 'base' });
    return category || first.name.localeCompare(second.name, 'et', { sensitivity: 'base', numeric: true }) || first.id.localeCompare(second.id);
  });
}

export function assignCategoryInDemo(state: DemoState, itemIds: string[], categoryName: string, actorId: string): DemoState {
  const cleanName = categoryName.trim();
  if (!cleanName || !itemIds.length) return state;
  const selected = new Set(itemIds);
  const listIds = [...new Set(state.items.filter((item) => selected.has(item.id)).map((item) => item.list_id))];
  const at = new Date().toISOString();
  const categories = [...state.categories];
  const categoryByList = new Map<string, string>();
  listIds.forEach((listId) => {
    const existing = categories.find((category) => category.list_id === listId && normalizeCategoryName(category.name) === normalizeCategoryName(cleanName));
    if (existing) { categoryByList.set(listId, existing.id); return; }
    const id = `category-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    categories.push({ id, list_id: listId, name: cleanName, sort_order: categories.filter((category) => category.list_id === listId).length, created_at: at, updated_at: at });
    categoryByList.set(listId, id);
  });
  const templateExists = state.categoryTemplates.some((template) => normalizeCategoryName(template.name) === normalizeCategoryName(cleanName));
  const categoryTemplates = templateExists ? state.categoryTemplates : [...state.categoryTemplates, { id: `template-${Date.now()}`, group_id: state.groups[0]?.id ?? 'family', created_by: actorId, name: cleanName, sort_order: state.categoryTemplates.length, created_at: at, updated_at: at }];
  return { ...state, categories, categoryTemplates, items: state.items.map((item) => selected.has(item.id) ? { ...item, category_id: categoryByList.get(item.list_id) ?? item.category_id, updated_at: at } : item) };
}

export function deleteSharedCategoryInDemo(state: DemoState, categoryName: string): DemoState {
  const targetName = normalizeCategoryName(categoryName);
  if (!targetName || targetName === normalizeCategoryName('Üldine')) return state;

  const removedCategories = state.categories.filter((category) => normalizeCategoryName(category.name) === targetName);
  if (!removedCategories.length && !state.categoryTemplates.some((template) => normalizeCategoryName(template.name) === targetName)) return state;

  const removedIds = new Set(removedCategories.map((category) => category.id));
  const affectedListIds = [...new Set(removedCategories.map((category) => category.list_id))];
  const at = new Date().toISOString();
  const categories = state.categories.filter((category) => !removedIds.has(category.id));
  const fallbackByList = new Map<string, string>();

  affectedListIds.forEach((listId) => {
    let fallback = categories.find((category) => category.list_id === listId && normalizeCategoryName(category.name) === normalizeCategoryName('Üldine'));
    if (!fallback) {
      fallback = { id: `category-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, list_id: listId, name: 'Üldine', sort_order: 0, created_at: at, updated_at: at };
      categories.push(fallback);
    }
    fallbackByList.set(listId, fallback.id);
  });

  let categoryTemplates = state.categoryTemplates.filter((template) => normalizeCategoryName(template.name) !== targetName);
  if (!categoryTemplates.some((template) => normalizeCategoryName(template.name) === normalizeCategoryName('Üldine'))) {
    categoryTemplates = [{ id: `template-${Date.now()}`, group_id: state.groups[0]?.id ?? 'family', created_by: state.currentUserId ?? state.profiles[0]?.id ?? 'user-a', name: 'Üldine', sort_order: 0, created_at: at, updated_at: at }, ...categoryTemplates];
  }

  return {
    ...state,
    categories,
    categoryTemplates,
    items: state.items.map((item) => removedIds.has(item.category_id) ? { ...item, category_id: fallbackByList.get(item.list_id) ?? item.category_id, updated_at: at } : item),
  };
}
