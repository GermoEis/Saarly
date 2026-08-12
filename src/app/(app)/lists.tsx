import React, { useState } from 'react';
import { router } from 'expo-router';
import { Alert, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useApp } from '@/context/AppContext';
import { ThemeColors } from '@/theme';
import { Button, Card, Empty, Field, Page, Sheet } from '@/components/ui';
import { formatEuros, settlementVisibleTo } from '@/data/settlements';

export default function ListsScreen() {
  const app = useApp(); const { width } = useWindowDimensions();
  const styles = makeStyles(app.themeColors);
  const [adding, setAdding] = useState(false); const [name, setName] = useState(''); const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false); const [formError, setFormError] = useState('');
  const lists = app.state.lists.filter((list) => !list.archived_at && !list.is_quick_list);
  const settlements = app.state.settlements.filter((value) => app.currentUser && settlementVisibleTo(value, app.currentUser.id) && ['open', 'marked_paid'].includes(value.status));
  const iOwe = settlements.filter((value) => value.debtor_id === app.currentUser?.id).reduce((sum, value) => sum + Number(value.amount), 0);
  const owedToMe = settlements.filter((value) => value.creditor_id === app.currentUser?.id).reduce((sum, value) => sum + Number(value.amount), 0);
  const submit = async () => {
    if (!name.trim() || saving) return;
    setSaving(true); setFormError('');
    try {
      const id = await app.addList(name.trim(), description.trim() || undefined);
      setName(''); setDescription(''); setAdding(false);
      router.push(`/(app)/list/${id}` as never);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'Nimekirja loomine ebaõnnestus. Proovi uuesti.');
    } finally {
      setSaving(false);
    }
  };
  const remove = (id: string, listName: string) => { const run = () => app.deleteList(id); if (Platform.OS === 'web') { if (window.confirm(`Kas kustutada nimekiri „${listName}“ koos kõigi toodete ja ajalooga?`)) run(); } else Alert.alert('Kustuta nimekiri?', `„${listName}“ ja selle sisu kustutatakse jäädavalt.`, [{ text: 'Loobu', style: 'cancel' }, { text: 'Kustuta', style: 'destructive', onPress: run }]); };
  return <Page title={`Tere, ${app.currentUser?.display_name}!`} subtitle={app.isCreator ? 'Siin on grupi aktiivsed ostunimekirjad.' : 'Vaata, mida on vaja osta ja laevale toimetada.'} action={app.isCreator ? <Button label={width < 480 ? 'Uus' : 'Uus nimekiri'} icon="+" onPress={() => setAdding(true)} /> : undefined}>
    <Pressable accessibilityRole="link" accessibilityLabel="Ava arveldused" onPress={() => router.push('/(app)/settlements' as never)}><Card style={styles.settlementCard}><View style={styles.settlementIcon}><Text style={styles.settlementIconText}>€</Text></View><View style={{ flex: 1 }}><Text style={styles.listName}>Arveldused</Text><Text style={styles.desc}>{settlements.length ? `Mina pean maksma ${formatEuros(iOwe)} · Mulle ${formatEuros(owedToMe)}` : 'Lisa ja vaata grupiliikmete vahelisi summasid.'}</Text></View><Text style={styles.chevron}>›</Text></Card></Pressable>
    {lists.length ? <View style={styles.grid}>{lists.map((list) => {
      const items = app.state.items.filter((item) => item.list_id === list.id); const done = items.filter((item) => item.status === 'purchased' || item.status === 'delivered').length; const delivery = app.state.deliveries.find((value) => value.list_id === list.id);
      return <Card key={list.id} style={[styles.listWrap, width < 600 && styles.listWrapNarrow]}><Pressable accessibilityRole="link" accessibilityLabel={`Ava nimekiri ${list.name}`} onPress={() => router.push(`/(app)/list/${list.id}` as never)} style={{ gap: 13, minWidth: 0 }}><View style={styles.listHead}><View style={{ flex: 1, minWidth: 0 }}><Text style={styles.listName}>{list.name}</Text>{list.description ? <Text style={styles.desc}>{list.description}</Text> : null}</View><Text style={styles.chevron}>›</Text></View><View style={styles.progressTrack}><View style={[styles.progress, { width: `${items.length ? done / items.length * 100 : 0}%` }]} /></View><Text style={styles.progressText}>{done} / {items.length} tehtud</Text>{delivery ? <View style={styles.delivery}><Text style={styles.deliveryIcon}>⚓</Text><View style={{ flex: 1, minWidth: 0 }}><Text style={styles.deliveryTitle}>{delivery.ship_name}{delivery.departure_time ? ` · ${delivery.departure_time}` : ''}</Text><Text style={styles.desc}>{delivery.departure_date.split('-').reverse().join('.')} · {delivery.handover_place}</Text></View></View> : null}</Pressable>{app.isCreator ? <Button label="Kustuta nimekiri" variant="danger" onPress={() => remove(list.id, list.name)} /> : null}</Card>;
    })}</View> : <Empty icon="☷" title="Aktiivseid nimekirju pole" body="Loo esimene nimekiri ja lisa sinna vajalikud kaubad." />}
    <Button label="Vaata arhiivi" variant="ghost" icon="□" onPress={() => router.push('/(app)/archived' as never)} />
    <Sheet visible={adding} title="Uus ostunimekiri" onClose={() => { if (!saving) { setAdding(false); setFormError(''); } }}><Field label="Nimekirja nimi" value={name} onChangeText={setName} placeholder="Näiteks Kaubad 20. augustiks" autoFocus /><Field label="Märkused" value={description} onChangeText={setDescription} placeholder="Lisa soovi korral märkused" multiline />{formError ? <Text accessibilityRole="alert" style={[styles.formError, { color: app.themeColors.danger }]}>{formError}</Text> : null}<Button label={saving ? 'Loon nimekirja…' : 'Loo nimekiri'} onPress={() => void submit()} disabled={!name.trim() || saving} /></Sheet>
  </Page>;
}
const makeStyles = (colors: ThemeColors) => StyleSheet.create({ grid: { width: '100%', minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', gap: 16 }, listWrap: { minWidth: 0, maxWidth: '100%', flexBasis: 400, flexGrow: 1, flexShrink: 1 }, listWrapNarrow: { width: '100%', flexBasis: '100%' }, listHead: { minWidth: 0, flexDirection: 'row', gap: 10 }, listName: { fontSize: 21, fontWeight: '900', color: colors.ink }, desc: { color: colors.muted, fontSize: 15, lineHeight: 21, marginTop: 4 }, chevron: { color: colors.primary, fontSize: 30 }, progressTrack: { height: 9, borderRadius: 6, backgroundColor: colors.progressTrack, overflow: 'hidden' }, progress: { height: '100%', backgroundColor: colors.primary, borderRadius: 6 }, progressText: { color: colors.muted, fontWeight: '700' }, delivery: { minWidth: 0, backgroundColor: colors.accentSoft, borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11 }, deliveryIcon: { fontSize: 22 }, deliveryTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' }, formError: { fontSize: 16, lineHeight: 22 }, settlementCard: { flexDirection: 'row', alignItems: 'center', gap: 14 }, settlementIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' }, settlementIconText: { color: colors.primaryDark, fontSize: 25, fontWeight: '900' } });
