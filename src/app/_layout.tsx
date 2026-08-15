import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { AppProvider, useApp } from '@/context/AppContext';
import { UndoNotice } from '@/components/UndoNotice';
import { OfflineNotice } from '@/components/OfflineNotice';
import { registerSaarlyServiceWorker } from '@/services/webPush';

export default function RootLayout() {
  return <AppProvider><ThemedRoot /></AppProvider>;
}

function ThemedRoot() {
  const app = useApp();
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      document.documentElement.style.colorScheme = app.themeMode;
      document.documentElement.style.backgroundColor = app.themeColors.background;
    }
  }, [app.themeMode, app.themeColors.background]);
  useEffect(() => { if (Platform.OS === 'web') void registerSaarlyServiceWorker(); }, []);
  return <>
    <Head>
      <title>Saarly</title>
      <meta name="theme-color" content="#176B4D" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="Saarly" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      <link rel="manifest" href="/manifest.json" />
    </Head>
    <StatusBar style={app.themeMode === 'dark' ? 'light' : 'dark'} />
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: app.themeColors.background } }} />
    <OfflineNotice />
    <UndoNotice />
  </>;
}
