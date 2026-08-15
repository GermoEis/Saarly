import { DemoState } from '@/types/domain';

export interface FrequentItemSuggestion {
  key: string;
  name: string;
  quantity: number;
  unit?: string;
  note?: string;
  categoryName?: string;
  useCount: number;
  lastUsedAt: string;
}

const normalize = (value: string) => value.trim().toLocaleLowerCase('et-EE');

/**
 * Loob varasemast tooteajaloost muudetavad soovitused. Sama nime viimati
 * kasutatud väärtused täidavad vormi, kasutuskordade arv mõjutab järjestust.
 */
export function frequentItemSuggestions(state: DemoState, query = '', limit = 5): FrequentItemSuggestion[] {
  const listById = new Map(state.lists.filter((list) => !list.deleted_at).map((list) => [list.id, list]));
  const categoryById = new Map(state.categories.map((category) => [category.id, category]));
  const grouped = new Map<string, FrequentItemSuggestion>();

  state.items
    .filter((item) => !item.deleted_at && listById.has(item.list_id))
    .sort((a, b) => a.updated_at.localeCompare(b.updated_at))
    .forEach((item) => {
      const key = normalize(item.name);
      const previous = grouped.get(key);
      grouped.set(key, {
        key,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        note: item.note,
        categoryName: categoryById.get(item.category_id)?.name,
        useCount: (previous?.useCount ?? 0) + 1,
        lastUsedAt: item.updated_at,
      });
    });

  const needle = normalize(query);
  return [...grouped.values()]
    .filter((suggestion) => !needle || normalize(suggestion.name).includes(needle))
    .sort((a, b) => {
      const aStarts = needle && normalize(a.name).startsWith(needle) ? 1 : 0;
      const bStarts = needle && normalize(b.name).startsWith(needle) ? 1 : 0;
      return bStarts - aStarts || b.useCount - a.useCount || b.lastUsedAt.localeCompare(a.lastUsedAt);
    })
    .slice(0, limit);
}
