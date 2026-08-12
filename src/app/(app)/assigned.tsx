import { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { useApp } from '@/context/AppContext';
import { ItemCard } from '@/components/ItemCard';
import { DeliveryFormSheet } from '@/components/DeliveryFormSheet';
import { Button, Card, Empty, Page } from '@/components/ui';
import { ThemeColors } from '@/theme';
import { Item } from '@/types/domain';

export default function AssignedScreen() {
  const app = useApp(); const userId = app.currentUser?.id;
  const styles = makeStyles(app.themeColors);
  const [deliveryListId, setDeliveryListId] = useState<string | null>(null);
  const items = app.state.items.filter((item) => item.assigned_to === userId && item.status !== 'cancelled' && item.status !== 'delivered');
  const toBuy = items.filter((item) => item.status === 'assigned' || item.status === 'accepted');
  const purchased = items.filter((item) => item.status === 'purchased');
  const myListIds = [...new Set(app.state.items.filter((item) => item.assigned_to === userId && item.status !== 'cancelled').map((item) => item.list_id))];
  const readyLists = myListIds.filter((listId) => {
    const mine = app.state.items.filter((item) => item.list_id === listId && item.assigned_to === userId && item.status !== 'cancelled');
    return mine.some((item) => item.status === 'purchased') && mine.every((item) => item.status === 'purchased' || item.status === 'delivered');
  });
  const releaseAll = () => { const run = () => app.releaseAll(); if (Platform.OS === 'web') { if (window.confirm('Kas sa ei saa praegu ühtegi määratud asja võtta? Kõik ostmata asjad liiguvad jooksvasse listi.')) run(); } else Alert.alert('Kas ei saa praegu midagi võtta?', 'Kõik ostmata asjad liiguvad jooksvasse listi.', [{ text: 'Loobu', style: 'cancel' }, { text: 'Jah, vabasta kõik', style: 'destructive', onPress: run }]); };

  return <Page title="Minule määratud" subtitle="Määratud asjad on kohe aktiivsed. Märgi need ostetuks või anna teada, kui toodet ei olnud." action={toBuy.length ? <Button label="Ei saa praegu midagi võtta" variant="danger" onPress={releaseAll} /> : undefined}>
    {readyLists.map((listId) => {
      const list = app.state.lists.find((value) => value.id === listId); const delivery = app.state.deliveries.find((value) => value.list_id === listId && value.courier_id === userId);
      if (!list) return null;
      return <Card key={listId} style={styles.deliveryCard}><Text style={styles.deliveryIcon}>⚓</Text><View style={styles.deliveryCopy}><Text style={styles.deliveryTitle}>Kõik sinu asjad on ostetud</Text><Text style={styles.deliveryText}>{list.is_quick_list ? 'Jooksvast listist võetud kaubad' : list.name}</Text>{delivery ? <Text style={styles.deliveryText}>{delivery.ship_name} · {delivery.departure_date.split('-').reverse().join('.')}{delivery.departure_time ? ` kell ${delivery.departure_time}` : ''} · {delivery.handover_place}</Text> : <Text style={styles.deliveryText}>Palun määra, mis laeva peale kauba panid.</Text>}</View>{delivery ? <Button label="Laevale viidud" icon="⚓" onPress={() => app.saveDelivery(listId, { ship_name: delivery.ship_name, departure_date: delivery.departure_date, departure_time: delivery.departure_time, port: delivery.port, handover_place: delivery.handover_place, note: delivery.note }, true)} /> : <Button label="Määra laev" variant="secondary" onPress={() => setDeliveryListId(listId)} />}</Card>;
    })}
    {!items.length && !readyLists.length ? <Empty icon="✓" title="Kõik on korras" body="Sul pole praegu ühtegi määratud toodet." /> : <>{toBuy.length ? <Section title="Ostmist ootavad" count={toBuy.length}>{toBuy.map((item) => <AssignedRow key={item.id} item={item} />)}</Section> : null}{purchased.length ? <Section title="Ostetud" count={purchased.length}>{purchased.map((item) => <ItemCard key={item.id} item={item} compact />)}</Section> : null}</>}
    <DeliveryFormSheet listId={deliveryListId} onClose={() => setDeliveryListId(null)} />
  </Page>;
}

function AssignedRow({ item }: { item: Item }) {
  const app = useApp(); const styles = makeStyles(app.themeColors);
  return <View style={styles.assignedBlock}><ItemCard item={item} compact /><View style={styles.actions}><Button label="Ostetud" icon="✓" onPress={() => app.outcome(item.id, 'purchased')} /><Button label="Ei leidnud / ei ole" icon="!" variant="danger" onPress={() => app.outcome(item.id, 'unavailable', 'Kasutaja märkis, et toodet ei leidnud või seda ei ole.')} /></View></View>;
}
function Section({ title, count, children }: React.PropsWithChildren<{ title: string; count: number }>) { const app = useApp(); const styles = makeStyles(app.themeColors); return <View style={{ gap: 11 }}><View style={styles.head}><Text style={styles.title}>{title}</Text><Text style={styles.count}>{count}</Text></View>{children}</View>; }
const makeStyles = (colors: ThemeColors) => StyleSheet.create({ head: { flexDirection: 'row', alignItems: 'center', gap: 9 }, title: { color: colors.ink, fontWeight: '900', fontSize: 20 }, count: { backgroundColor: colors.primarySoft, color: colors.primaryDark, fontWeight: '900', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 99 }, assignedBlock: { gap: 8 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 4 }, deliveryCard: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 13, backgroundColor: colors.accentSoft }, deliveryIcon: { fontSize: 30 }, deliveryCopy: { flex: 1, minWidth: 210 }, deliveryTitle: { color: colors.ink, fontSize: 19, fontWeight: '900' }, deliveryText: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 3 } });
