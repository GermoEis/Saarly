import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Empty, Field, Page, Sheet } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { formatEuros, settlementTotalsByParty, settlementVisibleTo } from '@/data/settlements';
import { ThemeColors } from '@/theme';
import { Settlement, SETTLEMENT_STATUS_META } from '@/types/domain';

function showMessage(message: string) {
  if (Platform.OS === 'web') window.alert(message);
  else Alert.alert('Saarly', message);
}

export default function SettlementsScreen() {
  const app = useApp();
  const styles = makeStyles(app.themeColors);
  const userId = app.currentUser!.id;
  const [adding, setAdding] = useState(false);
  const [debtorId, setDebtorId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [listId, setListId] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  const settlements = useMemo(
    () => app.state.settlements.filter((value) => settlementVisibleTo(value, userId)),
    [app.state.settlements, userId],
  );
  const owedByMe = settlements.filter((value) => value.debtor_id === userId && ['open', 'marked_paid'].includes(value.status));
  const owedToMe = settlements.filter((value) => value.creditor_id === userId && ['open', 'marked_paid'].includes(value.status));
  const history = settlements.filter((value) => ['paid', 'cancelled'].includes(value.status));
  const partyTotals = useMemo(() => settlementTotalsByParty(settlements, userId), [settlements, userId]);
  const iOweTotal = partyTotals.iOwe.reduce((sum, value) => sum + value.amount, 0);
  const owedToMeTotal = partyTotals.owedToMe.reduce((sum, value) => sum + value.amount, 0);
  const members = app.state.groupMembers
    .filter((member) => member.profile_id !== userId)
    .map((member) => app.state.profiles.find((profile) => profile.id === member.profile_id))
    .filter((profile): profile is NonNullable<typeof profile> => Boolean(profile));
  const lists = app.state.lists.filter((list) => !list.is_quick_list && !list.archived_at);

  const closeForm = () => {
    if (saving) return;
    setAdding(false); setDebtorId(''); setAmount(''); setDescription(''); setListId(undefined); setFormError('');
  };
  const submit = async () => {
    const parsedAmount = Number(amount.trim().replace(',', '.'));
    if (!debtorId) { setFormError('Vali, kes on sulle võlgu.'); return; }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) { setFormError('Sisesta nullist suurem summa.'); return; }
    setSaving(true); setFormError('');
    try {
      await app.createSettlement({ debtor_id: debtorId, amount: parsedAmount, description: description.trim(), shopping_list_id: listId });
      closeForm();
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : 'Arvelduse lisamine ebaõnnestus.');
    } finally {
      setSaving(false);
    }
  };
  const runAction = async (id: string, action: () => Promise<void>) => {
    if (busyId) return;
    setBusyId(id);
    try { await action(); }
    catch (reason) { showMessage(reason instanceof Error ? reason.message : 'Toiming ebaõnnestus.'); }
    finally { setBusyId(null); }
  };
  const cancel = (settlement: Settlement) => {
    const run = () => void runAction(settlement.id, () => app.cancelSettlement(settlement.id));
    if (Platform.OS === 'web') { if (window.confirm('Kas tühistada see arveldus? Kirje jääb ajalukku.')) run(); }
    else Alert.alert('Tühista arveldus?', 'Kirje jääb ajalukku.', [{ text: 'Loobu', style: 'cancel' }, { text: 'Tühista', style: 'destructive', onPress: run }]);
  };

  const settlementCard = (settlement: Settlement) => {
    const isCreditor = settlement.creditor_id === userId;
    const otherId = isCreditor ? settlement.debtor_id : settlement.creditor_id;
    const otherName = app.state.profiles.find((profile) => profile.id === otherId)?.display_name ?? 'Kasutaja';
    const listName = app.state.lists.find((list) => list.id === settlement.shopping_list_id)?.name;
    const status = SETTLEMENT_STATUS_META[settlement.status];
    return <Card key={settlement.id}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.amount}>{formatEuros(settlement.amount)}</Text>
          <Text style={styles.party}>{isCreditor ? `${otherName} on sulle võlgu` : `Sina oled võlgu kasutajale ${otherName}`}</Text>
        </View>
        <View style={[styles.badge, settlement.status === 'paid' && styles.badgePaid, settlement.status === 'marked_paid' && styles.badgeWaiting, settlement.status === 'cancelled' && styles.badgeCancelled]}>
          <Text style={styles.badgeText}>{status.icon} {status.label}</Text>
        </View>
      </View>
      {settlement.description ? <Text style={styles.description}>{settlement.description}</Text> : null}
      {listName ? <Pressable accessibilityRole="link" onPress={() => router.push(`/(app)/list/${settlement.shopping_list_id}` as never)} style={styles.listLink}><Text style={styles.listLinkText}>☷ {listName} ›</Text></Pressable> : null}
      {settlement.debtor_id === userId && settlement.status === 'open' ? <Button label={busyId === settlement.id ? 'Salvestan…' : 'Märgi makstuks'} icon="✓" disabled={Boolean(busyId)} onPress={() => void runAction(settlement.id, () => app.markSettlementPaid(settlement.id))} /> : null}
      {settlement.creditor_id === userId && ['open', 'marked_paid'].includes(settlement.status) ? <Button label={busyId === settlement.id ? 'Salvestan…' : settlement.status === 'open' ? 'Märgi tasutuks' : 'Kinnita raha laekumine'} icon="✓" disabled={Boolean(busyId)} onPress={() => void runAction(settlement.id, () => app.confirmSettlementPaid(settlement.id))} /> : null}
      {settlement.creditor_id === userId && ['open', 'marked_paid'].includes(settlement.status) ? <Button label="Tühista arveldus" variant="ghost" disabled={Boolean(busyId)} onPress={() => cancel(settlement)} /> : null}
    </Card>;
  };

  const section = (title: string, items: Settlement[], emptyText: string) => <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    {items.length ? items.map(settlementCard) : <Text style={styles.emptyLine}>{emptyText}</Text>}
  </View>;

  const summaryRow = (label: string, profileId: string, total: number, count: number) => {
    const name = app.state.profiles.find((profile) => profile.id === profileId)?.display_name ?? 'Kasutaja';
    return <View key={`${label}-${profileId}`} style={styles.summaryRow}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.summaryParty}>{label} · {name}</Text>
        <Text style={styles.summaryCount}>{count} {count === 1 ? 'arveldus' : 'arveldust'}</Text>
      </View>
      <Text style={styles.summaryRowAmount}>{formatEuros(total)}</Text>
    </View>;
  };

  return <Page title="Arveldused" subtitle="Siin saad hoida grupiliikmete vahelised summad privaatselt. Kirjet näevad ainult selle kaks osapoolt." action={<Button label="Lisa arveldus" icon="+" disabled={!members.length} onPress={() => setAdding(true)} />}>
    {settlements.length ? <>
      <Card style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Kokkuvõte</Text>
        <View style={styles.summaryTotals}>
          <View style={styles.summaryStat}><Text style={styles.summaryLabel}>Kokku tasuda</Text><Text style={styles.summaryAmount}>{formatEuros(iOweTotal)}</Text></View>
          <View style={styles.summaryStat}><Text style={styles.summaryLabel}>Mulle kokku</Text><Text style={styles.summaryAmount}>{formatEuros(owedToMeTotal)}</Text></View>
        </View>
        {partyTotals.iOwe.map((value) => summaryRow('Mina pean maksma', value.profileId, value.amount, value.count))}
        {partyTotals.owedToMe.map((value) => summaryRow('Mulle võlgu', value.profileId, value.amount, value.count))}
        {!partyTotals.iOwe.length && !partyTotals.owedToMe.length ? <Text style={styles.emptyLine}>Aktiivseid arveldusi pole.</Text> : null}
      </Card>
      {section('Mina pean maksma', owedByMe, 'Sul pole maksmata arveldusi.')}
      {section('Mulle ollakse võlgu', owedToMe, 'Sulle pole maksmata arveldusi.')}
      {section('Tasutud ja tühistatud', history, 'Varasemaid arveldusi pole.')}
    </> : <Empty icon="€" title="Arveldusi pole" body={members.length ? 'Lisa esimene summa, mida teine grupiliige sulle võlgneb.' : 'Arvelduse lisamiseks peab grupis olema veel vähemalt üks liige.'} />}
    <Sheet visible={adding} title="Uus arveldus" onClose={closeForm}>
      <View style={{ gap: 8 }}><Text style={styles.label}>Kes on sulle võlgu?</Text><View style={styles.options}>{members.map((member) => <Pressable key={member.id} accessibilityRole="radio" accessibilityState={{ selected: debtorId === member.id }} onPress={() => setDebtorId(member.id)} style={[styles.option, debtorId === member.id && styles.optionActive]}><Text style={[styles.optionText, debtorId === member.id && styles.optionTextActive]}>{member.display_name}</Text></Pressable>)}</View></View>
      <Field label="Summa eurodes" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" inputMode="decimal" placeholder="Näiteks 24,50" />
      <Field label="Selgitus (valikuline)" value={description} onChangeText={setDescription} placeholder="Näiteks augusti poekaubad" maxLength={240} />
      {lists.length ? <View style={{ gap: 8 }}><Text style={styles.label}>Seotud nimekiri (valikuline)</Text><View style={styles.options}><Pressable accessibilityRole="radio" accessibilityState={{ selected: !listId }} onPress={() => setListId(undefined)} style={[styles.option, !listId && styles.optionActive]}><Text style={[styles.optionText, !listId && styles.optionTextActive]}>Ei seosta</Text></Pressable>{lists.map((list) => <Pressable key={list.id} accessibilityRole="radio" accessibilityState={{ selected: listId === list.id }} onPress={() => setListId(list.id)} style={[styles.option, listId === list.id && styles.optionActive]}><Text style={[styles.optionText, listId === list.id && styles.optionTextActive]}>{list.name}</Text></Pressable>)}</View></View> : null}
      {formError ? <Text accessibilityRole="alert" style={styles.error}>{formError}</Text> : null}
      <Button label={saving ? 'Lisan…' : 'Lisa arveldus'} disabled={saving} onPress={() => void submit()} />
    </Sheet>
  </Page>;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  summaryCard: { gap: 13 }, summaryTitle: { color: colors.ink, fontSize: 22, fontWeight: '900' }, summaryTotals: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, summaryStat: { flexGrow: 1, flexBasis: 150, minWidth: 0, borderRadius: 14, padding: 14, backgroundColor: colors.subtle }, summaryLabel: { color: colors.muted, fontSize: 14, fontWeight: '700' }, summaryAmount: { color: colors.ink, fontSize: 24, fontWeight: '900', marginTop: 4 }, summaryRow: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }, summaryParty: { color: colors.ink, fontSize: 16, lineHeight: 22, fontWeight: '800' }, summaryCount: { color: colors.muted, fontSize: 14, marginTop: 2 }, summaryRowAmount: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  section: { gap: 12 }, sectionTitle: { color: colors.ink, fontSize: 21, fontWeight: '900', marginTop: 4 }, emptyLine: { color: colors.muted, fontSize: 16, lineHeight: 23, paddingVertical: 4 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }, amount: { color: colors.ink, fontSize: 26, fontWeight: '900' }, party: { color: colors.muted, fontSize: 15, lineHeight: 21, marginTop: 3 }, description: { color: colors.ink, fontSize: 17, lineHeight: 24 },
  badge: { backgroundColor: colors.dangerSoft, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 7 }, badgePaid: { backgroundColor: colors.primarySoft }, badgeWaiting: { backgroundColor: colors.accentSoft }, badgeCancelled: { backgroundColor: colors.subtle }, badgeText: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  listLink: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }, listLinkText: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  label: { color: colors.ink, fontSize: 15, fontWeight: '700' }, options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, option: { minHeight: 46, borderRadius: 99, borderWidth: 1, borderColor: colors.fieldBorder, backgroundColor: colors.field, paddingHorizontal: 16, paddingVertical: 11, justifyContent: 'center' }, optionActive: { backgroundColor: colors.primary, borderColor: colors.primary }, optionText: { color: colors.ink, fontSize: 15, fontWeight: '800' }, optionTextActive: { color: colors.onPrimary }, error: { color: colors.danger, fontSize: 16, lineHeight: 22 },
});
