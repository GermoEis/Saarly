import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '@/context/AppContext';
import { ThemeColors } from '@/theme';
import { AppIcon } from '@/components/AppIcon';
import { Button, Card, Empty, Page } from '@/components/ui';
import { formatEuros, settlementVisibleTo } from '@/data/settlements';
import { barEntryRemaining, barEntryVisibleTo, formatBarEuros } from '@/data/barLedger';
import { Item } from '@/types/domain';
import { visibleShipLoads } from '@/data/shipLoads';

export default function ListsScreen() {
  const app = useApp(); const styles = makeStyles(app.themeColors);
  const [openedLoad, setOpenedLoad] = useState<string | null>(null);
  const settlements = app.state.settlements.filter((value) => app.currentUser && settlementVisibleTo(value, app.currentUser.id) && ['open', 'marked_paid'].includes(value.status));
  const iOwe = settlements.filter((value) => value.debtor_id === app.currentUser?.id).reduce((sum, value) => sum + Number(value.amount), 0);
  const owedToMe = settlements.filter((value) => value.creditor_id === app.currentUser?.id).reduce((sum, value) => sum + Number(value.amount), 0);
  const barEntries = app.state.barLedgerEntries.filter((entry) => app.currentUser && entry.status === 'open' && barEntryVisibleTo(app.state, entry, app.currentUser.id));
  const barTotal = barEntries.reduce((sum, entry) => sum + barEntryRemaining(app.state, entry), 0);
  const shipLoads = useMemo(() => visibleShipLoads(app.state.deliveries, app.state.deliveryItems, app.state.items), [app.state.deliveries, app.state.deliveryItems, app.state.items]);
  const selected = shipLoads.find((load) => load.key === openedLoad);
  const removeFromShip = (item: Item) => {
    const execute = () => { void app.removeFromDelivery(item.id); };
    if (Platform.OS === 'web') { if (window.confirm(`Kas eemaldada „${item.name}“ laevalt? Toode liigub tagasi ostetud asjade hulka.`)) execute(); }
    else Alert.alert('Eemalda laevalt?', `„${item.name}“ liigub tagasi ostetud asjade hulka.`, [{ text: 'Loobu', style: 'cancel' }, { text: 'Eemalda', style: 'destructive', onPress: execute }]);
  };
  return <Page title={`Tere, ${app.currentUser?.display_name}!`} subtitle="Siin näed arveldusi, baarivihikut ja praegu laevadel olevaid kaupu.">
    <Pressable accessibilityRole="link" accessibilityLabel="Ava arveldused" onPress={() => router.push('/(app)/settlements' as never)}><Card style={styles.settlementCard}><View style={styles.settlementIcon}><AppIcon name="euro" color={app.themeColors.primaryDark} size={23} strokeWidth={1.8} /></View><View style={{ flex: 1 }}><Text style={styles.name}>Arveldused</Text><Text style={styles.desc}>{settlements.length ? `Mina pean maksma ${formatEuros(iOwe)} · Mulle ${formatEuros(owedToMe)}` : 'Lisa ja vaata grupiliikmete vahelisi summasid.'}</Text></View><AppIcon name="chevron-right" color={app.themeColors.primary} size={21} strokeWidth={2.5} /></Card></Pressable>
    <Pressable accessibilityRole="link" accessibilityLabel="Ava Baarivihik" onPress={() => router.push('/(app)/bar-ledger' as never)}><Card style={styles.settlementCard}><View style={styles.settlementIcon}><AppIcon name="notes" color={app.themeColors.primaryDark} size={23} strokeWidth={1.8} /></View><View style={{ flex: 1 }}><Text style={styles.name}>Baarivihik</Text><Text style={styles.desc}>{barEntries.length ? `${barEntries.length} aktiivset kirjet · jääk ${formatBarEuros(barTotal)}` : 'Lisa ja halda baarist kriipsu peale võetud kaupu.'}</Text></View><AppIcon name="chevron-right" color={app.themeColors.primary} size={21} strokeWidth={2.5} /></Card></Pressable>
    <View style={styles.sectionHead}><Text style={styles.sectionTitle}>Laeval olevad asjad</Text><Text style={styles.sectionHint}>Saadetis liigub arhiivi 1 tund pärast väljumist.</Text></View>
    {shipLoads.length ? <View style={styles.grid}>{shipLoads.map((load) => {
      const opened = openedLoad === load.key;
      return <Card key={load.key} style={opened ? styles.shipCardOpen : undefined}><Pressable accessibilityRole="button" accessibilityState={{ expanded: opened }} onPress={() => setOpenedLoad((current) => current === load.key ? null : load.key)} style={styles.shipCard}><View style={styles.shipIcon}><AppIcon name="ship" color={app.themeColors.accentText} size={25} /></View><View style={{ flex: 1 }}><Text style={styles.name}>{load.ship}</Text><Text style={styles.desc}>{load.items.length} {load.items.length === 1 ? 'asi' : 'asja'} · väljub {load.departure}</Text></View><AppIcon name={opened ? 'chevron-down' : 'chevron-right'} color={app.themeColors.primary} size={21} strokeWidth={2.5} /></Pressable></Card>;
    })}</View> : <Empty icon="⚓" title="Laeval kaupu ei ole" body="Ostetud kaup ilmub siia pärast laeva ja väljumisaja määramist." />}
    {selected ? <Card style={styles.itemCard}><Text style={styles.name}>{selected.ship}</Text><Text style={styles.desc}>Väljub {selected.departure}</Text>{selected.items.map((item) => <View key={item.id} style={styles.itemRow}><View style={styles.itemCopy}><Text style={styles.itemName}>{item.name}</Text><Text style={styles.itemMeta}>{item.quantity} {item.unit ?? 'tk'}</Text></View>{item.assigned_to === app.currentUser?.id ? <Button label="Eemalda laevalt" variant="danger" onPress={() => removeFromShip(item)} /> : null}</View>)}</Card> : null}
  </Page>;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({ settlementCard: { flexDirection: 'row', alignItems: 'center', gap: 14 }, settlementIcon: { width: 46, height: 46, borderRadius: 10, backgroundColor: colors.subtle, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, sectionHead: { gap: 3, marginTop: 6 }, sectionTitle: { color: colors.ink, fontSize: 22, fontWeight: '700' }, sectionHint: { color: colors.muted, fontSize: 14, lineHeight: 20 }, grid: { gap: 10 }, shipCard: { flexDirection: 'row', alignItems: 'center', gap: 12 }, shipCardOpen: { borderColor: colors.accentBorder, backgroundColor: colors.accentSoft, gap: 12 }, shipIcon: { width: 42, height: 42, borderRadius: 9, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, name: { color: colors.ink, fontSize: 19, fontWeight: '700' }, desc: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 3 }, itemCard: { gap: 10 }, itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, gap: 12 }, itemCopy: { flex: 1, gap: 2 }, itemName: { color: colors.ink, fontSize: 16, fontWeight: '600' }, itemMeta: { color: colors.muted, fontSize: 15 } });
