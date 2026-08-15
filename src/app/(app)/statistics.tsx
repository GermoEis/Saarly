import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, Empty, Page } from '@/components/ui';
import { useApp } from '@/context/AppContext';
import { groupStatistics } from '@/data/statistics';
import { ThemeColors } from '@/theme';

const euros = (amount: number) => new Intl.NumberFormat('et-EE', { style: 'currency', currency: 'EUR' }).format(amount);

export default function StatisticsScreen() {
  const app = useApp();
  const styles = makeStyles(app.themeColors);
  const statistics = groupStatistics(app.state);
  return <Page title="Statistika" subtitle="Lühike ülevaade selle grupi tegevusest." action={<Button label="Tagasi" icon="‹" variant="ghost" onPress={() => router.back()} />}>
    <View style={styles.overview}>
      <Card style={styles.metric}><Text style={styles.metricValue}>{statistics.completedItems}</Text><Text style={styles.metricLabel}>ostetud toodet</Text></Card>
      <Card style={styles.metric}><Text style={styles.metricValue}>{statistics.unpaidSettlements}</Text><Text style={styles.metricLabel}>tasumata arveldust</Text><Text style={styles.metricExtra}>{euros(statistics.unpaidAmount)}</Text></Card>
    </View>
    <Card>
      <Text style={styles.section}>Sagedamini ostetud</Text>
      {statistics.frequentProducts.length ? statistics.frequentProducts.map((product, index) => <View key={`${product.name}-${index}`} style={styles.row}><Text style={styles.rank}>{index + 1}</Text><Text style={styles.name}>{product.name}</Text><Text style={styles.value}>{product.purchases}×</Text></View>) : <Empty icon="○" title="Statistikat veel pole" body="See ülevaade täieneb ostude tegemisel." />}
    </Card>
    <Card>
      <Text style={styles.section}>Aktiivsed ostjad</Text>
      {statistics.activeBuyers.length ? statistics.activeBuyers.map((buyer, index) => <View key={buyer.userId} style={styles.row}><Text style={styles.rank}>{index + 1}</Text><Text style={styles.name}>{buyer.name}</Text><Text style={styles.value}>{buyer.items} toodet</Text></View>) : <Text style={styles.muted}>Ostetud tooteid pole veel kasutajatele kogunenud.</Text>}
    </Card>
    <Text style={styles.note}>Arvelduste summa sisaldab ainult neid arveldusi, mida sul on õigus näha.</Text>
  </Page>;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  overview: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  metric: { minWidth: 190, flexGrow: 1 },
  metricValue: { color: colors.primaryDark, fontSize: 30, fontWeight: '800' },
  metricLabel: { color: colors.muted, fontSize: 15 },
  metricExtra: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  section: { color: colors.ink, fontSize: 20, fontWeight: '800', marginBottom: 2 },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 11, borderTopWidth: 1, borderTopColor: colors.border },
  rank: { width: 24, color: colors.muted, fontSize: 14, fontWeight: '700' },
  name: { flex: 1, color: colors.ink, fontSize: 16, fontWeight: '700' },
  value: { color: colors.primaryDark, fontSize: 15, fontWeight: '800' },
  muted: { color: colors.muted, fontSize: 16, lineHeight: 23 },
  note: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
});
