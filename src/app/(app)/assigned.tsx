import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '@/context/AppContext';
import { ItemCard } from '@/components/ItemCard';
import { ItemCategoryControls } from '@/components/ItemCategoryControls';
import { DeliveryFormSheet } from '@/components/DeliveryFormSheet';
import { Button, Card, Empty, Page } from '@/components/ui';
import { ThemeColors } from '@/theme';
import { Item, Profile } from '@/types/domain';
import { assignedItemsForUser } from '@/data/business';
import { AppIcon } from '@/components/AppIcon';
import { departureTime, isActiveShipment } from '@/data/departures';
import { availableCategoryNames, CategoryItemSortOrder, filterItemsByCategory, sortCategoryItems } from '@/data/itemCategories';

export default function AssignedScreen() {
  const app = useApp(); const userId = app.currentUser?.id; const styles = makeStyles(app.themeColors);
  const [deliveryListId, setDeliveryListId] = useState<string | null>(null);
  const [recentlyDeliveredOpen, setRecentlyDeliveredOpen] = useState(false);
  const [shipAssignmentOpen, setShipAssignmentOpen] = useState(false);
  const [openMemberIds, setOpenMemberIds] = useState<string[]>([]);
  const [sortOrder, setSortOrder] = useState<CategoryItemSortOrder>('category');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const allItems = assignedItemsForUser(app.state, userId);
  const items = sortCategoryItems(app.state, filterItemsByCategory(app.state, allItems, categoryFilter), sortOrder);
  const toBuy = items.filter((item) => item.status === 'assigned' || item.status === 'accepted');
  const purchased = items.filter((item) => item.status === 'purchased');
  const allPurchased = allItems.filter((item) => item.status === 'purchased');
  const recentlyDelivered = app.state.items.filter((item) => !item.deleted_at && item.assigned_to === userId && item.status === 'delivered' && !app.state.lists.find((list) => list.id === item.list_id)?.deleted_at).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const readyLists = [...new Set(allPurchased.map((item) => item.list_id))];
  const categoryNames = availableCategoryNames(app.state);
  const otherMembers = app.state.profiles.filter((profile) => profile.id !== userId && app.state.groupMembers.some((member) => member.profile_id === profile.id));
  const itemsForMember = (memberId: string) => app.state.items.filter((item) => !item.deleted_at && !app.state.lists.find((list) => list.id === item.list_id)?.deleted_at && item.assigned_to === memberId && ['assigned', 'accepted', 'purchased'].includes(item.status));
  const toggleMember = (memberId: string) => setOpenMemberIds((ids) => ids.includes(memberId) ? ids.filter((id) => id !== memberId) : [...ids, memberId]);
  const setSelectionMode = (value: boolean) => { setSelecting(value); if (!value) setSelectedIds([]); };
  const toggleSelected = (id: string) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]);
  const selectionFor = (item: Item) => selecting ? { selected: selectedIds.includes(item.id), onToggle: () => toggleSelected(item.id) } : undefined;
  const releaseAll = () => { const run = () => app.releaseAll(); if (Platform.OS === 'web') { if (window.confirm('Kas sa ei saa praegu ühtegi määratud asja võtta? Kõik ostmata asjad liiguvad jooksvasse listi.')) run(); } else Alert.alert('Kas ei saa praegu midagi võtta?', 'Kõik ostmata asjad liiguvad jooksvasse listi.', [{ text: 'Loobu', style: 'cancel' }, { text: 'Jah, vabasta kõik', style: 'destructive', onPress: run }]); };

  return <Page title="Minu asjad" subtitle="Siin on ainult sinu võetud asjad. Filtreerimine ei muuda ostetuks märkimist." action={!selecting && allItems.some((item) => item.status === 'assigned' || item.status === 'accepted') ? <Button label="Ei saa praegu midagi võtta" variant="danger" onPress={releaseAll} /> : undefined}>
    {readyLists.length ? <View style={styles.shipAssignment}><Pressable accessibilityRole="button" accessibilityState={{ expanded: shipAssignmentOpen }} onPress={() => setShipAssignmentOpen((open) => !open)} style={styles.historyHead}><View style={styles.head}><Text style={styles.title}>Laeva määramine</Text><Text style={styles.count}>{readyLists.length}</Text></View><Text style={styles.historyToggle}>{shipAssignmentOpen ? 'Peida' : 'Ava'}</Text></Pressable>{shipAssignmentOpen ? readyLists.map((listId) => {
      const list = app.state.lists.find((value) => value.id === listId); const delivery = app.state.deliveries.find((value) => value.list_id === listId && value.courier_id === userId && isActiveShipment(value));
      if (!list) return null;
      return <Card key={listId} style={styles.deliveryCard}><View style={styles.deliveryIcon}><AppIcon name="ship" color={app.themeColors.accentText} size={26} /></View><View style={styles.deliveryCopy}><Text style={styles.deliveryTitle}>Ostetud tooted on valmis</Text><Text style={styles.deliveryText}>{list.is_quick_list ? 'Jooksvast listist võetud kaubad' : list.name}</Text>{delivery ? <Text style={styles.deliveryText}>{delivery.ship_name} · {delivery.departure_date.split('-').reverse().join('.')}{delivery.departure_time ? ` kell ${departureTime(delivery.departure_time)}` : ''}</Text> : <Text style={styles.deliveryText}>Vali laev siis, kui oled valmis need kaubad teele panema.</Text>}</View><Button label={delivery ? 'Muuda laevainfot' : 'Määra laev'} variant="secondary" onPress={() => setDeliveryListId(listId)} />{delivery ? <Button label="Laevale viidud" icon="⚓" onPress={() => { void app.saveDelivery(listId, { ship_name: delivery.ship_name, departure_date: delivery.departure_date, departure_time: delivery.departure_time, port: delivery.port, handover_place: delivery.handover_place, note: delivery.note }, true); }} /> : null}</Card>;
    }) : null}</View> : null}

    {allItems.length || categoryNames.length ? <ItemCategoryControls items={allItems} filter={categoryFilter} onFilterChange={setCategoryFilter} sort={sortOrder} onSortChange={setSortOrder} selecting={selecting} selectedCount={selectedIds.length} onSelectingChange={setSelectionMode} onAssignCategory={(value) => app.assignItemsCategory(selectedIds, value)} onAddCategory={app.addSharedCategory} /> : null}

    {!allItems.length && !recentlyDelivered.length ? <Empty icon="✓" title="Kõik on korras" body="Sul pole praegu ühtegi enda võetud toodet." /> : !items.length && allItems.length ? <Empty icon="○" title="Selles kategoorias pole asju" body="Vali teine kategooria või kuva kõik asjad." /> : <>
      {toBuy.length ? <Section title="Ostmist ootavad" count={toBuy.length}>{toBuy.map((item) => <AssignedRow key={item.id} item={item} selection={selectionFor(item)} />)}</Section> : null}
      {purchased.length ? <Section title="Ostetud" count={purchased.length}>{purchased.map((item) => <ItemCard key={item.id} item={item} compact showCategory selection={selectionFor(item)} />)}</Section> : null}
      {recentlyDelivered.length ? <View style={{ gap: 11 }}><Pressable accessibilityRole="button" accessibilityState={{ expanded: recentlyDeliveredOpen }} onPress={() => setRecentlyDeliveredOpen((open) => !open)} style={styles.historyHead}><View style={styles.head}><Text style={styles.title}>Hiljuti laevale viidud</Text><Text style={styles.count}>{recentlyDelivered.length}</Text></View><Text style={styles.historyToggle}>{recentlyDeliveredOpen ? 'Peida' : 'Näita'}</Text></Pressable>{recentlyDeliveredOpen ? recentlyDelivered.map((item) => <ItemCard key={item.id} item={item} compact showCategory />) : null}</View> : null}
    </>}
    {otherMembers.length ? <View style={styles.otherAssignments}><Text style={styles.otherAssignmentsTitle}>Teistele määratud</Text>{otherMembers.map((member) => <MemberAssignments key={member.id} member={member} items={itemsForMember(member.id)} open={openMemberIds.includes(member.id)} onToggle={() => toggleMember(member.id)} />)}</View> : null}
    <DeliveryFormSheet listId={deliveryListId} onClose={() => setDeliveryListId(null)} />
  </Page>;
}

function AssignedRow({ item, selection }: { item: Item; selection?: { selected: boolean; onToggle: () => void } }) {
  const app = useApp(); const styles = makeStyles(app.themeColors);
  return <View style={styles.assignedBlock}><ItemCard item={item} compact showCategory selection={selection} />{!selection ? <View style={styles.actions}><Button label="Ostetud" icon="✓" onPress={() => { void app.outcome(item.id, 'purchased'); }} /><Button label="Ei leidnud / ei ole" icon="!" variant="danger" onPress={() => { void app.outcome(item.id, 'unavailable', 'Kasutaja märkis, et toodet ei leidnud või seda ei ole.'); }} /></View> : null}</View>;
}
function MemberAssignments({ member, items, open, onToggle }: { member: Profile; items: Item[]; open: boolean; onToggle: () => void }) {
  const app = useApp(); const styles = makeStyles(app.themeColors);
  return <View style={styles.memberBlock}><Pressable accessibilityRole="button" accessibilityLabel={`${member.display_name} ülesanded`} accessibilityState={{ expanded: open }} onPress={onToggle} style={styles.memberHead}><View style={styles.memberCopy}><View style={[styles.memberAvatar, { backgroundColor: member.avatar_color }]}><Text style={styles.memberInitial}>{member.display_name.slice(0, 1).toLocaleUpperCase('et-EE')}</Text></View><Text style={styles.memberName}>{member.display_name}</Text><Text style={styles.count}>{items.length}</Text></View><View style={open ? styles.chevronUp : undefined}><AppIcon name="chevron-down" color={app.themeColors.muted} size={20} /></View></Pressable>{open ? <View style={styles.memberItems}>{items.length ? items.map((item) => <ItemCard key={item.id} item={item} compact showCategory />) : <Text style={styles.emptyMember}>Praegu pole talle midagi määratud.</Text>}</View> : null}</View>;
}
function Section({ title, count, children }: React.PropsWithChildren<{ title: string; count: number }>) { const app = useApp(); const styles = makeStyles(app.themeColors); return <View style={{ gap: 11 }}><View style={styles.head}><Text style={styles.title}>{title}</Text><Text style={styles.count}>{count}</Text></View>{children}</View>; }
const makeStyles = (colors: ThemeColors) => StyleSheet.create({ head: { flexDirection: 'row', alignItems: 'center', gap: 9 }, title: { color: colors.ink, fontWeight: '700', fontSize: 20, letterSpacing: -.15 }, count: { backgroundColor: colors.subtle, color: colors.muted, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, overflow: 'hidden' }, historyHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 42 }, historyToggle: { color: colors.primary, fontSize: 15, fontWeight: '700' }, shipAssignment: { gap: 9 }, assignedBlock: { gap: 8 }, actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 2 }, otherAssignments: { gap: 8, paddingTop: 6 }, otherAssignmentsTitle: { color: colors.ink, fontWeight: '700', fontSize: 20, letterSpacing: -.15 }, memberBlock: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 12, overflow: 'hidden' }, memberHead: { minHeight: 58, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, memberCopy: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 }, memberAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' }, memberInitial: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 }, memberName: { flexShrink: 1, color: colors.ink, fontWeight: '700', fontSize: 16 }, chevronUp: { transform: [{ rotate: '180deg' }] }, memberItems: { gap: 8, padding: 12, paddingTop: 0, borderTopWidth: 1, borderTopColor: colors.border }, emptyMember: { color: colors.muted, fontSize: 15, lineHeight: 22 }, deliveryCard: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 13, backgroundColor: colors.accentSoft, borderColor: colors.accentBorder }, deliveryIcon: { width: 42, height: 42, borderRadius: 9, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, deliveryCopy: { flex: 1, minWidth: 210 }, deliveryTitle: { color: colors.ink, fontSize: 19, fontWeight: '700', letterSpacing: -.15 }, deliveryText: { color: colors.muted, fontSize: 15, lineHeight: 22, marginTop: 3 } });
