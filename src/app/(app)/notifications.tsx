import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '@/context/AppContext';
import { profileName } from '@/data/business';
import { ThemeColors } from '@/theme';
import { Button, Card, Empty, Page } from '@/components/ui';

export default function NotificationsScreen() {
  const app = useApp(); const items = app.state.notifications.filter((value) => value.user_id === app.currentUser?.id).sort((a, b) => b.created_at.localeCompare(a.created_at)); const unread = items.filter((value) => !value.read_at).length;
  const styles = makeStyles(app.themeColors);
  return <Page title="Teavitused" subtitle={unread ? `${unread} lugemata teadet` : 'Kõik teated on loetud.'} action={unread ? <Button label="Märgi loetuks" variant="ghost" onPress={app.markAllRead} /> : undefined}>
    {items.length ? items.map((notification) => <Pressable key={notification.id} onPress={() => notification.type.startsWith('settlement_') ? router.push('/(app)/settlements' as never) : notification.list_id && router.push(`/(app)/list/${notification.list_id}` as never)}><Card style={!notification.read_at ? styles.unread : undefined}><View style={styles.row}>{!notification.read_at ? <View style={styles.dot} /> : <View style={styles.dotRead} />}<View style={{ flex: 1 }}><Text style={styles.title}>{notification.title}</Text><Text style={styles.body}>{notification.body}</Text><Text style={styles.time}>{profileName(app.state, notification.actor_id)} · {new Date(notification.created_at).toLocaleString('et-EE', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</Text></View><Text style={styles.arrow}>›</Text></View></Card></Pressable>) : <Empty icon="◉" title="Teavitusi pole" body="Olulised muudatused ja laevainfo ilmuvad siia." />}
  </Page>;
}
const makeStyles = (colors: ThemeColors) => StyleSheet.create({ unread: { borderColor: colors.unreadBorder, backgroundColor: colors.unreadSurface }, row: { flexDirection: 'row', alignItems: 'flex-start', gap: 11 }, dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger, marginTop: 7 }, dotRead: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.border, marginTop: 7 }, title: { color: colors.ink, fontSize: 17, fontWeight: '900' }, body: { color: colors.muted, fontSize: 16, lineHeight: 23, marginTop: 4 }, time: { color: colors.timestamp, fontSize: 13, marginTop: 9 }, arrow: { color: colors.primary, fontSize: 26 } });
