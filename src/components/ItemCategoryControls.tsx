import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '@/context/AppContext';
import { availableCategoryNames, categoryNameForItem, CategoryItemSortOrder, normalizeCategoryName } from '@/data/itemCategories';
import { ThemeColors } from '@/theme';
import { Item } from '@/types/domain';
import { AppIcon } from './AppIcon';
import { Button, Field, Sheet } from './ui';

const SORT_OPTIONS: { id: CategoryItemSortOrder; label: string }[] = [
  { id: 'category', label: 'Kategooria järgi' },
  { id: 'newest', label: 'Uuemad ees' },
  { id: 'oldest', label: 'Vanemad ees' },
  { id: 'az', label: 'A–Z' },
  { id: 'za', label: 'Z–A' },
];

export function ItemCategoryControls({ items, filter, onFilterChange, sort, onSortChange, selecting, selectedCount, onSelectingChange, onAssignCategory, onAddCategory }: {
  items: Item[];
  filter: string | null;
  onFilterChange: (value: string | null) => void;
  sort: CategoryItemSortOrder;
  onSortChange: (value: CategoryItemSortOrder) => void;
  selecting: boolean;
  selectedCount: number;
  onSelectingChange: (value: boolean) => void;
  onAssignCategory: (categoryName: string) => Promise<boolean>;
  onAddCategory: (categoryName: string) => Promise<boolean>;
}) {
  const app = useApp(); const styles = makeStyles(app.themeColors);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [newCategoryOpen, setNewCategoryOpen] = useState(false);
  const [manageCategoriesOpen, setManageCategoriesOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [saving, setSaving] = useState(false);
  const categoryNames = availableCategoryNames(app.state);
  const counts = useMemo(() => {
    const result = new Map<string, number>();
    items.forEach((item) => { const name = categoryNameForItem(app.state, item); const key = normalizeCategoryName(name); result.set(key, (result.get(key) ?? 0) + 1); });
    return result;
  }, [app.state, items]);
  const assign = async (name: string) => { setSaving(true); const saved = await onAssignCategory(name); setSaving(false); if (saved) { setCategorySheetOpen(false); onSelectingChange(false); } };
  const add = async () => { if (!newCategoryName.trim()) return; setSaving(true); const saved = await onAddCategory(newCategoryName.trim()); setSaving(false); if (saved) { setNewCategoryName(''); setNewCategoryOpen(false); } };
  const remove = (name: string) => {
    const run = async () => {
      setSaving(true);
      const deleted = await app.deleteSharedCategory(name);
      setSaving(false);
      if (deleted && filter && normalizeCategoryName(filter) === normalizeCategoryName(name)) onFilterChange(null);
    };
    const message = `Kategooria „${name}“ eemaldatakse kõigist nimekirjadest. Selle tooted liiguvad kategooriasse „Üldine“.`;
    if (Platform.OS === 'web') { if (window.confirm(message)) void run(); }
    else Alert.alert('Kustuta kategooria?', message, [{ text: 'Loobu', style: 'cancel' }, { text: 'Kustuta', style: 'destructive', onPress: () => void run() }]);
  };

  return <>
    <View style={styles.card}>
      <View style={styles.heading}><Text style={styles.label}>Filtreeri kategooria järgi</Text><View style={styles.headingActions}><Pressable accessibilityRole="button" onPress={() => setManageCategoriesOpen(true)} style={({ pressed }) => [styles.manageButton, pressed && styles.pressed]}><Text style={styles.manageText}>Halda</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setNewCategoryOpen(true)} style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}><AppIcon name="plus" color={app.themeColors.primaryDark} size={16} /><Text style={styles.addText}>Uus kategooria</Text></Pressable></View></View>
      <View style={styles.chips}><Chip label={`Kõik ${items.length}`} selected={!filter} onPress={() => onFilterChange(null)} colors={app.themeColors} />{categoryNames.map((name) => <Chip key={normalizeCategoryName(name)} label={`${name} ${counts.get(normalizeCategoryName(name)) ?? 0}`} selected={Boolean(filter && normalizeCategoryName(filter) === normalizeCategoryName(name))} onPress={() => onFilterChange(name)} colors={app.themeColors} />)}</View>
      <View style={styles.divider} />
      <Text style={styles.label}>Sorteeri</Text>
      <View style={styles.chips}>{SORT_OPTIONS.map((option) => <Chip key={option.id} label={option.label} selected={sort === option.id} onPress={() => onSortChange(option.id)} colors={app.themeColors} />)}</View>
      <View style={styles.divider} />
      <View style={styles.selectionRow}><View style={{ flex: 1 }}><Text style={styles.selectionTitle}>{selecting ? selectedCount ? `${selectedCount} asja valitud` : 'Vali kaardilt asjad' : 'Muuda mitut asja korraga'}</Text><Text style={styles.selectionHint}>{selecting ? 'Märgitud asjadele saab määrata ühise kategooria.' : 'Kasulik, kui mitu asja kuuluvad samasse kategooriasse.'}</Text></View><Button label={selecting ? 'Loobu' : 'Vali mitu'} variant="secondary" onPress={() => onSelectingChange(!selecting)} />{selecting ? <Button label="Määra kategooria" onPress={() => setCategorySheetOpen(true)} disabled={!selectedCount || saving} /> : null}</View>
    </View>

    <Sheet visible={newCategoryOpen} title="Uus kategooria" onClose={() => { if (!saving) { setNewCategoryOpen(false); setNewCategoryName(''); } }}><Field label="Kategooria nimi" value={newCategoryName} onChangeText={setNewCategoryName} placeholder="Näiteks Lemmikloom" autoFocus /><Button label={saving ? 'Lisan…' : 'Lisa kategooria'} icon="+" onPress={() => void add()} disabled={saving || !newCategoryName.trim()} /></Sheet>
    <Sheet visible={manageCategoriesOpen} title="Halda kategooriaid" onClose={() => { if (!saving) setManageCategoriesOpen(false); }}><Text style={styles.sheetHint}>Kustutatud kategooria tooted liiguvad automaatselt kategooriasse „Üldine“.</Text><View style={styles.choices}>{categoryNames.map((name) => { const isDefault = normalizeCategoryName(name) === normalizeCategoryName('Üldine'); return <View key={normalizeCategoryName(name)} style={styles.manageRow}><View style={{ flex: 1 }}><Text style={styles.choiceText}>{name}</Text><Text style={styles.categoryMeta}>{isDefault ? 'Vaikekategooria' : `${counts.get(normalizeCategoryName(name)) ?? 0} asja selles vaates`}</Text></View>{isDefault ? null : <Button label="Kustuta" variant="danger" onPress={() => remove(name)} disabled={saving} />}</View>; })}</View></Sheet>
    <Sheet visible={categorySheetOpen} title={`Määra ${selectedCount} asjale kategooria`} onClose={() => { if (!saving) setCategorySheetOpen(false); }}><Text style={styles.sheetHint}>Valik rakendub korraga kõigile märgitud asjadele.</Text><View style={styles.choices}>{categoryNames.map((name) => <Pressable key={normalizeCategoryName(name)} accessibilityRole="button" onPress={() => void assign(name)} style={({ pressed }) => [styles.choice, pressed && styles.pressed]}><View style={styles.choiceMark} /><Text style={styles.choiceText}>{name}</Text><AppIcon name="chevron-right" color={app.themeColors.muted} size={18} /></Pressable>)}</View></Sheet>
  </>;
}

function Chip({ label, selected, onPress, colors }: { label: string; selected: boolean; onPress: () => void; colors: ThemeColors }) {
  const styles = makeStyles(colors);
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>{selected ? <AppIcon name="check" color={colors.primaryDark} size={15} strokeWidth={2.4} /> : null}</Pressable>;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 17, gap: 11 },
  heading: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  headingActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 7 },
  label: { color: colors.muted, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  addButton: { minHeight: 34, flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: colors.primarySoft },
  addText: { color: colors.primaryDark, fontSize: 13, fontWeight: '800' },
  manageButton: { minHeight: 34, justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.surface },
  manageText: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, borderWidth: 1, borderColor: colors.fieldBorder, backgroundColor: colors.surface, paddingHorizontal: 13, paddingVertical: 8 },
  chipSelected: { borderColor: colors.secondaryBorder, backgroundColor: colors.primarySoft },
  chipText: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  chipTextSelected: { color: colors.primaryDark, fontWeight: '700' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 3 },
  selectionRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 9 },
  selectionTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  selectionHint: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  sheetHint: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  choices: { gap: 8 },
  choice: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 9 },
  choiceMark: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  choiceText: { flex: 1, color: colors.ink, fontSize: 16, fontWeight: '700' },
  manageRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 10, paddingHorizontal: 13, paddingVertical: 9 },
  categoryMeta: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  pressed: { opacity: .8 },
});
