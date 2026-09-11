import { Alert, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '@/context/AppContext';
import { ThemeColors } from '@/theme';
import { AppIcon } from './AppIcon';
import { ImageViewer } from './ImageViewer';
import { Button } from './ui';

export type SelectedPhoto = ImagePicker.ImagePickerAsset;

export function PhotoField({ value, onChange }: { value: SelectedPhoto | null; onChange: (photo: SelectedPhoto | null) => void }) {
  const app = useApp(); const styles = makeStyles(app.themeColors);
  const [imageOpen, setImageOpen] = useState(false);
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
    {value ? <Pressable accessibilityRole="button" accessibilityLabel="Ava valitud foto täisekraanil" onPress={() => setImageOpen(true)} style={styles.previewWrap}><Image source={{ uri: value.uri }} resizeMode="contain" style={styles.preview} /><View pointerEvents="none" style={styles.openHint}><Text style={styles.openHintText}>Ava pilt</Text></View></Pressable> : <View style={styles.placeholder}><AppIcon name="image" color={app.themeColors.muted} size={27} strokeWidth={1.7} /><Text style={styles.help}>Foto saad lisada kohe enne toote salvestamist.</Text></View>}
    {value ? <Button label="Ava valitud pilt" icon="▣" variant="secondary" onPress={() => setImageOpen(true)} /> : null}
    <View style={styles.actions}><View style={styles.action}><Button label="Tee foto" icon="◉" variant="secondary" onPress={() => void pick(true)} /></View><View style={styles.action}><Button label={Platform.OS === 'web' ? 'Vali fail' : 'Vali galeriist'} icon="▣" variant="secondary" onPress={() => void pick(false)} /></View></View>
    {value ? <Button label="Eemalda valitud foto" variant="ghost" onPress={() => onChange(null)} /> : null}
    <ImageViewer visible={imageOpen && Boolean(value)} source={value ? { uri: value.uri } : null} title="Valitud foto" onClose={() => setImageOpen(false)} />
  </View>;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  section: { gap: 10 }, label: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  previewWrap: { width: '100%', height: 210, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.photoSurface, borderWidth: 1, borderColor: colors.border },
  preview: { width: '100%', height: '100%' },
  openHint: { position: 'absolute', right: 10, bottom: 10, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: 'rgba(0, 0, 0, .68)' },
  openHintText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  placeholder: { minHeight: 115, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.fieldBorder, borderRadius: 10, backgroundColor: colors.subtle, alignItems: 'center', justifyContent: 'center', padding: 16, gap: 7 },
  help: { color: colors.muted, fontSize: 16, lineHeight: 23, textAlign: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, action: { flex: 1, minWidth: 180 },
});
