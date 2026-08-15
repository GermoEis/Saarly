import { DemoState, Item } from '@/types/domain';

export const normalizeProductName = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase('et-EE');

export function findActiveDuplicate(state: DemoState, listId: string | undefined, name: string): Item | undefined {
  const normalized = normalizeProductName(name);
  if (!listId || !normalized) return undefined;
  return state.items.find((item) => item.list_id === listId
    && !item.deleted_at
    && ['unassigned', 'assigned', 'accepted', 'unavailable'].includes(item.status)
    && normalizeProductName(item.name) === normalized);
}

export function findFloatingDuplicate(state: DemoState, name: string): Item | undefined {
  const normalized = normalizeProductName(name);
  if (!normalized) return undefined;
  return state.items.find((item) => !item.deleted_at && !item.assigned_to && item.status === 'unassigned'
    && !state.lists.find((list) => list.id === item.list_id)?.deleted_at
    && !state.lists.find((list) => list.id === item.list_id)?.archived_at
    && normalizeProductName(item.name) === normalized);
}

export const combinedQuantity = (current: number, addition: number) => current + (Number.isFinite(addition) && addition > 0 ? addition : 1);
