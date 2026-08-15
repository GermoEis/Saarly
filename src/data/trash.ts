import { DemoState } from '@/types/domain';

export const TRASH_RETENTION_DAYS = 30;
const RETENTION_MS = TRASH_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const timestamp = () => new Date().toISOString();

export function moveItemToTrash(state: DemoState, itemId: string, deletedAt = timestamp()): DemoState {
  return {
    ...state,
    items: state.items.map((item) => item.id === itemId ? { ...item, deleted_at: deletedAt, updated_at: deletedAt } : item),
  };
}

export function restoreItemFromTrash(state: DemoState, itemId: string): DemoState {
  const at = timestamp();
  return {
    ...state,
    items: state.items.map((item) => item.id === itemId ? { ...item, deleted_at: undefined, updated_at: at } : item),
  };
}

export function moveListToTrash(state: DemoState, listId: string, deletedAt = timestamp()): DemoState {
  const list = state.lists.find((value) => value.id === listId);
  if (!list || list.is_quick_list) return state;
  return {
    ...state,
    lists: state.lists.map((value) => value.id === listId ? { ...value, deleted_at: deletedAt, updated_at: deletedAt } : value),
  };
}

export function restoreListFromTrash(state: DemoState, listId: string): DemoState {
  const at = timestamp();
  return {
    ...state,
    lists: state.lists.map((list) => list.id === listId ? { ...list, deleted_at: undefined, updated_at: at } : list),
  };
}

export function trashDaysRemaining(deletedAt: string, reference = new Date()): number {
  return Math.max(0, Math.ceil((new Date(deletedAt).getTime() + RETENTION_MS - reference.getTime()) / (24 * 60 * 60 * 1000)));
}

/** Eemaldab lokaalsest demost ainult üle 30 päeva prügikastis olnud kirjed ja nende alamandmed. */
export function purgeExpiredTrash(state: DemoState, reference = new Date()): DemoState {
  const expired = (deletedAt?: string) => Boolean(deletedAt && reference.getTime() - new Date(deletedAt).getTime() >= RETENTION_MS);
  const expiredListIds = new Set(state.lists.filter((list) => expired(list.deleted_at)).map((list) => list.id));
  const expiredItemIds = new Set(state.items.filter((item) => expired(item.deleted_at) || expiredListIds.has(item.list_id)).map((item) => item.id));
  const deliveryIds = new Set(state.deliveries.filter((delivery) => expiredListIds.has(delivery.list_id)).map((delivery) => delivery.id));

  if (!expiredListIds.size && !expiredItemIds.size) return state;
  return {
    ...state,
    lists: state.lists.filter((list) => !expiredListIds.has(list.id)),
    categories: state.categories.filter((category) => !expiredListIds.has(category.list_id)),
    items: state.items.filter((item) => !expiredItemIds.has(item.id)),
    assignments: state.assignments.filter((assignment) => !expiredItemIds.has(assignment.item_id)),
    attempts: state.attempts.filter((attempt) => !expiredItemIds.has(attempt.item_id)),
    deliveries: state.deliveries.filter((delivery) => !expiredListIds.has(delivery.list_id)),
    deliveryItems: state.deliveryItems.filter((entry) => !deliveryIds.has(entry.delivery_id) && !expiredItemIds.has(entry.item_id)),
    notifications: state.notifications.filter((notification) => !notification.list_id || !expiredListIds.has(notification.list_id)).filter((notification) => !notification.item_id || !expiredItemIds.has(notification.item_id)),
    activity: state.activity.filter((entry) => !entry.list_id || !expiredListIds.has(entry.list_id)).filter((entry) => !entry.item_id || !expiredItemIds.has(entry.item_id)),
    images: state.images.filter((image) => !expiredItemIds.has(image.item_id)),
    settlements: state.settlements.map((settlement) => settlement.shopping_list_id && expiredListIds.has(settlement.shopping_list_id) ? { ...settlement, shopping_list_id: undefined } : settlement),
  };
}
