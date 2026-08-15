import React, { useState } from 'react';
import { Alert, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '@/context/AppContext';
import { profileName } from '@/data/business';
import { ThemeColors } from '@/theme';
import { Item } from '@/types/domain';
import { AppIcon } from './AppIcon';
import { Button, Card, Field, Sheet, StatusBadge } from './ui';

export function ItemCard({ item, compact = false }: { item: Item; compact?: boolean }) {
  const app = useApp();
  const styles = makeStyles(app.themeColors);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editQuantity, setEditQuantity] = useState(String(item.quantity));
  const [editUnit, setEditUnit] = useState(item.unit ?? '');
  const [editNote, setEditNote] = useState(item.note ?? '');
  const assigned = app.state.profiles.find((profile) => profile.id === item.assigned_to);
  const image = app.state.images.find((value) => value.item_id === item.id);
  const mine = item.assigned_to === app.currentUser?.id;
  const history = app.state.activity.filter((entry) => entry.item_id === item.id).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const attempts = app.state.attempts.filter((entry) => entry.item_id === item.id);

  const confirmDelete = () => {
    const execute = () => { app.deleteItem(item.id); setOpen(false); };
    if (Platform.OS === 'web') { if (window.confirm(`Kas kustutada toode „${item.name}“?`)) execute(); }
    else Alert.alert('Kustuta toode?', `„${item.name}“ eemaldatakse nimekirjast.`, [{ text: 'Loobu', style: 'cancel' }, { text: 'Kustuta', style: 'destructive', onPress: execute }]);
  };
  const pickImage = async (camera = false) => {
    const result = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: .75, base64: true }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: .75, base64: true });
    if (!result.canceled) void app.setItemImage(item.id, result.assets[0].uri, result.assets[0].mimeType, result.assets[0].base64);
  };

  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={`Ava toode ${item.name}`} onPress={() => setOpen(true)}>
      <Card style={compact ? styles.compact : undefined}>
        <View style={styles.topRow}>
          <View style={{ flex: 1, gap: 5 }}><Text style={styles.name}>{item.name}</Text><Text style={styles.quantity}>{item.quantity} {item.unit ?? 'tk'}</Text></View>
          {image ? <View style={styles.photoMark}><AppIcon name="image" color={app.themeColors.primaryDark} size={19} /></View> : null}
        </View>
        <View style={styles.metaRow}><StatusBadge status={item.status} />{assigned ? <View style={styles.assignedWrap}><AppIcon name="user" color={app.themeColors.muted} size={15} /><Text style={styles.assigned}>{assigned.display_name}</Text></View> : null}</View>
        {item.searched_before ? <Text style={styles.warning}>! Juba ühest poest otsitud{attempts.length ? ` (${attempts.length}×)` : ''}</Text> : null}
        {item.note && !compact ? <Text style={styles.note}>{item.note}</Text> : null}
      </Card>
    </Pressable>
    <Sheet visible={open} title={item.name} onClose={() => setOpen(false)}>
      <View style={styles.detailLead}><Text style={styles.bigQuantity}>{item.quantity} {item.unit ?? 'tk'}</Text><StatusBadge status={item.status} /></View>
      {item.note ? <View style={styles.infoBox}><Text style={styles.infoTitle}>Märkus</Text><Text style={styles.note}>{item.note}</Text></View> : null}
      {image ? <View style={styles.imageWrap}>{image.preview_uri === 'demo' ? <Image source={require('../../assets/images/splash-icon.png')} resizeMode="contain" style={styles.image} /> : <Image source={{ uri: image.preview_uri }} resizeMode="cover" style={styles.image} />}</View> : <View style={styles.photoEmpty}><Text style={styles.photoEmptyIcon}>▧</Text><Text style={styles.note}>Fotot pole lisatud</Text></View>}
      {app.isCreator ? <View style={styles.actions}><Button label={image ? 'Asenda foto' : 'Vali foto'} icon="▣" variant="secondary" onPress={() => pickImage(false)} /><Button label="Tee foto" icon="◉" variant="secondary" onPress={() => pickImage(true)} />{image ? <Button label="Eemalda foto" variant="ghost" onPress={() => void app.removeItemImage(item.id)} /> : null}</View> : null}
      {app.isCreator ? <View style={styles.infoBox}><Text style={styles.infoTitle}>Kategooria</Text><View style={styles.chips}>{app.state.categories.filter((value) => value.list_id === item.list_id).map((category) => <Pressable key={category.id} onPress={() => app.updateItem(item.id, { category_id: category.id })} style={[styles.chip, category.id === item.category_id && styles.chipActive]}><Text style={[styles.chipText, category.id === item.category_id && styles.chipTextActive]}>{category.name}</Text></Pressable>)}</View><Text style={styles.infoTitle}>Määratud kasutaja</Text><View style={styles.chips}><Pressable onPress={() => app.updateItem(item.id, { assigned_to: undefined })} style={[styles.chip, !item.assigned_to && styles.chipActive]}><Text style={[styles.chipText, !item.assigned_to && styles.chipTextActive]}>Jooksev list</Text></Pressable>{app.state.profiles.filter((profile) => app.state.groupMembers.some((member) => member.profile_id === profile.id)).map((profile) => <Pressable key={profile.id} onPress={() => app.updateItem(item.id, { assigned_to: profile.id })} style={[styles.chip, item.assigned_to === profile.id && styles.chipActive]}><Text style={[styles.chipText, item.assigned_to === profile.id && styles.chipTextActive]}>{profile.display_name}</Text></Pressable>)}</View></View> : null}
      {app.isCreator && editing ? <View style={styles.actions}><Field label="Nimetus" value={editName} onChangeText={setEditName} /><Field label="Kogus" value={editQuantity} onChangeText={setEditQuantity} keyboardType="numeric" /><Field label="Ühik / pakend" value={editUnit} onChangeText={setEditUnit} /><Field label="Märkus" value={editNote} onChangeText={setEditNote} multiline /><Button label="Salvesta muudatused" onPress={() => { app.updateItem(item.id, { name: editName.trim() || item.name, quantity: Number(editQuantity) || 1, unit: editUnit.trim() || undefined, note: editNote.trim() || undefined }); setEditing(false); }} /><Button label="Loobu" variant="ghost" onPress={() => setEditing(false)} /></View> : app.isCreator ? <Button label="Muuda toote andmeid" variant="ghost" onPress={() => setEditing(true)} /> : null}
      {!item.assigned_to && (item.status === 'unassigned' || item.status === 'unavailable') ? <Button label="Võtan endale" icon="+" onPress={() => app.claim(item.id)} /> : null}
      {mine && (item.status === 'assigned' || item.status === 'accepted') ? <View style={styles.actions}><Button label="Ostetud" icon="✓" onPress={() => app.outcome(item.id, 'purchased')} /><Button label="Ei leidnud / ei ole" icon="!" variant="danger" onPress={() => app.outcome(item.id, 'unavailable', 'Märgitud Saarly rakenduses')} /></View> : null}
      <View style={{ gap: 10 }}><Text style={styles.sectionTitle}>Tegevusajalugu</Text>{history.length ? history.map((entry) => <View key={entry.id} style={styles.timeline}><View style={styles.dot} /><View style={{ flex: 1 }}><Text style={styles.timelineText}><Text style={{ fontWeight: '800' }}>{new Date(entry.created_at).toLocaleTimeString('et-EE', { hour: '2-digit', minute: '2-digit' })}</Text> – {profileName(app.state, entry.actor_id)} {entry.action.toLocaleLowerCase('et-EE')}</Text>{entry.explanation ? <Text style={styles.timelineNote}>{entry.explanation}</Text> : null}</View></View>) : <Text style={styles.note}>Tegevusi veel pole.</Text>}</View>
      {app.isCreator ? <Button label="Kustuta toode" variant="danger" onPress={confirmDelete} /> : null}
    </Sheet>
  </>;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  compact: { padding: 16 }, topRow: { flexDirection: 'row', gap: 10, alignItems: 'center' }, name: { fontSize: 18, lineHeight: 23, fontWeight: '800', letterSpacing: -.2, color: colors.ink }, quantity: { fontSize: 15, lineHeight: 21, color: colors.muted }, metaRow: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' }, assignedWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 }, assigned: { color: colors.muted, fontSize: 14, fontWeight: '700' }, warning: { color: colors.warning, backgroundColor: colors.dangerSoft, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontWeight: '800', fontSize: 14 }, note: { color: colors.muted, fontSize: 16, lineHeight: 23 }, photoMark: { width: 38, height: 38, borderRadius: 11, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.secondaryBorder, alignItems: 'center', justifyContent: 'center' }, detailLead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, bigQuantity: { fontSize: 20, fontWeight: '800', color: colors.ink }, infoBox: { backgroundColor: colors.subtle, borderWidth: 1, borderColor: colors.border, padding: 15, borderRadius: 14, gap: 9 }, infoTitle: { color: colors.ink, fontWeight: '800', fontSize: 14 }, actions: { gap: 10 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { borderWidth: 1, borderColor: colors.fieldBorder, backgroundColor: colors.field, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 9 }, chipActive: { backgroundColor: colors.primary, borderColor: colors.primary }, chipText: { color: colors.ink, fontWeight: '700' }, chipTextActive: { color: colors.onPrimary }, imageWrap: { height: 220, overflow: 'hidden', borderRadius: 16, backgroundColor: colors.photoSurface }, image: { width: '100%', height: '100%' }, photoEmpty: { height: 120, borderRadius: 16, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.fieldBorder, backgroundColor: colors.subtle, alignItems: 'center', justifyContent: 'center', gap: 6 }, photoEmptyIcon: { color: colors.ink, fontSize: 28 }, sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.ink }, timeline: { flexDirection: 'row', gap: 10, paddingBottom: 6 }, dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary, marginTop: 7 }, timelineText: { fontSize: 15, lineHeight: 22, color: colors.ink }, timelineNote: { color: colors.muted, marginTop: 2 },
});
