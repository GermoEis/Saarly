import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useApp } from '@/context/AppContext';
import { isStandaloneWebApp, showDemoWebNotification, webNotificationPermission, WebNotificationPermission } from '@/services/webPush';
import { ThemeColors } from '@/theme';
import { Button, Card } from './ui';

const permissionLabel: Record<WebNotificationPermission, string> = {
  default: 'Luba pole veel küsitud',
  granted: 'Teavitused on lubatud',
  denied: 'Teavitused on seadmes keelatud',
  unsupported: 'See brauser ei toeta veebiteavitusi',
};

export function DemoNotificationsCard() {
  const app = useApp();
  const styles = makeStyles(app.themeColors);
  const [permission, setPermission] = useState<WebNotificationPermission>(webNotificationPermission);
  const [message, setMessage] = useState('');
  const [standalone] = useState(isStandaloneWebApp);

  const requestPermission = async () => {
    setMessage('');
    try {
      const next = await app.enableWebNotifications();
      setPermission(next);
      if (next === 'denied') setMessage('Luba jäi andmata. Seda saab hiljem muuta telefoni või brauseri teavituste seadetes.');
      else if (next === 'granted') setMessage(app.mode === 'supabase' ? 'Telefoniteavitused on selles seadmes sisse lülitatud.' : 'Telefoniteavituste proovimine on lubatud.');
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : 'Telefoniteavituste lubamine ebaõnnestus.');
    }
  };
  const sendTest = async () => {
    const shown = await showDemoWebNotification('Saarly testteavitus', 'Telefoniteavitused on selles seadmes õigesti lubatud.');
    setMessage(shown ? 'Testteavitus saadeti.' : 'Testteavitust ei saanud kuvada. Kontrolli brauseri teavituste luba.');
  };

  return <Card>
    <Text style={styles.section}>Telefoniteavitused</Text>
    <Text style={styles.copy}>{app.mode === 'supabase' ? 'Luba Saarlyl teatada ka siis, kui rakendus pole parasjagu avatud.' : 'Proovi süsteemiteavituse välimust selles seadmes.'} iPhone’is lisa Saarly esmalt avakuvale ja ava seejärel Saarly ikoonist.</Text>
    <View style={styles.status}><View style={[styles.dot, permission === 'granted' && styles.dotGranted]} /><Text style={styles.statusText}>{permissionLabel[permission]}</Text></View>
    {!standalone ? <Text style={styles.hint}>iPhone: Safari → Jaga → Lisa avakuvale. Seejärel ava Saarly uuest ikoonist ja vajuta siin loa nuppu.</Text> : null}
    <View style={styles.actions}><View style={styles.action}><Button label="Luba telefoniteavitused" variant="secondary" disabled={permission === 'unsupported' || permission === 'granted'} onPress={() => void requestPermission()} /></View><View style={styles.action}><Button label="Saada testteavitus" disabled={permission !== 'granted'} onPress={() => void sendTest()} /></View></View>
    {message ? <Text accessibilityRole="alert" style={styles.message}>{message}</Text> : null}
    {app.mode === 'demo' ? <Text style={styles.footnote}>Demorežiimis saad kontrollida loa küsimist ja süsteemiteavituse välimust.</Text> : null}
  </Card>;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  section: { fontSize: 20, fontWeight: '700', color: colors.ink },
  copy: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.timestamp },
  dotGranted: { backgroundColor: colors.primary },
  statusText: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  hint: { color: colors.accentText, backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accentBorder, borderRadius: 9, padding: 11, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  action: { flexGrow: 1, minWidth: 210 },
  message: { color: colors.primaryDark, backgroundColor: colors.primarySoft, padding: 11, borderRadius: 9, fontSize: 14, lineHeight: 20, fontWeight: '700' },
  footnote: { color: colors.timestamp, fontSize: 13, lineHeight: 19 },
});
