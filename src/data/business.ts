import { Category, CategoryTemplate, Delivery, DemoState, ItemStatus, Notification, ShoppingList, ThemeMode } from '@/types/domain';
import { deliveryCompletedNotification } from './access';

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const timestamp = () => new Date().toISOString();

function record(state: DemoState, itemId: string, actorId: string, action: string, previous_status?: ItemStatus, new_status?: ItemStatus, explanation?: string): DemoState {
  const item = state.items.find((value) => value.id === itemId);
  const at = timestamp();
  return { ...state, activity: [...state.activity, { id: uid(), group_id: 'family', actor_id: actorId, list_id: item?.list_id, item_id: itemId, action, previous_status, new_status, explanation, created_at: at, updated_at: at }] };
}

function notify(state: DemoState, notification: Omit<Notification, 'id' | 'created_at' | 'updated_at' | 'group_id'>): DemoState {
  const at = timestamp();
  return { ...state, notifications: [{ ...notification, id: uid(), group_id: 'family', created_at: at, updated_at: at }, ...state.notifications] };
}

function ensureQuickList(state: DemoState, groupId: string, actorId: string, at: string) {
  const existingList = state.lists.find((value) => value.group_id === groupId && value.is_quick_list);
  const listId = existingList?.id ?? `${uid()}-quick-list`;
  const existingCategory = state.categories.find((value) => value.list_id === listId);
  const categoryId = existingCategory?.id ?? `${uid()}-quick-category`;
  const list: ShoppingList = existingList ?? {
    id: listId,
    group_id: groupId,
    created_by: actorId,
    name: 'Jooksev list',
    description: 'Ilma eraldi ostunimekirjata lisatud kaubad',
    is_quick_list: true,
    created_at: at,
    updated_at: at,
  };
  const category: Category = existingCategory ?? {
    id: categoryId,
    list_id: listId,
    name: 'Üldine',
    sort_order: 0,
    created_at: at,
    updated_at: at,
  };
  return {
    state: {
      ...state,
      lists: existingList ? state.lists : [...state.lists, list],
      categories: existingCategory ? state.categories : [...state.categories, category],
    },
    listId,
    categoryId,
  };
}

export function archiveListIfComplete(state: DemoState, listId: string): DemoState {
  const list = state.lists.find((value) => value.id === listId);
  if (!list || list.is_quick_list || list.archived_at || list.deleted_at) return state;
  const hasUnfinishedItems = state.items.some((item) =>
    item.list_id === listId && !item.deleted_at && !['purchased', 'delivered', 'cancelled'].includes(item.status),
  );
  if (hasUnfinishedItems) return state;
  const at = timestamp();
  return {
    ...state,
    lists: state.lists.map((value) => value.id === listId ? { ...value, archived_at: at, updated_at: at } : value),
  };
}

export function claimItem(state: DemoState, itemId: string, userId: string): { state: DemoState; ok: boolean; message?: string } {
  const item = state.items.find((value) => value.id === itemId);
  if (!item || item.deleted_at || state.lists.find((list) => list.id === item.list_id)?.deleted_at || item.assigned_to || (item.status !== 'unassigned' && item.status !== 'unavailable')) {
    return { state, ok: false, message: 'Selle toote võttis juba teine viija.' };
  }
  const at = timestamp();
  let next = { ...state, items: state.items.map((value) => value.id === itemId ? { ...value, assigned_to: userId, status: 'accepted' as const, updated_at: at } : value) };
  next = record(next, itemId, userId, 'Võttis ujuva toote endale', item.status, 'accepted');
  return { state: next, ok: true };
}

export function acceptItem(state: DemoState, itemId: string, userId: string): DemoState {
  const item = state.items.find((value) => value.id === itemId);
  if (!item || item.deleted_at || item.assigned_to !== userId || item.status !== 'assigned') return state;
  const at = timestamp();
  let next = { ...state, items: state.items.map((value) => value.id === itemId ? { ...value, status: 'accepted' as const, updated_at: at } : value), assignments: state.assignments.map((value) => value.item_id === itemId && value.user_id === userId ? { ...value, status: 'accepted' as const, updated_at: at } : value) };
  return record(next, itemId, userId, 'Võttis ülesande vastu', 'assigned', 'accepted');
}

export function declineItem(state: DemoState, itemId: string, userId: string): DemoState {
  const item = state.items.find((value) => value.id === itemId);
  if (!item || item.deleted_at || item.assigned_to !== userId) return state;
  const at = timestamp();
  const originalList = state.lists.find((value) => value.id === item.list_id);
  const quick = originalList?.is_quick_list ? null : ensureQuickList(state, originalList?.group_id ?? 'family', userId, at);
  const prepared = quick?.state ?? state;
  let next = { ...prepared, items: prepared.items.map((value) => value.id === itemId ? { ...value, list_id: quick?.listId ?? value.list_id, category_id: quick?.categoryId ?? value.category_id, assigned_to: undefined, status: 'unassigned' as const, updated_at: at } : value), assignments: prepared.assignments.map((value) => value.item_id === itemId && value.user_id === userId ? { ...value, status: 'declined' as const, updated_at: at } : value) };
  next = record(next, itemId, userId, 'Keeldus tootest', item.status, 'unassigned');
  return archiveListIfComplete(next, item.list_id);
}

export function setItemOutcome(state: DemoState, itemId: string, userId: string, outcome: 'purchased' | 'unavailable' | 'delivered', note?: string): DemoState {
  const item = state.items.find((value) => value.id === itemId);
  if (!item || item.deleted_at || item.assigned_to !== userId) return state;
  const at = timestamp();
  const assigned_to = outcome === 'unavailable' ? undefined : userId;
  const status: ItemStatus = outcome === 'unavailable' ? 'unassigned' : outcome;
  const originalList = state.lists.find((value) => value.id === item.list_id);
  const quick = outcome === 'unavailable' && !originalList?.is_quick_list
    ? ensureQuickList(state, originalList?.group_id ?? 'family', userId, at)
    : null;
  const prepared = quick?.state ?? state;
  let next: DemoState = { ...prepared, items: prepared.items.map((value) => value.id === itemId ? { ...value, list_id: quick?.listId ?? value.list_id, category_id: quick?.categoryId ?? value.category_id, assigned_to, status, searched_before: value.searched_before || outcome === 'unavailable', updated_at: at } : value) };
  if (outcome === 'unavailable') next = { ...next, attempts: [...next.attempts, { id: uid(), item_id: itemId, user_id: userId, outcome: 'not_found', note, created_at: at, updated_at: at }] };
  const label = outcome === 'purchased' ? 'Märkis toote ostetuks' : outcome === 'delivered' ? 'Märkis toote laevale viiduks' : 'Ei leidnud toodet poest';
  next = record(next, itemId, userId, label, item.status, status, note);
  if (outcome === 'unavailable' && item.created_by !== userId) next = notify(next, { user_id: item.created_by, actor_id: userId, list_id: quick?.listId ?? item.list_id, item_id: itemId, type: 'item_unavailable', title: 'Toodet ei olnud poes', body: `${profileName(next, userId)}: „${item.name}“ — poes ei olnud.` });
  return archiveListIfComplete(next, item.list_id);
}

export function profileName(state: DemoState, id?: string) { return state.profiles.find((value) => value.id === id)?.display_name ?? 'Kasutaja'; }

export function statusForAssignment(assignedTo?: string): ItemStatus {
  return assignedTo ? 'accepted' : 'unassigned';
}

export function assignedItemsForUser(state: DemoState, userId?: string) {
  if (!userId) return [];
  return state.items.filter((item) =>
    !item.deleted_at && !state.lists.find((list) => list.id === item.list_id)?.deleted_at && item.assigned_to === userId && ['assigned', 'accepted', 'purchased'].includes(item.status),
  );
}

export function updateShoppingList(state: DemoState, listId: string, name: string, description?: string): DemoState {
  const cleanName = name.trim();
  if (!cleanName) return state;
  const cleanDescription = description?.trim() || undefined;
  return { ...state, lists: state.lists.map((list) => list.id === listId ? { ...list, name: cleanName, description: cleanDescription, updated_at: timestamp() } : list) };
}

export function deleteListPreservingFloating(state: DemoState, listId: string, actorId: string): DemoState {
  const list = state.lists.find((value) => value.id === listId);
  if (!list || list.is_quick_list) return state;

  const at = timestamp();
  const floating = state.items.filter((item) =>
    item.list_id === listId && !item.assigned_to && ['unassigned', 'unavailable'].includes(item.status),
  );
  const floatingIds = new Set(floating.map((item) => item.id));
  const deletedIds = new Set(state.items.filter((item) => item.list_id === listId && !floatingIds.has(item.id)).map((item) => item.id));
  const existingQuickList = state.lists.find((value) => value.group_id === list.group_id && value.is_quick_list);
  const quickListId = existingQuickList?.id ?? `${uid()}-quick-list`;
  const existingQuickCategory = state.categories.find((value) => value.list_id === quickListId);
  const quickCategoryId = existingQuickCategory?.id ?? `${uid()}-quick-category`;
  const quickList: ShoppingList = existingQuickList ?? {
    id: quickListId,
    group_id: list.group_id,
    created_by: actorId,
    name: 'Jooksev list',
    description: 'Ilma eraldi ostunimekirjata lisatud kaubad',
    is_quick_list: true,
    created_at: at,
    updated_at: at,
  };
  const quickCategory: Category = existingQuickCategory ?? {
    id: quickCategoryId,
    list_id: quickListId,
    name: 'Üldine',
    sort_order: 0,
    created_at: at,
    updated_at: at,
  };
  const deliveryIds = new Set(state.deliveries.filter((delivery) => delivery.list_id === listId).map((delivery) => delivery.id));
  const movedActivity = state.activity
    .filter((value) => value.list_id !== listId || Boolean(value.item_id && floatingIds.has(value.item_id)))
    .map((value) => value.list_id === listId ? { ...value, list_id: quickListId } : value);
  const preservationActivity = floating.map((item) => ({
    id: uid(), group_id: list.group_id, actor_id: actorId, list_id: quickListId, item_id: item.id,
    action: 'Säilitas toote jooksvas listis nimekirja kustutamisel', previous_status: item.status,
    new_status: item.status, created_at: at, updated_at: at,
  }));

  return {
    ...state,
    lists: [...state.lists.filter((value) => value.id !== listId && value.id !== quickListId), quickList],
    categories: [...state.categories.filter((value) => value.list_id !== listId && value.id !== quickCategoryId), quickCategory],
    items: state.items
      .filter((item) => item.list_id !== listId || floatingIds.has(item.id))
      .map((item) => floatingIds.has(item.id) ? { ...item, list_id: quickListId, category_id: quickCategoryId, updated_at: at } : item),
    assignments: state.assignments.filter((value) => !deletedIds.has(value.item_id)),
    attempts: state.attempts.filter((value) => !deletedIds.has(value.item_id)),
    deliveries: state.deliveries.filter((value) => value.list_id !== listId),
    deliveryItems: state.deliveryItems.filter((value) => !deliveryIds.has(value.delivery_id) && !deletedIds.has(value.item_id)),
    notifications: state.notifications
      .filter((value) => value.list_id !== listId || Boolean(value.item_id && floatingIds.has(value.item_id)))
      .map((value) => value.list_id === listId ? { ...value, list_id: quickListId } : value),
    activity: [...movedActivity, ...preservationActivity],
    images: state.images.filter((value) => !deletedIds.has(value.item_id)),
    settlements: state.settlements.map((value) => value.shopping_list_id === listId ? { ...value, shopping_list_id: undefined, updated_at: at } : value),
  };
}

export function setProfileThemePreference(state: DemoState, profileId: string, theme: ThemeMode): DemoState {
  return { ...state, profiles: state.profiles.map((profile) => profile.id === profileId ? { ...profile, theme_preference: theme, updated_at: timestamp() } : profile) };
}

export function saveDeliveryInDemo(state: DemoState, listId: string, userId: string, input: Pick<Delivery, 'ship_name' | 'departure_date' | 'departure_time' | 'port' | 'handover_place'> & Partial<Pick<Delivery, 'note'>>, delivered = false): DemoState {
  const at = timestamp(); const previous = state.deliveries.find((value) => value.list_id === listId && value.courier_id === userId);
  const delivery: Delivery = { ...input, id: previous?.id ?? uid(), list_id: listId, created_by: previous?.created_by ?? userId, courier_id: userId, status: delivered ? 'delivered' : 'planned', created_at: previous?.created_at ?? at, updated_at: at };
  const list = state.lists.find((value) => value.id === listId); const actor = profileName(state, userId);
  const purchased = delivered ? state.items.filter((item) => !item.deleted_at && item.list_id === listId && item.assigned_to === userId && item.status === 'purchased') : [];
  const notification = delivered && list && list.created_by !== userId ? { id: uid(), group_id: list.group_id, user_id: list.created_by, actor_id: userId, list_id: listId, type: 'delivery_completed', title: 'Kaubad laevale viidud', body: deliveryCompletedNotification(actor, input.ship_name, input.departure_date, input.departure_time, input.handover_place), created_at: at, updated_at: at } : null;
  const deliveredActivity = purchased.map((item) => ({ id: uid(), group_id: list?.group_id ?? 'family', actor_id: userId, list_id: listId, item_id: item.id, action: 'Märkis kaubad laevale viiduks', previous_status: 'purchased' as const, new_status: 'delivered' as const, created_at: at, updated_at: at }));
  const deliveryItems = purchased.map((item) => ({ id: uid(), delivery_id: delivery.id, item_id: item.id, created_at: at, updated_at: at }));
  return { ...state, items: delivered ? state.items.map((item) => purchased.some((value) => value.id === item.id) ? { ...item, status: 'delivered' as const, updated_at: at } : item) : state.items, deliveries: [...state.deliveries.filter((value) => value.id !== delivery.id), delivery], deliveryItems: [...state.deliveryItems.filter((value) => value.delivery_id !== delivery.id), ...deliveryItems], notifications: notification ? [notification, ...state.notifications] : state.notifications, activity: [...state.activity, ...deliveredActivity] };
}

export function releaseAllItems(state: DemoState, userId: string): DemoState {
  return state.items.filter((item) => !item.deleted_at && item.assigned_to === userId && ['assigned', 'accepted'].includes(item.status))
    .reduce((current, item) => declineItem(current, item.id, userId), state);
}

export function removeBuyerMember(state: DemoState, profileId: string, actorId: string): DemoState {
  const member = state.groupMembers.find((value) => value.profile_id === profileId);
  if (!member || member.role !== 'buyer') return state;

  let next = state.items.filter((item) => !item.deleted_at && item.assigned_to === profileId && ['assigned', 'accepted'].includes(item.status))
    .reduce((current, item) => {
      const at = timestamp();
      let released: DemoState = {
        ...current,
        items: current.items.map((value) => value.id === item.id ? { ...value, assigned_to: undefined, status: 'unassigned' as const, updated_at: at } : value),
        assignments: current.assignments.map((value) => value.item_id === item.id && value.user_id === profileId && ['pending', 'accepted'].includes(value.status) ? { ...value, status: 'released' as const, updated_at: at } : value),
      };
      released = record(released, item.id, actorId, 'Eemaldas kasutaja ja vabastas toote', item.status, 'unassigned', 'Kasutaja eemaldati grupist.');
      return released;
    }, state);

  next = { ...next, groupMembers: next.groupMembers.filter((value) => value.id !== member.id) };
  return next;
}

export function categoriesForNewList(templates: CategoryTemplate[], listId: string, at: string, makeId: () => string): Category[] {
  return [...templates].sort((a, b) => a.sort_order - b.sort_order).map((template) => ({ id: makeId(), list_id: listId, name: template.name, sort_order: template.sort_order, created_at: at, updated_at: at }));
}
