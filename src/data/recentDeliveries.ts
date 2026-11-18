import { DemoState, Item } from '@/types/domain';

export const RECENT_DELIVERY_WINDOW_MS = 24 * 60 * 60 * 1000;

export function recentDeliveriesForUser(state: DemoState, userId?: string, now = Date.now()) {
  if (!userId) return [];

  // Use the actual status change: editing an old product must not make it
  // appear newly delivered. Older records fall back to the shipment/item time.
  const completedAt = new Map<string, number>();
  for (const entry of state.activity) {
    if (!entry.item_id || entry.new_status !== 'delivered' || entry.previous_status === 'delivered') continue;
    const time = Date.parse(entry.created_at);
    if (Number.isFinite(time)) completedAt.set(entry.item_id, Math.max(completedAt.get(entry.item_id) ?? 0, time));
  }
  const shipments = new Map(state.deliveries.filter((delivery) => delivery.status === 'delivered').map((delivery) => [delivery.id, Date.parse(delivery.updated_at)]));
  const shipmentTimes = new Map<string, number>();
  for (const link of state.deliveryItems) {
    const time = shipments.get(link.delivery_id);
    if (time !== undefined && Number.isFinite(time)) shipmentTimes.set(link.item_id, Math.max(shipmentTimes.get(link.item_id) ?? 0, time));
  }
  const lists = new Map(state.lists.map((list) => [list.id, list]));
  const recent: { item: Item; expiresAt: number }[] = [];
  for (const item of state.items) {
    const list = lists.get(item.list_id);
    if (item.deleted_at || !list || list.deleted_at || item.assigned_to !== userId || item.status !== 'delivered') continue;
    const time = completedAt.get(item.id) ?? shipmentTimes.get(item.id) ?? Date.parse(item.updated_at);
    const expiresAt = time + RECENT_DELIVERY_WINDOW_MS;
    if (Number.isFinite(time) && expiresAt > now) recent.push({ item, expiresAt });
  }
  return recent.sort((a, b) => b.expiresAt - a.expiresAt);
}
