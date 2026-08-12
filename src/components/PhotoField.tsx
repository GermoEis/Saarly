import { Alert, Image, Platform, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '@/context/AppContext';
import { ThemeColors } from '@/theme';
import { Button } from './ui';

export type SelectedPhoto = ImagePicker.ImagePickerAsset;

export function PhotoField({ value, onChange }: { value: SelectedPhoto | null; onChange: (photo: SelectedPhoto | null) => void }) {
  const app = useApp(); const styles = makeStyles(app.themeColors);
  const pick = async (camera: boolean) => {
    try {
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: .75, base64: true };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (!result.canceled) onChange(result.assets[0]);
    } catch {
      const message = camera ? 'Kaamera avamine ebaõnnestus. Kontrolli brauseri või telefoni kaamera luba.' : 'Foto valimine ebaõnnestus.';
      if (Platform.OS === 'web') window.alert(message); else Alert.alert('Saarly', message);
    }
  };
  return <View style={styles.section}>
    <Text style={styles.label}>Foto (valikuline)</Text>
    {value ? <Image source={{ uri: value.uri }} resizeMode="cover" style={styles.preview} /> : <View style={styles.placeholder}><Text style={styles.placeholderIcon}>▧</Text><Text style={styles.help}>Foto saad lisada kohe enne toote salvestamist.</Text></View>}
    <View style={styles.actions}><View style={styles.action}><Button label="Tee foto" icon="◉" variant="secondary" onPress={() => void pick(true)} /></View><View style={styles.action}><Button label={Platform.OS === 'web' ? 'Vali fail' : 'Vali galeriist'} icon="▣" variant="secondary" onPress={() => void pick(false)} /></View></View>
    {value ? <Button label="Eemalda valitud foto" variant="ghost" onPress={() => onChange(null)} /> : null}
  </View>;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  section: { gap: 10 }, label: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  preview: { width: '100%', height: 210, borderRadius: 14, backgroundColor: colors.photoSurface },
  placeholder: { minHeight: 115, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.fieldBorder, borderRadius: 14, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 6 },
  placeholderIcon: { color: colors.ink, fontSize: 30 }, help: { color: colors.muted, fontSize: 16, lineHeight: 23, textAlign: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, action: { flex: 1, minWidth: 180 },
});
