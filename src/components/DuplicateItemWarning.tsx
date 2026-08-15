import { StyleSheet, Text, View } from 'react-native';
import { Button, Card } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { Item } from '@/types/domain';

export function DuplicateItemWarning({ item, addition, busy, onIncrease, onAddSeparate }: { item: Item; addition: number; busy: boolean; onIncrease: () => void; onAddSeparate: () => void }) {
  const app = useApp();
  return <Card style={[styles.card, { backgroundColor: app.themeColors.primarySoft, borderColor: app.themeColors.secondaryBorder }]}>
    <Text style={[styles.title, { color: app.themeColors.ink }]}>See toode on juba nimekirjas</Text>
    <Text style={[styles.copy, { color: app.themeColors.muted }]}>„{item.name}“ kogus on praegu {item.quantity}{item.unit ? ` ${item.unit}` : ''}. Kas suurendame kogust {addition > 0 ? addition : 1} võrra?</Text>
    <View style={styles.actions}><View style={styles.action}><Button label="Suurenda kogust" icon="+" disabled={busy} onPress={onIncrease} /></View><View style={styles.action}><Button label="Lisa eraldi" variant="secondary" disabled={busy} onPress={onAddSeparate} /></View></View>
  </Card>;
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 9 },
  title: { fontSize: 17, fontWeight: '800' },
  copy: { fontSize: 15, lineHeight: 22 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { flexGrow: 1, minWidth: 150 },
});
