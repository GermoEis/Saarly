import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '@/context/AppContext';
import { ThemeColors } from '@/theme';
import { AppIcon } from '@/components/AppIcon';
import { Button, Card, Empty, Page } from '@/components/ui';
import { DeliveryFormSheet } from '@/components/DeliveryFormSheet';
import { formatEuros, settlementVisibleTo } from '@/data/settlements';
import { departureAt, departureTime, isActiveShipment } from '@/data/departures';
import { Delivery, Item } from '@/types/domain';

type ShipLoad = { ship: string; departureAt: number; departure: string; items: Item[]; deliveries: Delivery[] };

export default function ListsScreen() {
  const app = useApp(); const styles = makeStyles(app.themeColors);
  const [openedShip, setOpenedShip] = useState<string | null>(null);
  const [editingListId, setEditingListId] = useState<string | null>(null);
  const settlements = app.state.settlements.filter((value) => app.currentUser && settlementVisibleTo(value, app.currentUser.id) && ['open', 'marked_paid'].includes(value.status));
  const iOwe = settlements.filter((value) => value.debtor_id === app.currentUser?.id).reduce((sum, value) => sum + Number(value.amount), 0);
  const owedToMe = settlements.filter((value) => value.creditor_id === app.currentUser?.id).reduce((sum, value) => sum + Number(value.amount), 0);
  const shipLoads = useMemo(() => {
    const linksByDelivery = new Map<string, string[]>(); app.state.deliveryItems.forEach((link) => linksByDelivery.set(link.delivery_id, [...(linksByDelivery.get(link.delivery_id) ?? []), link.item_id]));
    const itemsById = new Map(app.state.items.map((item) => [item.id, item]));
    const loads = app.state.deliveries.filter((delivery) => isActiveShipment(delivery)).map((delivery) => {
      const linked = (linksByDelivery.get(delivery.id) ?? []).map((id) => itemsById.get(id)).filter((item): item is Item => Boolean(item && !item.deleted_at && item.status === 'purchased'));
      const items = linked.length ? linked : app.state.items.filter((item) => !item.deleted_at && item.list_id === delivery.list_id && item.assigned_to === delivery.courier_id && item.status === 'purchased');
      return { ship: delivery.ship_name, departureAt: departureAt(delivery), departure: `${delivery.departure_date.split('-').reverse().join('.')} kell ${departureTime(delivery.departure_time)}`, items, deliveries: [delivery] };
    }).filter((load) => load.items.length);
    const grouped = new Map<string, ShipLoad>();
    loads.forEach((load) => { const previous = grouped.get(load.ship); grouped.set(load.ship, previous ? { ...previous, departureAt: Math.min(previous.departureAt, load.departureAt), departure: previous.departureAt <= load.departureAt ? previous.departure : load.departure, items: [...previous.items, ...load.items], deliveries: [...previous.deliveries, ...load.deliveries] } : load); });
    return [...grouped.values()].sort((a, b) => a.departureAt - b.departureAt);
  }, [app.state.deliveries, app.state.deliveryItems, app.state.items]);
  const selected = shipLoads.find((load) => load.ship === openedShip);
  return <Page title={`Tere, ${app.currentUser?.display_name}!`} subtitle="Siin näed arveldusi ja praegu laevadel olevaid kaupu.">
    <Pressable accessibilityRole="link" accessibilityLabel="Ava arveldused" onPress={() => router.push('/(app)/settlements' as never)}><Card style={styles.settlementCard}><View style={styles.settlementIcon}><AppIcon name="euro" color={app.themeColors.primaryDark} size={23} strokeWidth={1.8} /></View><View style={{ flex: 1 }}><Text style={styles.name}>Arveldused</Text><Text style={styles.desc}>{settlements.length ? `Mina pean maksma ${formatEuros(iOwe)} · Mulle ${formatEuros(owedToMe)}` : 'Lisa ja vaata grupiliikmete vahelisi summasid.'}</Text></View><AppIcon name="chevron-right" color={app.themeColors.primary} size={21} strokeWidth={2.5} /></Card></Pressable>
    <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Laeval olevad asjad</Text><Text style={styles.sectionHint}>Saadetis liigub arhiivi 1 tund pärast väljumist.</Text></View>
    {shipLoads.length ? <View style={styles.grid}>{shipLoads.map((load) => {
      const editable = load.deliveries.find((delivery) => delivery.courier_id === app.currentUser?.id);
      const opened = openedShip === load.ship;
      return <Card key={load.ship} style={opened ? styles.shipCardOpen : undefined}><Pressable accessibilityRole="button" accessibilityState={{ expanded: opened }} onPress={() => setOpenedShip((current) => current === load.ship ? null : load.ship)} style={styles.shipCard}><View style={styles.shipIcon}><AppIcon name="ship" color={app.themeColors.accentText} size={25} /></View><View style={{ flex: 1 }}><Text style={styles.name}>{load.ship}</Text><Text style={styles.desc}>{load.items.length} {load.items.length === 1 ? 'asi' : 'asja'} · väljub {load.departure}</Text></View><AppIcon name={opened ? 'chevron-down' : 'chevron-right'} color={app.themeColors.primary} size={21} strokeWidth={2.5} /></Pressable>{opened && editable ? <Button label="Muuda laevainfot" variant="secondary" onPress={() => setEditingListId(editable.list_id)} /> : null}</Card>;
    })}</View> : <Empty icon="⚓" title="Laeval kaupu ei ole" body="Ostetud kaup ilmub siia pärast laeva ja väljumisaja määramist." />}
    {selected ? <Card style={styles.itemCard}><Text style={styles.name}>{selected.ship}</Text><Text style={styles.desc}>Väljub {selected.departure}</Text>{selected.items.map((item) => <View key={item.id} style={styles.itemRow}><Text style={styles.itemName}>{item.name}</Text><Text style={styles.itemMeta}>{item.quantity} {item.unit ?? 'tk'}</Text></View>)}</Card> : null}
    <DeliveryFormSheet listId={editingListId} onClose={() => setEditingListId(null)} />
  </Page>;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({ settlementCard: { flexDirection: 'row', alignItems: 'center', gap: 14 }, settlementIcon: { width: 46, height: 46, borderRadius: 10, backgroundColor: colors.subtle, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, sectionHead: { gap: 3, marginTop: 6 }, sectionTitle: { color: colors.ink, fontSize: 22, fontWeight: '700' }, sectionHint: { color: colors.muted, fontSize: 14, lineHeight: 20 }, grid: { gap: 10 }, shipCard: { flexDirection: 'row', alignItems: 'center', gap: 12 }, shipCardOpen: { borderColor: colors.accentBorder, backgroundColor: colors.accentSoft, gap: 12 }, shipIcon: { width: 42, height: 42, borderRadius: 9, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, name: { color: colors.ink, fontSize: 19, fontWeight: '700' }, desc: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 3 }, itemCard: { gap: 10 }, itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, gap: 12 }, itemName: { flex: 1, color: colors.ink, fontSize: 16, fontWeight: '600' }, itemMeta: { color: colors.muted, fontSize: 15 } });
