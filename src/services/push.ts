import { Platform } from 'react-native';

/** Development buildis kasutatav Expo push-tokeni registreerimise struktuur. */
export async function getExpoPushToken(projectId: string): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  const Notifications = await import('expo-notifications');
  const permission = await Notifications.requestPermissionsAsync();
  if (permission.status !== 'granted') return null;
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('saarly', { name: 'Saarly teavitused', importance: Notifications.AndroidImportance.DEFAULT });
  return (await Notifications.getExpoPushTokenAsync({ projectId })).data;
}
