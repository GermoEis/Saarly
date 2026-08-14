import { Item } from '@/types/domain';

export type ItemSortOrder = 'az' | 'za' | 'newest' | 'oldest';

export const ITEM_SORT_OPTIONS: { id: ItemSortOrder; label: string }[] = [
  { id: 'az', label: 'A–Z' },
  { id: 'za', label: 'Z–A' },
  { id: 'newest', label: 'Uuemad ees' },
  { id: 'oldest', label: 'Vanemad ees' },
];

const compareNames = (first: Item, second: Item) =>
  first.name.localeCompare(second.name, 'et', { sensitivity: 'base', numeric: true })
  || first.created_at.localeCompare(second.created_at)
  || first.id.localeCompare(second.id);

export function sortItems(items: Item[], order: ItemSortOrder): Item[] {
  return [...items].sort((first, second) => {
    if (order === 'az') return compareNames(first, second);
    if (order === 'za') return compareNames(second, first);
    if (order === 'oldest') return first.created_at.localeCompare(second.created_at) || compareNames(first, second);
    return second.created_at.localeCompare(first.created_at) || compareNames(first, second);
  });
}
