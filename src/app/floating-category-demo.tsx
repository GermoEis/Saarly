import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { AppIcon } from '@/components/AppIcon';
import { Button, Field, Sheet } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { ThemeColors, shadowFor } from '@/theme';

type DemoSort = 'category' | 'newest' | 'az';
type DemoView = 'floating' | 'mine';
type DemoItemStatus = 'available' | 'mine' | 'purchased';
type DemoCategory = { id: string; label: string; tint: string; ink: string };
type DemoItem = {
  id: string;
  name: string;
  quantity: string;
  note?: string;
  categoryId: string;
  createdAt: number;
  status: DemoItemStatus;
  searchedBefore?: boolean;
};

const INITIAL_CATEGORIES: DemoCategory[] = [
  { id: 'food', label: 'Toidukaubad', tint: '#E8F3EC', ink: '#176B4D' },
  { id: 'pharmacy', label: 'Apteek', tint: '#EEF0FB', ink: '#514E83' },
  { id: 'home', label: 'Majapidamine', tint: '#FFF3D8', ink: '#7B5A10' },
  { id: 'other', label: 'Muu', tint: '#EFF1F0', ink: '#59615D' },
];

const INITIAL_ITEMS: DemoItem[] = [
  { id: 'milk', name: 'Piim', quantity: '3 × 1 l', note: 'Täispiim', categoryId: 'food', createdAt: 6, status: 'mine' },
  { id: 'vitamins', name: 'D-vitamiin', quantity: '1 purk', categoryId: 'pharmacy', createdAt: 5, status: 'available' },
  { id: 'coffee', name: 'Kohv', quantity: '2 pakki', note: 'Keskmine röst', categoryId: 'food', createdAt: 4, status: 'mine' },
  { id: 'paper', name: 'Majapidamispaber', quantity: '1 pakk', categoryId: 'home', createdAt: 3, status: 'available' },
  { id: 'charger', name: 'USB-C laadija', quantity: '1 tk', categoryId: 'other', createdAt: 2, status: 'available' },
  { id: 'painkiller', name: 'Ibuprofeen', quantity: '1 pakk', categoryId: 'pharmacy', createdAt: 1, status: 'available' },
];

export default function FloatingCategoryDemoScreen() {
  const app = useApp();
  const styles = makeStyles(app.themeColors, app.themeMode);
  const { width } = useWindowDimensions();
  const narrow = width < 620;
  const [items, setItems] = useState(INITIAL_ITEMS);
  const [categories, setCategories] = useState(INITIAL_CATEGORIES);
  const [view, setView] = useState<DemoView>('floating');
  const [filters, setFilters] = useState<Record<DemoView, string>>({ floating: 'all', mine: 'all' });
  const [sorts, setSorts] = useState<Record<DemoView, DemoSort>>({ floating: 'category', mine: 'category' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [noticeTarget, setNoticeTarget] = useState<DemoView | null>(null);
  const [newName, setNewName] = useState('');
  const [newQuantity, setNewQuantity] = useState('1 tk');
  const [newCategoryId, setNewCategoryId] = useState('food');

  const filter = filters[view];
  const sort = sorts[view];
  const viewItems = useMemo(() => items.filter((item) => view === 'floating' ? item.status === 'available' : item.status !== 'available'), [items, view]);
  const visibleItems = useMemo(() => {
    const filtered = filter === 'all' ? viewItems : viewItems.filter((item) => item.categoryId === filter);
    return [...filtered].sort((first, second) => {
      if (sort === 'az') return first.name.localeCompare(second.name, 'et', { sensitivity: 'base' });
      if (sort === 'newest') return second.createdAt - first.createdAt;
      const firstIndex = categories.findIndex((category) => category.id === first.categoryId);
      const secondIndex = categories.findIndex((category) => category.id === second.categoryId);
      return firstIndex - secondIndex || first.name.localeCompare(second.name, 'et', { sensitivity: 'base' });
    });
  }, [categories, filter, sort, viewItems]);

  const sections = sort === 'category'
    ? categories.map((category) => ({ category, items: visibleItems.filter((item) => item.categoryId === category.id) })).filter((section) => section.items.length)
    : [{ category: null, items: visibleItems }];
  const editingItem = items.find((item) => item.id === editingId);
  const floatingCount = items.filter((item) => item.status === 'available').length;
  const mineCount = items.filter((item) => item.status !== 'available').length;
  const setFilter = (value: string) => setFilters((current) => ({ ...current, [view]: value }));
  const setSort = (value: DemoSort) => setSorts((current) => ({ ...current, [view]: value }));
  const resetDemo = () => { setItems(INITIAL_ITEMS); setCategories(INITIAL_CATEGORIES); setView('floating'); setFilters({ floating: 'all', mine: 'all' }); setSorts({ floating: 'category', mine: 'category' }); setSelecting(false); setSelectedIds([]); setNotice(''); setNoticeTarget(null); };
  const claimItem = (item: DemoItem) => { setItems((current) => current.map((value) => value.id === item.id ? { ...value, status: 'mine' } : value)); setNotice(`„${item.name}“ liikus Minu asjadesse.`); setNoticeTarget('mine'); };
  const markUnavailable = (item: DemoItem) => { setItems((current) => current.map((value) => value.id === item.id ? { ...value, status: 'available', searchedBefore: true } : value)); setNotice(`„${item.name}“ liikus tagasi Jooksvasse listi.`); setNoticeTarget('floating'); };
  const setItemStatus = (itemId: string, status: DemoItemStatus) => setItems((current) => current.map((item) => item.id === itemId ? { ...item, status } : item));
  const toggleSelected = (itemId: string) => setSelectedIds((current) => current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]);
  const stopSelecting = () => { setSelecting(false); setSelectedIds([]); };
  const applyBulkCategory = (category: DemoCategory) => {
    setItems((current) => current.map((item) => selectedIds.includes(item.id) ? { ...item, categoryId: category.id } : item));
    setNotice(`${selectedIds.length} asja liikusid kategooriasse „${category.label}“.`); setNoticeTarget(null); setBulkCategoryOpen(false); stopSelecting();
  };
  const addCategory = () => {
    const label = newCategoryName.trim(); if (!label) return;
    const palette = [{ tint: '#FBECEF', ink: '#8A4355' }, { tint: '#E7F2F5', ink: '#276274' }, { tint: '#F2EAF8', ink: '#68417E' }];
    const colors = palette[categories.length % palette.length]; const id = `category-${Date.now()}`;
    setCategories((current) => [...current, { id, label, ...colors }]); setNewCategoryId(id); setNewCategoryName(''); setAddingCategory(false); setNotice(`Kategooria „${label}“ lisatud.`); setNoticeTarget(null);
  };
  const addItem = () => {
    if (!newName.trim()) return;
    setItems((current) => [{ id: `demo-${Date.now()}`, name: newName.trim(), quantity: newQuantity.trim() || '1 tk', categoryId: newCategoryId, createdAt: Date.now(), status: 'available' }, ...current]);
    setNewName(''); setNewQuantity('1 tk'); setNewCategoryId('food'); setAdding(false);
  };

  return <ScrollView style={styles.page} contentContainerStyle={[styles.content, narrow && styles.contentNarrow]}>
    <View style={styles.demoBar}>
      <View style={styles.demoBarCopy}><View style={styles.demoDot} /><Text style={styles.demoBarTitle}>Kategooriate demo</Text><Text style={styles.demoBarText}>Näidisandmed · midagi ei salvestata</Text></View>
      <Button label="Sulge demo" icon="×" variant="ghost" onPress={() => router.canGoBack() ? router.back() : router.replace('/' as never)} />
    </View>

    <View accessibilityRole="tablist" style={styles.viewTabs}>
      <Pressable accessibilityRole="tab" accessibilityState={{ selected: view === 'floating' }} onPress={() => { setView('floating'); setNotice(''); setNoticeTarget(null); stopSelecting(); }} style={({ pressed }) => [styles.viewTab, view === 'floating' && styles.viewTabActive, pressed && styles.pressed]}><Text style={[styles.viewTabText, view === 'floating' && styles.viewTabTextActive]}>Jooksev list</Text><Text style={[styles.viewCount, view === 'floating' && styles.viewCountActive]}>{floatingCount}</Text></Pressable>
      <Pressable accessibilityRole="tab" accessibilityState={{ selected: view === 'mine' }} onPress={() => { setView('mine'); setNotice(''); setNoticeTarget(null); stopSelecting(); }} style={({ pressed }) => [styles.viewTab, view === 'mine' && styles.viewTabActive, pressed && styles.pressed]}><Text style={[styles.viewTabText, view === 'mine' && styles.viewTabTextActive]}>Minu asjad</Text><Text style={[styles.viewCount, view === 'mine' && styles.viewCountActive]}>{mineCount}</Text></Pressable>
    </View>

    <View style={[styles.titleRow, narrow && styles.titleRowNarrow]}>
      <View style={styles.titleCopy}><Text accessibilityRole="header" style={styles.title}>{view === 'floating' ? 'Jooksev list' : 'Minu asjad'}</Text><Text style={styles.subtitle}>{view === 'floating' ? 'Siin on ainult vabad asjad. Endale võttes liigub asi sinu nimekirja.' : 'Filtreeri poes kategooria järgi ja märgi enda asjad ostetuks.'}</Text></View>
      <View style={styles.titleActions}>{viewItems.length ? <Button label={selecting ? 'Loobu valikust' : 'Vali mitu'} variant="secondary" onPress={() => selecting ? stopSelecting() : setSelecting(true)} /> : null}{view === 'floating' ? <Button label="Lisa asi" icon="+" onPress={() => setAdding(true)} /> : null}</View>
    </View>

    {notice ? <View style={styles.notice}><AppIcon name="check" color={app.themeColors.primaryDark} size={19} /><Text style={styles.noticeText}>{notice}</Text>{noticeTarget && noticeTarget !== view ? <Pressable accessibilityRole="button" onPress={() => { setView(noticeTarget); setNotice(''); setNoticeTarget(null); }}><Text style={styles.noticeLink}>{noticeTarget === 'mine' ? 'Vaata Minu asju' : 'Vaata Jooksvat listi'}</Text></Pressable> : null}</View> : null}

    <View style={styles.toolCard}>
      <View style={styles.toolSection}>
        <View style={styles.toolHeading}><Text style={styles.toolLabel}>Filtreeri kategooria järgi</Text><Pressable accessibilityRole="button" onPress={() => setAddingCategory(true)} style={({ pressed }) => [styles.addCategoryButton, pressed && styles.pressed]}><AppIcon name="plus" color={app.themeColors.primaryDark} size={16} /><Text style={styles.addCategoryText}>Uus kategooria</Text></Pressable></View>
        <View style={styles.chips}>
          <FilterChip label={`Kõik ${viewItems.length}`} selected={filter === 'all'} onPress={() => setFilter('all')} colors={app.themeColors} />
          {categories.map((category) => <FilterChip key={category.id} label={`${category.label} ${viewItems.filter((item) => item.categoryId === category.id).length}`} selected={filter === category.id} onPress={() => setFilter(category.id)} colors={app.themeColors} />)}
        </View>
      </View>
      <View style={styles.toolDivider} />
      <View style={styles.toolSection}>
        <Text style={styles.toolLabel}>Sorteeri</Text>
        <View style={styles.chips}>
          <FilterChip label="Kategooria järgi" selected={sort === 'category'} onPress={() => setSort('category')} colors={app.themeColors} />
          <FilterChip label="Uuemad ees" selected={sort === 'newest'} onPress={() => setSort('newest')} colors={app.themeColors} />
          <FilterChip label="A–Z" selected={sort === 'az'} onPress={() => setSort('az')} colors={app.themeColors} />
        </View>
      </View>
    </View>

    <View style={styles.resultRow}><Text style={styles.resultText}>{visibleItems.length} {visibleItems.length === 1 ? 'asi' : 'asja'}{view === 'mine' ? ` · ${visibleItems.filter((item) => item.status === 'purchased').length} ostetud` : ''}</Text>{filter !== 'all' ? <Pressable accessibilityRole="button" onPress={() => setFilter('all')}><Text style={styles.clearText}>Tühjenda filter</Text></Pressable> : null}</View>

    {selecting ? <View style={styles.selectionBar}><View style={styles.selectionCopy}><View style={styles.selectionIcon}><AppIcon name="check" color={app.themeColors.primaryDark} size={20} /></View><View><Text style={styles.selectionTitle}>{selectedIds.length ? `${selectedIds.length} valitud` : 'Vali kaardilt asjad'}</Text><Text style={styles.selectionHint}>Valitud asjade kategooriat saab muuta korraga.</Text></View></View><Button label="Määra kategooria" variant="secondary" onPress={() => setBulkCategoryOpen(true)} disabled={!selectedIds.length} /></View> : null}

    {sections.map((section, sectionIndex) => <View key={section.category?.id ?? 'all'} style={styles.section}>
      {section.category ? <View style={styles.sectionHead}><Text style={styles.sectionTitle}>{section.category.label}</Text><Text style={styles.count}>{section.items.length}</Text></View> : null}
      <View style={styles.grid}>{section.items.map((item) => {
        const category = (categories.find((value) => value.id === item.categoryId) ?? categories[0])!;
        const selected = selectedIds.includes(item.id);
        return <View key={item.id} style={[styles.itemCard, selected && styles.itemCardSelected, narrow && styles.itemCardNarrow]}>
          <View style={styles.itemTop}>
            {selecting ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={`Vali ${item.name}`} onPress={() => toggleSelected(item.id)} style={[styles.checkbox, selected && styles.checkboxSelected]}>{selected ? <AppIcon name="check" color={app.themeColors.onPrimary} size={17} strokeWidth={2.6} /> : null}</Pressable> : null}
            <View style={styles.itemCopy}><Text style={styles.itemName}>{item.name}</Text><Text style={styles.quantity}>{item.quantity}</Text></View>
            <DemoStatus status={item.status} colors={app.themeColors} />
          </View>
          {item.note ? <Text style={styles.note}>{item.note}</Text> : null}
          {item.searchedBefore ? <Text style={styles.warning}>! Juba ühest poest otsitud</Text> : null}
          <View style={styles.itemFooter}><Pressable accessibilityRole="button" accessibilityLabel={`Muuda toote ${item.name} kategooriat`} onPress={() => selecting ? toggleSelected(item.id) : setEditingId(item.id)} style={({ pressed }) => [styles.categoryButton, { backgroundColor: category.tint }, pressed && styles.pressed]}>
              <View style={[styles.categoryMark, { backgroundColor: category.ink }]} />
              <Text style={[styles.categoryText, { color: category.ink }]}>{category.label}</Text>
              <AppIcon name="chevron-down" color={category.ink} size={15} />
            </Pressable></View>
          {!selecting && view === 'floating' ? <Button label="Võtan endale" icon="+" variant="secondary" onPress={() => claimItem(item)} /> : null}
          {!selecting && item.status === 'mine' ? <View style={styles.shoppingActions}><Button label="Ostetud" icon="✓" onPress={() => setItemStatus(item.id, 'purchased')} /><Button label="Ei leidnud" icon="!" variant="danger" onPress={() => markUnavailable(item)} /></View> : null}
          {!selecting && item.status === 'purchased' ? <Pressable accessibilityRole="button" onPress={() => setItemStatus(item.id, 'mine')} style={({ pressed }) => [styles.undoRow, pressed && styles.pressed]}><AppIcon name="refresh" color={app.themeColors.muted} size={16} /><Text style={styles.undoText}>Muuda tulemust</Text></Pressable> : null}
        </View>;
      })}</View>
      {sectionIndex < sections.length - 1 ? <View style={styles.sectionRule} /> : null}
    </View>)}

    {!visibleItems.length ? <View style={styles.empty}><Text style={styles.emptyTitle}>{filter === 'all' ? (view === 'floating' ? 'Jooksev list on tühi' : 'Sinu nimekiri on tühi') : 'Selles kategoorias pole asju'}</Text><Text style={styles.emptyText}>{filter === 'all' ? (view === 'floating' ? 'Kõik vabad asjad on endale võetud.' : 'Võta Jooksvast listist mõni asi endale.') : 'Vali teine kategooria või tühjenda filter.'}</Text>{filter !== 'all' ? <Button label="Näita kõiki" variant="secondary" onPress={() => setFilter('all')} /> : null}</View> : null}

    <View style={styles.demoFooter}><Text style={styles.demoFooterText}>See on eraldiseisev kujundusdemo. Päris Jooksvat listi ei ole muudetud.</Text><Button label="Taasta näidis" icon="↻" variant="ghost" onPress={resetDemo} /></View>

    <Sheet visible={Boolean(editingItem)} title="Määra kategooria" onClose={() => setEditingId(null)}>
      {editingItem ? <><View style={styles.sheetItem}><Text style={styles.sheetItemName}>{editingItem.name}</Text><Text style={styles.quantity}>{editingItem.quantity}</Text></View><Text style={styles.toolLabel}>Vali kategooria</Text><View style={styles.categoryChoices}>{categories.map((category) => {
        const selected = editingItem.categoryId === category.id;
        return <Pressable key={category.id} accessibilityRole="radio" accessibilityState={{ selected }} onPress={() => { setItems((current) => current.map((item) => item.id === editingItem.id ? { ...item, categoryId: category.id } : item)); setEditingId(null); }} style={({ pressed }) => [styles.categoryChoice, selected && styles.categoryChoiceSelected, pressed && styles.pressed]}><View style={[styles.choiceIcon, { backgroundColor: category.tint }]}><View style={[styles.choiceDot, { backgroundColor: category.ink }]} /></View><Text style={styles.choiceText}>{category.label}</Text>{selected ? <AppIcon name="check" color={app.themeColors.primary} size={22} /> : null}</Pressable>;
      })}</View></> : null}
    </Sheet>

    <Sheet visible={adding} title="Lisa jooksvasse listi" onClose={() => setAdding(false)}>
      <Field label="Nimetus" value={newName} onChangeText={setNewName} placeholder="Näiteks piim" autoFocus />
      <Field label="Kogus / pakend" value={newQuantity} onChangeText={setNewQuantity} placeholder="Näiteks 2 pakki" />
      <Text style={styles.toolLabel}>Kategooria</Text>
      <View style={styles.chips}>{categories.map((category) => <FilterChip key={category.id} label={category.label} selected={newCategoryId === category.id} onPress={() => setNewCategoryId(category.id)} colors={app.themeColors} />)}</View>
      <Button label="Lisa näidisesse" onPress={addItem} disabled={!newName.trim()} />
    </Sheet>

    <Sheet visible={addingCategory} title="Uus kategooria" onClose={() => { setAddingCategory(false); setNewCategoryName(''); }}>
      <Field label="Kategooria nimi" value={newCategoryName} onChangeText={setNewCategoryName} placeholder="Näiteks Lemmikloom" autoFocus />
      <Button label="Lisa kategooria" icon="+" onPress={addCategory} disabled={!newCategoryName.trim()} />
    </Sheet>

    <Sheet visible={bulkCategoryOpen} title={`Määra ${selectedIds.length} asjale kategooria`} onClose={() => setBulkCategoryOpen(false)}>
      <Text style={styles.bulkHint}>Valik rakendub korraga kõigile märgitud asjadele.</Text>
      <View style={styles.categoryChoices}>{categories.map((category) => <Pressable key={category.id} accessibilityRole="button" onPress={() => applyBulkCategory(category)} style={({ pressed }) => [styles.categoryChoice, pressed && styles.pressed]}><View style={[styles.choiceIcon, { backgroundColor: category.tint }]}><View style={[styles.choiceDot, { backgroundColor: category.ink }]} /></View><Text style={styles.choiceText}>{category.label}</Text><AppIcon name="chevron-right" color={app.themeColors.muted} size={19} /></Pressable>)}</View>
    </Sheet>
  </ScrollView>;
}

function DemoStatus({ status, colors }: { status: DemoItemStatus; colors: ThemeColors }) {
  const meta = status === 'mine'
    ? { label: 'Minu ostunimekirjas', color: colors.gold, background: colors.subtle }
    : status === 'purchased'
      ? { label: 'Ostetud', color: colors.primary, background: colors.primarySoft }
      : { label: 'Vaba', color: colors.muted, background: colors.subtle };
  const styles = makeStatusStyles(colors);
  return <View style={[styles.badge, { backgroundColor: meta.background }]}><View style={[styles.dot, { backgroundColor: meta.color }]} /><Text style={styles.text}>{meta.label}</Text></View>;
}

function FilterChip({ label, selected, onPress, colors }: { label: string; selected: boolean; onPress: () => void; colors: ThemeColors }) {
  const styles = makeChipStyles(colors);
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}><Text style={[styles.text, selected && styles.textSelected]}>{label}</Text>{selected ? <AppIcon name="check" color={colors.primaryDark} size={15} strokeWidth={2.4} /> : null}</Pressable>;
}

const makeChipStyles = (colors: ThemeColors) => StyleSheet.create({
  chip: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.fieldBorder, backgroundColor: colors.surface, paddingHorizontal: 13, paddingVertical: 8 },
  chipSelected: { borderColor: colors.secondaryBorder, backgroundColor: colors.primarySoft },
  text: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  textSelected: { color: colors.primaryDark, fontWeight: '700' },
  pressed: { opacity: .78 },
});

const makeStatusStyles = (colors: ThemeColors) => StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 9, paddingVertical: 5 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { color: colors.ink, fontSize: 12, fontWeight: '700' },
});

const makeStyles = (colors: ThemeColors, mode: 'light' | 'dark') => StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 1040, alignSelf: 'center', padding: 26, paddingBottom: 64, gap: 20 },
  contentNarrow: { paddingHorizontal: 18, paddingTop: 16 },
  demoBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, borderWidth: 1, borderColor: colors.accentBorder, backgroundColor: colors.accentSoft, borderRadius: 12, padding: 12 },
  demoBarCopy: { flex: 1, minWidth: 230, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  demoDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accentText },
  demoBarTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  demoBarText: { color: colors.muted, fontSize: 14 },
  viewTabs: { flexDirection: 'row', gap: 5, alignSelf: 'flex-start', backgroundColor: colors.subtle, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 4 },
  viewTab: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 9, paddingHorizontal: 15, paddingVertical: 9 },
  viewTabActive: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.secondaryBorder, ...shadowFor(mode) },
  viewTabText: { color: colors.muted, fontSize: 15, fontWeight: '700' },
  viewTabTextActive: { color: colors.primaryDark },
  viewCount: { minWidth: 23, color: colors.muted, backgroundColor: colors.background, textAlign: 'center', fontSize: 12, fontWeight: '800', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10, overflow: 'hidden' },
  viewCountActive: { color: colors.onPrimary, backgroundColor: colors.primary },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 8 },
  titleRowNarrow: { alignItems: 'stretch', flexDirection: 'column' },
  titleCopy: { flex: 1 },
  titleActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  title: { color: colors.ink, fontSize: 30, lineHeight: 37, fontWeight: '700', letterSpacing: -.45 },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: 5 },
  notice: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, borderWidth: 1, borderColor: colors.secondaryBorder, backgroundColor: colors.primarySoft, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 11 },
  noticeText: { flex: 1, minWidth: 190, color: colors.ink, fontSize: 14, lineHeight: 20, fontWeight: '600' },
  noticeLink: { color: colors.primaryDark, fontSize: 14, fontWeight: '800' },
  toolCard: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 17, gap: 15, ...shadowFor(mode) },
  toolSection: { gap: 9 },
  toolHeading: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  toolLabel: { color: colors.muted, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  addCategoryButton: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: colors.primarySoft },
  addCategoryText: { color: colors.primaryDark, fontSize: 13, fontWeight: '800' },
  toolDivider: { height: 1, backgroundColor: colors.border },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  resultRow: { minHeight: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  resultText: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  clearText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  selectionBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder, borderRadius: 12, padding: 13 },
  selectionCopy: { flex: 1, minWidth: 230, flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectionIcon: { width: 36, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  selectionTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  selectionHint: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 1 },
  section: { gap: 11 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: '700', letterSpacing: -.15 },
  count: { backgroundColor: colors.subtle, color: colors.muted, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 7, overflow: 'hidden' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  itemCard: { flexGrow: 1, flexBasis: 300, minWidth: 280, maxWidth: 500, backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 16, gap: 12, ...shadowFor(mode) },
  itemCardSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  itemCardNarrow: { minWidth: '100%', maxWidth: '100%' },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkbox: { width: 28, height: 28, borderRadius: 7, borderWidth: 1.5, borderColor: colors.fieldBorder, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { borderColor: colors.primary, backgroundColor: colors.primary },
  itemCopy: { flex: 1, gap: 2 },
  itemName: { color: colors.ink, fontSize: 18, lineHeight: 23, fontWeight: '700' },
  quantity: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  note: { color: colors.muted, fontSize: 15, lineHeight: 21 },
  warning: { color: colors.warning, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  itemFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  categoryButton: { alignSelf: 'flex-start', minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 18, paddingHorizontal: 11, paddingVertical: 7 },
  categoryMark: { width: 7, height: 7, borderRadius: 4 },
  categoryText: { fontSize: 13, fontWeight: '800' },
  shoppingActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  undoRow: { minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10 },
  undoText: { color: colors.muted, fontSize: 14, fontWeight: '700' },
  pressed: { opacity: .78 },
  sectionRule: { height: 1, backgroundColor: colors.border, marginTop: 5 },
  empty: { alignItems: 'center', gap: 10, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.fieldBorder, backgroundColor: colors.surface, borderRadius: 14, padding: 34 },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '700' },
  emptyText: { color: colors.muted, fontSize: 15, textAlign: 'center' },
  demoFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginTop: 8, paddingTop: 18, borderTopWidth: 1, borderTopColor: colors.border },
  demoFooterText: { flex: 1, minWidth: 240, color: colors.muted, fontSize: 14, lineHeight: 20 },
  sheetItem: { backgroundColor: colors.subtle, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 14, gap: 2 },
  sheetItemName: { color: colors.ink, fontSize: 18, fontWeight: '700' },
  categoryChoices: { gap: 8 },
  categoryChoice: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 11, padding: 10 },
  categoryChoiceSelected: { borderColor: colors.secondaryBorder, backgroundColor: colors.primarySoft },
  choiceIcon: { width: 34, height: 34, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  choiceDot: { width: 9, height: 9, borderRadius: 5 },
  choiceText: { flex: 1, color: colors.ink, fontSize: 16, fontWeight: '700' },
  bulkHint: { color: colors.muted, fontSize: 15, lineHeight: 22 },
});
