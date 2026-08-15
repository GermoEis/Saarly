import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useApp } from '@/context/AppContext';
import { Button, Card, Empty, Page } from '@/components/ui';
import { trashDaysRemaining } from '@/data/trash';
import { ThemeColors } from '@/theme';

export default function TrashScreen() {
  const app = useApp();
  const styles = makeStyles(app.themeColors);
  const lists = app.state.lists.filter((list) => list.deleted_at && !list.is_quick_list).sort((a, b) => b.deleted_at!.localeCompare(a.deleted_at!));
  const deletedListIds = new Set(lists.map((list) => list.id));
  const items = app.state.items.filter((item) => item.deleted_at && !deletedListIds.has(item.list_id)).sort((a, b) => b.deleted_at!.localeCompare(a.deleted_at!));

  return <Page title="Prügikast" subtitle="Kustutatud nimekirjad ja tooted säilivad 30 päeva." action={<Button label="Tagasi" icon="‹" variant="ghost" onPress={() => router.back()} />}>
    {!lists.length && !items.length ? <Empty icon="□" title="Prügikast on tühi" body="Kustutatud nimekirjad ja tooted ilmuvad ajutiselt siia." /> : null}
    {lists.length ? <View style={styles.section}><Text style={styles.heading}>Nimekirjad</Text>{lists.map((list) => <Card key={list.id}><View style={styles.row}><View style={styles.copy}><Text style={styles.name}>{list.name}</Text><Text style={styles.meta}>Kustutatakse lõplikult {trashDaysRemaining(list.deleted_at!)} päeva pärast · {app.state.items.filter((item) => item.list_id === list.id && !item.deleted_at).length} toodet</Text></View><Button label="Taasta" variant="secondary" onPress={() => app.restoreList(list.id)} /></View></Card>)}</View> : null}
    {items.length ? <View style={styles.section}><Text style={styles.heading}>Tooted</Text>{items.map((item) => { const list = app.state.lists.find((value) => value.id === item.list_id); return <Card key={item.id}><View style={styles.row}><View style={styles.copy}><Text style={styles.name}>{item.name}</Text><Text style={styles.meta}>{item.quantity} {item.unit ?? 'tk'}{list ? ` · ${list.name}` : ''} · kustutatakse {trashDaysRemaining(item.deleted_at!)} päeva pärast</Text></View><Button label="Taasta" variant="secondary" onPress={() => app.restoreItem(item.id)} /></View></Card>; })}</View> : null}
  </Page>;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  section: { gap: 10 },
  heading: { color: colors.ink, fontSize: 20, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  copy: { flex: 1, minWidth: 210 },
  name: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  meta: { color: colors.muted, fontSize: 14, lineHeight: 20, marginTop: 3 },
});
