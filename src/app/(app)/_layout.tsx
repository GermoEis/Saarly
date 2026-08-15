import { Redirect, Tabs, router } from 'expo-router';
import { ColorValue, Pressable, Text, View } from 'react-native';
import { useApp } from '@/context/AppContext';
import { AppIcon, AppIconName } from '@/components/AppIcon';
import { Avatar, Loading } from '@/components/ui';

const tabIcon = (name: AppIconName) => {
  function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) { return <AppIcon name={name} color={String(color)} size={focused ? 24 : 23} strokeWidth={focused ? 2.35 : 2} />; }
  return TabIcon;
};

export default function AppLayout() {
  const app = useApp();
  if (!app.ready) return <Loading />;
  if (!app.currentUser || !app.isMember) return <Redirect href="/" />;
  const unread = app.state.notifications.filter((value) => value.user_id === app.currentUser?.id && !value.read_at).length;
  const colors = app.themeColors;
  const groupName = app.state.groups[0]?.name ?? 'Vali grupp';
  return <Tabs screenOptions={{ headerShown: true, headerStyle: { backgroundColor: colors.background }, headerShadowVisible: false, headerTitle: () => <Pressable accessibilityRole="button" accessibilityLabel={`Aktiivne grupp ${groupName}. Ava grupi valik.`} onPress={() => router.push('/(app)/settings' as never)} style={{ minHeight: 44, justifyContent: 'center' }}><View style={{ minHeight: 38, maxWidth: 230, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, borderRadius: 12, backgroundColor: colors.subtle, borderWidth: 1, borderColor: colors.border }}><Text numberOfLines={1} style={{ flexShrink: 1, color: colors.ink, fontSize: 16, fontWeight: '800', letterSpacing: -.2 }}>{groupName}</Text><AppIcon name="chevron-down" color={colors.primary} size={17} strokeWidth={2.4} /></View></Pressable>, headerRight: () => <Pressable accessibilityLabel="Ava kasutajad ja seaded" onPress={() => router.push('/(app)/settings' as never)} style={{ marginRight: 18, padding: 3, borderRadius: 24, borderWidth: 2, borderColor: colors.primarySoft }}><Avatar name={app.currentUser!.display_name} color={app.currentUser!.avatar_color} /></Pressable>, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.tabInactive, tabBarStyle: { height: 76, paddingTop: 8, paddingBottom: 10, backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, boxShadow: '0 -5px 20px rgba(20, 50, 36, .045)' }, tabBarItemStyle: { paddingTop: 2 }, tabBarIconStyle: { marginBottom: 1 }, tabBarLabelStyle: { fontSize: 11.5, lineHeight: 15, fontWeight: '700' } }}>
    <Tabs.Screen name="lists" options={{ title: 'Nimekirjad', tabBarIcon: tabIcon('list') }} />
    <Tabs.Screen name="assigned" options={{ title: 'Minule määratud', tabBarIcon: tabIcon('check') }} />
    <Tabs.Screen name="floating" options={{ title: 'Jooksev list', tabBarIcon: tabIcon('floating') }} />
    <Tabs.Screen name="notes" options={{ title: 'Märkmed', tabBarIcon: tabIcon('notes') }} />
    <Tabs.Screen name="notifications" options={{ title: 'Teavitused', tabBarIcon: tabIcon('bell'), tabBarBadge: unread || undefined, tabBarBadgeStyle: { backgroundColor: colors.danger, color: '#FFFFFF', fontWeight: '800', fontSize: 11 } }} />
    <Tabs.Screen name="list/[id]" options={{ href: null }} />
    <Tabs.Screen name="settings" options={{ href: null }} />
    <Tabs.Screen name="archived" options={{ href: null }} />
    <Tabs.Screen name="settlements" options={{ href: null, title: 'Arveldused' }} />
  </Tabs>;
}
