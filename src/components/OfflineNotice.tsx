import { StyleSheet, Text, View } from 'react-native';
import { useApp } from '@/context/AppContext';

export function OfflineNotice() {
  const app = useApp();
  if (app.mode !== 'supabase' || (app.isOnline !== false && app.pendingOfflineActions === 0)) return null;
  const waiting = app.pendingOfflineActions;
  return <View pointerEvents="none" style={styles.layer}>
    <View style={[styles.notice, { backgroundColor: app.themeColors.ink, borderColor: app.themeColors.border }]}>
      <Text style={[styles.icon, { color: app.themeColors.primary }]}>↻</Text>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: app.themeColors.background }]}>{app.isOnline === false ? 'Võrguühendus puudub' : 'Sünkroonin muudatusi…'}</Text>
        <Text style={[styles.detail, { color: app.themeColors.timestamp }]}>{waiting ? `${waiting} ${waiting === 1 ? 'ostetud toode ootab' : 'ostetud toodet ootavad'} sünkroonimist.` : 'Ostetuks märkimised salvestatakse sellesse seadmesse.'}</Text>
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  layer: { position: 'absolute', top: 62, right: 10, left: 10, alignItems: 'center' },
  notice: { width: '100%', maxWidth: 600, minHeight: 56, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 11, boxShadow: '0 5px 18px rgba(0,0,0,.18)' },
  icon: { fontSize: 23, fontWeight: '800' },
  copy: { flex: 1 },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  detail: { fontSize: 13, lineHeight: 18 },
});
