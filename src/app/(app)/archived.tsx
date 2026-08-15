import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { useApp } from '@/context/AppContext';
import { Button, Card, Empty, Page } from '@/components/ui';

export default function ArchivedScreen() {
  const app = useApp(); const lists = app.state.lists.filter((value) => value.archived_at && !value.deleted_at && !value.is_quick_list);
  return <Page title="Arhiiv" subtitle="Lõpetatud ostunimekirjad." action={<Button label="Prügikast" variant="ghost" onPress={() => router.push('/(app)/trash' as never)} />}>{lists.length ? lists.map((list) => <Pressable key={list.id} onPress={() => router.push(`/(app)/list/${list.id}` as never)}><Card><Text style={{ color: app.themeColors.ink, fontWeight: '700', fontSize: 19 }}>{list.name}</Text><Text style={{ color: app.themeColors.muted, fontSize: 15 }}>Arhiveeritud {new Date(list.archived_at!).toLocaleDateString('et-EE')}</Text></Card></Pressable>) : <Empty icon="□" title="Arhiiv on tühi" body="Arhiveeritud nimekirjad ilmuvad siia." />}<Button label="Ava prügikast" variant="secondary" onPress={() => router.push('/(app)/trash' as never)} /></Page>;
}
