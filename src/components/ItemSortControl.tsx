import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '@/context/AppContext';
import { ITEM_SORT_OPTIONS, ItemSortOrder } from '@/data/itemSorting';
import { ThemeColors } from '@/theme';

export function ItemSortControl({ value, onChange }: { value: ItemSortOrder; onChange: (value: ItemSortOrder) => void }) {
  const app = useApp();
  const styles = makeStyles(app.themeColors);
  return <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel="Toodete järjestus">
    <Text style={styles.label}>Sorteeri tooteid</Text>
    <View style={styles.options}>{ITEM_SORT_OPTIONS.map((option) => {
      const selected = value === option.id;
      return <Pressable
        key={option.id}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={option.label}
        onPress={() => onChange(option.id)}
        style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.pressed]}
      ><Text style={[styles.optionText, selected && styles.optionTextSelected]}>{option.label}</Text></Pressable>;
    })}</View>
  </View>;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  wrap: { gap: 9 },
  label: { color: colors.muted, fontSize: 14, lineHeight: 19, fontWeight: '600' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { minHeight: 40, justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: colors.fieldBorder, backgroundColor: colors.field, paddingHorizontal: 12, paddingVertical: 8 },
  optionSelected: { borderColor: colors.secondaryBorder, backgroundColor: colors.primarySoft },
  optionText: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  optionTextSelected: { color: colors.primaryDark, fontWeight: '700' },
  pressed: { opacity: .84 },
});
