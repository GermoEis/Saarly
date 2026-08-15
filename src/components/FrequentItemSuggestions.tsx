import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FrequentItemSuggestion } from '@/data/frequentItems';
import { useApp } from '@/context/AppContext';
import { ThemeColors } from '@/theme';
import { AppIcon } from './AppIcon';

export function FrequentItemSuggestions({ suggestions, onSelect }: { suggestions: FrequentItemSuggestion[]; onSelect: (suggestion: FrequentItemSuggestion) => void }) {
  const app = useApp();
  const styles = makeStyles(app.themeColors);
  if (!suggestions.length) return null;
  return <View style={styles.wrap}>
    <View style={styles.heading}><AppIcon name="refresh" color={app.themeColors.muted} size={17} /><Text style={styles.title}>Varem lisatud tooted</Text></View>
    <Text style={styles.help}>Valik täidab vormi. Saad nime, kogust ja muid andmeid enne lisamist muuta.</Text>
    <View style={styles.suggestions}>{suggestions.map((suggestion) => <Pressable key={suggestion.key} accessibilityRole="button" accessibilityLabel={`Kasuta toodet ${suggestion.name}`} onPress={() => onSelect(suggestion)} style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}>
      <View style={styles.copy}><Text style={styles.name}>{suggestion.name}</Text><Text style={styles.meta}>{suggestion.quantity} {suggestion.unit ?? 'tk'}{suggestion.categoryName ? ` · ${suggestion.categoryName}` : ''}{suggestion.useCount > 1 ? ` · lisatud ${suggestion.useCount}×` : ''}</Text></View>
      <AppIcon name="chevron-right" color={app.themeColors.primary} size={18} strokeWidth={2.3} />
    </Pressable>)}</View>
  </View>;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  wrap: { gap: 8, padding: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.subtle, borderRadius: 10 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  title: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  help: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  suggestions: { gap: 6 },
  suggestion: { minHeight: 48, paddingHorizontal: 11, paddingVertical: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10 },
  copy: { flex: 1 },
  name: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 13, lineHeight: 18, marginTop: 2 },
  pressed: { opacity: .78 },
});
