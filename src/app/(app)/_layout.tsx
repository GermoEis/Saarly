import { Redirect, Tabs, router } from 'expo-router';
import { ColorValue, Pressable, Text } from 'react-native';
import { useApp } from '@/context/AppContext';
import { Avatar, Loading } from '@/components/ui';

const tabIcon = (symbol: string) => {
  function TabIcon({ color }: { color: ColorValue }) { return <Text style={{ color, fontSize: 22 }}>{symbol}</Text>; }
  return TabIcon;
};

export default function AppLayout() {
  const app = useApp();
  if (!app.ready) return <Loading />;
  if (!app.currentUser || !app.isMember) return <Redirect href="/" />;
  const unread = app.state.notifications.filter((value) => value.user_id === app.currentUser?.id && !value.read_at).length;
  const colors = app.themeColors;
  const groupName = app.state.groups[0]?.name ?? 'Vali grupp';
  return <Tabs screenOptions={{ headerShown: true, headerStyle: { backgroundColor: colors.background }, headerShadowVisible: false, headerTitle: () => <Pressable accessibilityRole="button" accessibilityLabel={`Aktiivne grupp ${groupName}. Ava grupi valik.`} onPress={() => router.push('/(app)/settings' as never)} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 8 }}><Text numberOfLines={1} style={{ color: colors.ink, fontSize: 17, fontWeight: '900' }}>{groupName}⌄</Text></Pressable>, headerRight: () => <Pressable accessibilityLabel="Ava kasutajad ja seaded" onPress={() => router.push('/(app)/settings' as never)} style={{ marginRight: 18 }}><Avatar name={app.currentUser!.display_name} color={app.currentUser!.avatar_color} /></Pressable>, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.tabInactive, tabBarStyle: { height: 72, paddingTop: 7, paddingBottom: 9, backgroundColor: colors.surface, borderTopColor: colors.border }, tabBarLabelStyle: { fontSize: 12, fontWeight: '700' } }}>
    <Tabs.Screen name="lists" options={{ title: 'Nimekirjad', tabBarIcon: tabIcon('☷') }} />
    <Tabs.Screen name="assigned" options={{ title: 'Minule määratud', tabBarIcon: tabIcon('✓') }} />
    <Tabs.Screen name="floating" options={{ title: 'Jooksev list', tabBarIcon: tabIcon('○') }} />
    <Tabs.Screen name="notes" options={{ title: 'Märkmed', tabBarIcon: tabIcon('▤') }} />
    <Tabs.Screen name="notifications" options={{ title: 'Teavitused', tabBarIcon: tabIcon('◉'), tabBarBadge: unread || undefined, tabBarBadgeStyle: { backgroundColor: colors.danger } }} />
    <Tabs.Screen name="list/[id]" options={{ href: null }} />
    <Tabs.Screen name="settings" options={{ href: null }} />
    <Tabs.Screen name="archived" options={{ href: null }} />
    <Tabs.Screen name="settlements" options={{ href: null, title: 'Arveldused' }} />
  </Tabs>;
}
