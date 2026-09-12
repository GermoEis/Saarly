import { departureAt, departureTime, isDeliveredShipmentVisible } from './departures';
import { Delivery, DeliveryItem, Item } from '@/types/domain';

export type ShipLoad = { key: string; ship: string; departureAt: number; departure: string; items: Item[]; deliveries: Delivery[] };

export function visibleShipLoads(deliveries: Delivery[], deliveryItems: DeliveryItem[], items: Item[], currentTime = Date.now()): ShipLoad[] {
  const linksByDelivery = new Map<string, string[]>();
  deliveryItems.forEach((link) => linksByDelivery.set(link.delivery_id, [...(linksByDelivery.get(link.delivery_id) ?? []), link.item_id]));
  const itemsById = new Map(items.map((item) => [item.id, item]));
  const loads = deliveries.filter((delivery) => isDeliveredShipmentVisible(delivery, currentTime)).map((delivery) => {
    const linked = (linksByDelivery.get(delivery.id) ?? []).map((id) => itemsById.get(id)).filter((item): item is Item => Boolean(item && !item.deleted_at && item.status === 'delivered'));
    const fallback = items.filter((item) => !item.deleted_at && item.list_id === delivery.list_id && item.assigned_to === delivery.courier_id && item.status === 'delivered');
    const sailingKey = `${delivery.ship_name.trim().toLocaleLowerCase('et-EE')}|${delivery.departure_date}|${departureTime(delivery.departure_time)}`;
    return { key: sailingKey, ship: delivery.ship_name, departureAt: departureAt(delivery), departure: `${delivery.departure_date.split('-').reverse().join('.')} kell ${departureTime(delivery.departure_time)}`, items: linked.length ? linked : fallback, deliveries: [delivery] };
  }).filter((load) => load.items.length);

  const grouped = new Map<string, ShipLoad>();
  loads.forEach((load) => {
    const previous = grouped.get(load.key);
    if (!previous) { grouped.set(load.key, load); return; }
    const uniqueItems = new Map([...previous.items, ...load.items].map((item) => [item.id, item]));
    grouped.set(load.key, { ...previous, items: [...uniqueItems.values()], deliveries: [...previous.deliveries, ...load.deliveries] });
  });
  return [...grouped.values()].sort((first, second) => first.departureAt - second.departureAt);
}
