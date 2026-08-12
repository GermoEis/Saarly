import { Category, CategoryTemplate, Delivery, DemoState, ItemStatus, Notification, ThemeMode } from '@/types/domain';
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

export function claimItem(state: DemoState, itemId: string, userId: string): { state: DemoState; ok: boolean; message?: string } {
  const item = state.items.find((value) => value.id === itemId);
  if (!item || item.assigned_to || (item.status !== 'unassigned' && item.status !== 'unavailable')) {
    return { state, ok: false, message: 'Selle toote võttis juba teine viija.' };
  }
  const at = timestamp();
  let next = { ...state, items: state.items.map((value) => value.id === itemId ? { ...value, assigned_to: userId, status: 'accepted' as const, updated_at: at } : value) };
  next = record(next, itemId, userId, 'Võttis ujuva toote endale', item.status, 'accepted');
  return { state: next, ok: true };
}

export function acceptItem(state: DemoState, itemId: string, userId: string): DemoState {
  const item = state.items.find((value) => value.id === itemId);
  if (!item || item.assigned_to !== userId || item.status !== 'assigned') return state;
  const at = timestamp();
  let next = { ...state, items: state.items.map((value) => value.id === itemId ? { ...value, status: 'accepted' as const, updated_at: at } : value), assignments: state.assignments.map((value) => value.item_id === itemId && value.user_id === userId ? { ...value, status: 'accepted' as const, updated_at: at } : value) };
  return record(next, itemId, userId, 'Võttis ülesande vastu', 'assigned', 'accepted');
}

export function declineItem(state: DemoState, itemId: string, userId: string): DemoState {
  const item = state.items.find((value) => value.id === itemId);
  if (!item || item.assigned_to !== userId) return state;
  const at = timestamp();
  let next = { ...state, items: state.items.map((value) => value.id === itemId ? { ...value, assigned_to: undefined, status: 'unassigned' as const, updated_at: at } : value), assignments: state.assignments.map((value) => value.item_id === itemId && value.user_id === userId ? { ...value, status: 'declined' as const, updated_at: at } : value) };
  next = record(next, itemId, userId, 'Keeldus tootest', item.status, 'unassigned');
  return next;
}

export function setItemOutcome(state: DemoState, itemId: string, userId: string, outcome: 'purchased' | 'unavailable' | 'delivered', note?: string): DemoState {
  const item = state.items.find((value) => value.id === itemId);
  if (!item || item.assigned_to !== userId) return state;
  const at = timestamp();
  const assigned_to = outcome === 'unavailable' ? undefined : userId;
  const status: ItemStatus = outcome === 'unavailable' ? 'unassigned' : outcome;
  let next: DemoState = { ...state, items: state.items.map((value) => value.id === itemId ? { ...value, assigned_to, status, searched_before: value.searched_before || outcome === 'unavailable', updated_at: at } : value) };
  if (outcome === 'unavailable') next = { ...next, attempts: [...next.attempts, { id: uid(), item_id: itemId, user_id: userId, outcome: 'not_found', note, created_at: at, updated_at: at }] };
  const label = outcome === 'purchased' ? 'Märkis toote ostetuks' : outcome === 'delivered' ? 'Märkis toote laevale viiduks' : 'Ei leidnud toodet poest';
  next = record(next, itemId, userId, label, item.status, status, note);
  if (outcome === 'unavailable' && item.created_by !== userId) next = notify(next, { user_id: item.created_by, actor_id: userId, list_id: item.list_id, item_id: itemId, type: 'item_unavailable', title: 'Toodet ei olnud poes', body: `${profileName(next, userId)}: „${item.name}“ — poes ei olnud.` });
  return next;
}

export function profileName(state: DemoState, id?: string) { return state.profiles.find((value) => value.id === id)?.display_name ?? 'Kasutaja'; }

export function statusForAssignment(assignedTo?: string): ItemStatus {
  return assignedTo ? 'accepted' : 'unassigned';
}

export function setProfileThemePreference(state: DemoState, profileId: string, theme: ThemeMode): DemoState {
  return { ...state, profiles: state.profiles.map((profile) => profile.id === profileId ? { ...profile, theme_preference: theme, updated_at: timestamp() } : profile) };
}

export function saveDeliveryInDemo(state: DemoState, listId: string, userId: string, input: Pick<Delivery, 'ship_name' | 'departure_date' | 'departure_time' | 'port' | 'handover_place'> & Partial<Pick<Delivery, 'note'>>, delivered = false): DemoState {
  const at = timestamp(); const previous = state.deliveries.find((value) => value.list_id === listId && value.courier_id === userId);
  const delivery: Delivery = { ...input, id: previous?.id ?? uid(), list_id: listId, created_by: previous?.created_by ?? userId, courier_id: userId, status: delivered ? 'delivered' : 'planned', created_at: previous?.created_at ?? at, updated_at: at };
  const list = state.lists.find((value) => value.id === listId); const actor = profileName(state, userId);
  const purchased = delivered ? state.items.filter((item) => item.list_id === listId && item.assigned_to === userId && item.status === 'purchased') : [];
  const notification = delivered && list && list.created_by !== userId ? { id: uid(), group_id: list.group_id, user_id: list.created_by, actor_id: userId, list_id: listId, type: 'delivery_completed', title: 'Kaubad laevale viidud', body: deliveryCompletedNotification(actor, input.ship_name, input.departure_date, input.departure_time, input.handover_place), created_at: at, updated_at: at } : null;
  const deliveredActivity = purchased.map((item) => ({ id: uid(), group_id: list?.group_id ?? 'family', actor_id: userId, list_id: listId, item_id: item.id, action: 'Märkis kaubad laevale viiduks', previous_status: 'purchased' as const, new_status: 'delivered' as const, created_at: at, updated_at: at }));
  const deliveryItems = purchased.map((item) => ({ id: uid(), delivery_id: delivery.id, item_id: item.id, created_at: at, updated_at: at }));
  return { ...state, items: delivered ? state.items.map((item) => purchased.some((value) => value.id === item.id) ? { ...item, status: 'delivered' as const, updated_at: at } : item) : state.items, deliveries: [...state.deliveries.filter((value) => value.id !== delivery.id), delivery], deliveryItems: [...state.deliveryItems.filter((value) => value.delivery_id !== delivery.id), ...deliveryItems], notifications: notification ? [notification, ...state.notifications] : state.notifications, activity: [...state.activity, ...deliveredActivity] };
}

export function releaseAllItems(state: DemoState, userId: string): DemoState {
  return state.items.filter((item) => item.assigned_to === userId && ['assigned', 'accepted'].includes(item.status))
    .reduce((current, item) => declineItem(current, item.id, userId), state);
}

export function removeBuyerMember(state: DemoState, profileId: string, actorId: string): DemoState {
  const member = state.groupMembers.find((value) => value.profile_id === profileId);
  if (!member || member.role !== 'buyer') return state;

  let next = state.items.filter((item) => item.assigned_to === profileId && ['assigned', 'accepted'].includes(item.status))
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
