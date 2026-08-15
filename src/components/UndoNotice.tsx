import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '@/context/AppContext';

export function UndoNotice() {
  const app = useApp();
  const [seconds, setSeconds] = useState(0);
  const pending = app.pendingUndo;

  useEffect(() => {
    if (!pending) return;
    const update = () => setSeconds(Math.max(0, Math.ceil((pending.expiresAt - Date.now()) / 1000)));
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [pending]);

  if (!pending) return null;
  return <View pointerEvents="box-none" style={styles.layer}>
    <View style={[styles.notice, { backgroundColor: app.themeColors.ink, borderColor: app.themeColors.border }]}>
      <View style={styles.copy}><Text style={[styles.message, { color: app.themeColors.background }]}>{pending.message}</Text><Text style={[styles.time, { color: app.themeColors.timestamp }]}>{seconds} s</Text></View>
      <Pressable accessibilityRole="button" accessibilityLabel="Võta muudatus tagasi" onPress={app.undoLastAction} style={({ pressed }) => [styles.button, { backgroundColor: app.themeColors.primary }, pressed && styles.pressed]}><Text style={[styles.buttonText, { color: app.themeColors.onPrimary }]}>Võta tagasi</Text></Pressable>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'flex-end', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 88 },
  notice: { width: '100%', maxWidth: 600, minHeight: 64, borderWidth: 1, borderRadius: 12, padding: 10, paddingLeft: 15, flexDirection: 'row', alignItems: 'center', gap: 12, boxShadow: '0 8px 26px rgba(0,0,0,.24)' },
  copy: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  message: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: '700' },
  time: { fontSize: 13, fontWeight: '700' },
  button: { minHeight: 43, borderRadius: 8, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 14, fontWeight: '800' },
  pressed: { opacity: .78 },
});
