import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '@/context/AppContext';
import { ItemCard } from '@/components/ItemCard';
import { ItemCategoryControls } from '@/components/ItemCategoryControls';
import { PhotoField, SelectedPhoto } from '@/components/PhotoField';
import { Button, Empty, Field, Page, Sheet } from '@/components/ui';
import { availableCategoryNames, CategoryItemSortOrder, filterItemsByCategory, normalizeCategoryName, sortCategoryItems } from '@/data/itemCategories';
import { FrequentItemSuggestions } from '@/components/FrequentItemSuggestions';
import { frequentItemSuggestions } from '@/data/frequentItems';
import { DuplicateItemWarning } from '@/components/DuplicateItemWarning';
import { findFloatingDuplicate } from '@/data/duplicates';
import { ThemeColors } from '@/theme';

export default function FloatingScreen() {
  const app = useApp(); const styles = makeStyles(app.themeColors);
  const [sortOrder, setSortOrder] = useState<CategoryItemSortOrder>('category');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const allItems = app.state.items.filter((item) => !item.deleted_at && !item.assigned_to && item.status === 'unassigned' && !app.state.lists.find((list) => list.id === item.list_id)?.archived_at && !app.state.lists.find((list) => list.id === item.list_id)?.deleted_at);
  const items = sortCategoryItems(app.state, filterItemsByCategory(app.state, allItems, categoryFilter), sortOrder);
  const categoryNames = availableCategoryNames(app.state);
  const [adding, setAdding] = useState(false); const [name, setName] = useState(''); const [quantity, setQuantity] = useState('1'); const [unit, setUnit] = useState(''); const [note, setNote] = useState(''); const [categoryName, setCategoryName] = useState(''); const [photo, setPhoto] = useState<SelectedPhoto | null>(null); const [saving, setSaving] = useState(false);
  const suggestions = useMemo(() => name.trim() ? frequentItemSuggestions(app.state, name) : [], [app.state, name]);
  const duplicateItem = useMemo(() => findFloatingDuplicate(app.state, name), [app.state, name]);
  const reset = () => { setName(''); setQuantity('1'); setUnit(''); setNote(''); setCategoryName(''); setPhoto(null); };
  const setSelectionMode = (value: boolean) => { setSelecting(value); if (!value) setSelectedIds([]); };
  const toggleSelected = (id: string) => setSelectedIds((ids) => ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id]);
  const openAdding = () => { setCategoryName(categoryNames[0] ?? ''); setAdding(true); };
  const submit = async (addSeparate = false) => { if (!name.trim() || saving || (duplicateItem && !addSeparate)) return; setSaving(true); const saved = await app.addQuickItem({ name: name.trim(), quantity: Number(quantity) || 1, unit: unit.trim() || undefined, note: note.trim() || undefined, category_name: categoryName || undefined }, photo ? { uri: photo.uri, mimeType: photo.mimeType, base64: photo.base64 } : undefined); setSaving(false); if (saved) { reset(); setAdding(false); } };
  const increaseDuplicate = async () => { if (!duplicateItem || saving) return; setSaving(true); const saved = await app.increaseItemQuantity(duplicateItem.id, Number(quantity) || 1); setSaving(false); if (saved) { reset(); setAdding(false); } };

  return <Page title="Jooksev list" subtitle={app.isCreator ? 'Siin on ainult vabad asjad. Võetud asjad liiguvad kasutaja enda nimekirja.' : 'Siin on ainult vabad asjad. Võta need, mille saad ära tuua.'} action={app.isCreator ? <Button label="Lisa asi" icon="+" onPress={openAdding} /> : undefined}>
    {allItems.length || categoryNames.length ? <ItemCategoryControls items={allItems} filter={categoryFilter} onFilterChange={setCategoryFilter} sort={sortOrder} onSortChange={setSortOrder} selecting={selecting} selectedCount={selectedIds.length} onSelectingChange={setSelectionMode} onAssignCategory={(value) => app.assignItemsCategory(selectedIds, value)} onAddCategory={app.addSharedCategory} /> : null}
    {items.length ? items.map((item) => <ItemCard key={item.id} item={item} showCategory selection={selecting ? { selected: selectedIds.includes(item.id), onToggle: () => toggleSelected(item.id) } : undefined} />) : <Empty icon="○" title={allItems.length ? 'Selles kategoorias pole asju' : 'Jooksev list on tühi'} body={allItems.length ? 'Vali teine kategooria või kuva kõik asjad.' : app.isCreator ? 'Lisa siia esimene asi või jäta mõne nimekirja toode määramata.' : 'Kõik tooted on juba kellegi käes või tehtud.'} />}
    <Sheet visible={adding} title="Lisa jooksvasse listi" onClose={() => { if (!saving) { setAdding(false); reset(); } }}>
      <Field label="Nimetus" value={name} onChangeText={setName} placeholder="Näiteks piim" autoFocus />
      <FrequentItemSuggestions suggestions={suggestions} onSelect={(suggestion) => { setName(suggestion.name); setQuantity(String(suggestion.quantity)); setUnit(suggestion.unit ?? ''); setNote(suggestion.note ?? ''); if (suggestion.categoryName) setCategoryName(suggestion.categoryName); }} />
      <View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Field label="Kogus" value={quantity} onChangeText={setQuantity} keyboardType="numeric" /></View><View style={{ flex: 2 }}><Field label="Ühik või pakend" value={unit} onChangeText={setUnit} placeholder="tk, 1 l, pakk" /></View></View>
      <View style={styles.categoryField}><Text style={styles.categoryLabel}>Kategooria</Text><View style={styles.categoryChoices}>{categoryNames.map((value) => { const active = normalizeCategoryName(value) === normalizeCategoryName(categoryName); return <Pressable key={normalizeCategoryName(value)} accessibilityRole="radio" accessibilityState={{ selected: active }} onPress={() => setCategoryName(value)} style={[styles.categoryChoice, active && styles.categoryChoiceActive]}><Text style={[styles.categoryChoiceText, active && styles.categoryChoiceTextActive]}>{value}</Text></Pressable>; })}</View></View>
      <Field label="Märkus" value={note} onChangeText={setNote} placeholder="Valikuline täpsustus" multiline />
      <PhotoField value={photo} onChange={setPhoto} />
      {duplicateItem ? <DuplicateItemWarning item={duplicateItem} addition={Number(quantity) || 1} busy={saving} onIncrease={() => void increaseDuplicate()} onAddSeparate={() => void submit(true)} /> : <Button label={saving ? 'Lisan…' : 'Lisa jooksvasse listi'} onPress={() => void submit()} disabled={!name.trim() || saving} />}
    </Sheet>
  </Page>;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  categoryField: { gap: 8 }, categoryLabel: { color: colors.ink, fontSize: 15, fontWeight: '700' }, categoryChoices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, categoryChoice: { borderWidth: 1, borderColor: colors.fieldBorder, backgroundColor: colors.field, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9 }, categoryChoiceActive: { borderColor: colors.secondaryBorder, backgroundColor: colors.primarySoft }, categoryChoiceText: { color: colors.ink, fontSize: 14, fontWeight: '600' }, categoryChoiceTextActive: { color: colors.primaryDark, fontWeight: '800' },
});
