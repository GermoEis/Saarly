import { Platform } from 'react-native';

export type WebNotificationPermission = NotificationPermission | 'unsupported';

function supported() {
  return Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

export function webNotificationPermission(): WebNotificationPermission {
  return supported() ? Notification.permission : 'unsupported';
}

export function isStandaloneWebApp() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return false;
  return window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export async function registerSaarlyServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!supported()) return null;
  try { return await navigator.serviceWorker.register('/saarly-sw.js'); }
  catch { return null; }
}

export async function requestWebNotificationPermission(): Promise<WebNotificationPermission> {
  if (!supported()) return 'unsupported';
  return Notification.requestPermission();
}

function base64UrlBytes(value: string) {
  const padding = '='.repeat((4 - value.length % 4) % 4);
  const binary = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function subscribeToWebPush(publicKey: string): Promise<PushSubscription | null> {
  if (!supported() || Notification.permission !== 'granted' || !publicKey) return null;
  const registration = await registerSaarlyServiceWorker();
  if (!registration) return null;
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlBytes(publicKey) });
}

export async function showDemoWebNotification(title: string, body: string, url = '/notifications') {
  if (!supported() || Notification.permission !== 'granted') return false;
  const registration = await registerSaarlyServiceWorker();
  if (!registration) return false;
  await registration.showNotification(title, { body, icon: '/saarly-icon-192.png', badge: '/saarly-icon-192.png', tag: `saarly-${Date.now()}`, data: { url } });
  return true;
}
