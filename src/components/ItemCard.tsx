import React, { useState } from 'react';
import { Alert, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '@/context/AppContext';
import { profileName } from '@/data/business';
import { categoryNameForItem } from '@/data/itemCategories';
import { ThemeColors } from '@/theme';
import { Item } from '@/types/domain';
import { AppIcon } from './AppIcon';
import { ImageViewer } from './ImageViewer';
import { Button, Card, Field, Sheet, StatusBadge } from './ui';

export function ItemCard({ item, compact = false, showCategory = false, selection }: { item: Item; compact?: boolean; showCategory?: boolean; selection?: { selected: boolean; onToggle: () => void } }) {
  const app = useApp();
  const styles = makeStyles(app.themeColors);
  const [open, setOpen] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editQuantity, setEditQuantity] = useState(String(item.quantity));
  const [editUnit, setEditUnit] = useState(item.unit ?? '');
  const [editNote, setEditNote] = useState(item.note ?? '');
  const assigned = app.state.profiles.find((profile) => profile.id === item.assigned_to);
  const image = app.state.images.find((value) => value.item_id === item.id);
  const imageSource = image?.preview_uri === 'demo'
    ? require('../../assets/images/splash-icon.png')
    : image?.preview_uri ? { uri: image.preview_uri } : null;
  const mine = item.assigned_to === app.currentUser?.id;
  const history = app.state.activity.filter((entry) => entry.item_id === item.id).sort((a, b) => a.created_at.localeCompare(b.created_at));
  const attempts = app.state.attempts.filter((entry) => entry.item_id === item.id);
  const categoryName = categoryNameForItem(app.state, item);
  const markPurchased = async () => {
    await app.outcome(item.id, 'purchased');
  };

  const confirmDelete = () => {
    const execute = () => { app.deleteItem(item.id); setOpen(false); };
    if (Platform.OS === 'web') { if (window.confirm(`Kas liigutada toode „${item.name}“ prügikasti? Saad selle 30 päeva jooksul taastada.`)) execute(); }
    else Alert.alert('Liiguta prügikasti?', `„${item.name}“ saab 30 päeva jooksul taastada.`, [{ text: 'Loobu', style: 'cancel' }, { text: 'Prügikasti', style: 'destructive', onPress: execute }]);
  };
  const pickImage = async (camera = false) => {
    const result = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: .75, base64: true }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: .75, base64: true });
    if (!result.canceled) void app.setItemImage(item.id, result.assets[0].uri, result.assets[0].mimeType, result.assets[0].base64);
  };

  return <>
    <Pressable accessibilityRole={selection ? 'checkbox' : 'button'} accessibilityState={selection ? { checked: selection.selected } : undefined} accessibilityLabel={selection ? `Vali toode ${item.name}` : `Ava toode ${item.name}`} onPress={() => selection ? selection.onToggle() : setOpen(true)}>
      <Card style={[compact ? styles.compact : undefined, selection?.selected ? styles.selected : undefined]}>
        <View style={styles.topRow}>
          {selection ? <View style={[styles.checkbox, selection.selected && styles.checkboxSelected]}>{selection.selected ? <AppIcon name="check" color={app.themeColors.onPrimary} size={17} strokeWidth={2.5} /> : null}</View> : null}
          <View style={{ flex: 1, gap: 5 }}><Text style={styles.name}>{item.name}</Text><Text style={styles.quantity}>{item.quantity} {item.unit ?? 'tk'}</Text></View>
          {image ? <View style={styles.photoMark}><AppIcon name="image" color={app.themeColors.primaryDark} size={19} /></View> : null}
        </View>
        <View style={styles.metaRow}><StatusBadge status={item.status} />{showCategory ? <View style={styles.categoryBadge}><Text style={styles.categoryBadgeText}>{categoryName}</Text></View> : null}{assigned ? <View style={styles.assignedWrap}><AppIcon name="user" color={app.themeColors.muted} size={15} /><Text style={styles.assigned}>{assigned.display_name}</Text></View> : null}</View>
        {item.searched_before ? <Text style={styles.warning}>! Juba ühest poest otsitud{attempts.length ? ` (${attempts.length}×)` : ''}</Text> : null}
        {item.note && !compact ? <Text style={styles.note}>{item.note}</Text> : null}
      </Card>
    </Pressable>
    <Sheet visible={open} title={item.name} onClose={() => setOpen(false)}>
      <View style={styles.detailLead}><Text style={styles.bigQuantity}>{item.quantity} {item.unit ?? 'tk'}</Text><StatusBadge status={item.status} /></View>
      {item.note ? <View style={styles.infoBox}><Text style={styles.infoTitle}>Märkus</Text><Text style={styles.note}>{item.note}</Text></View> : null}
      {imageSource ? <><Pressable accessibilityRole="button" accessibilityLabel={`Ava ${item.name} foto täisekraanil`} onPress={() => setImageOpen(true)} style={styles.imageWrap}><Image source={imageSource} resizeMode="contain" style={styles.image} /><View pointerEvents="none" style={styles.openHint}><AppIcon name="image" color="#FFFFFF" size={16} /><Text style={styles.openHintText}>Ava pilt</Text></View></Pressable><Button label="Ava pilt täisekraanil" icon="▣" variant="secondary" onPress={() => setImageOpen(true)} /></> : <View style={styles.photoEmpty}><Text style={styles.photoEmptyIcon}>▧</Text><Text style={styles.note}>Fotot pole lisatud</Text></View>}
      {app.isCreator ? <View style={styles.actions}><Button label={image ? 'Asenda foto' : 'Vali foto'} icon="▣" variant="secondary" onPress={() => pickImage(false)} /><Button label="Tee foto" icon="◉" variant="secondary" onPress={() => pickImage(true)} />{image ? <Button label="Eemalda foto" variant="ghost" onPress={() => void app.removeItemImage(item.id)} /> : null}</View> : null}
      {app.isCreator ? <View style={styles.infoBox}><Text style={styles.infoTitle}>Kategooria</Text><View style={styles.chips}>{app.state.categories.filter((value) => value.list_id === item.list_id).map((category) => <Pressable key={category.id} onPress={() => app.updateItem(item.id, { category_id: category.id })} style={[styles.chip, category.id === item.category_id && styles.chipActive]}><Text style={[styles.chipText, category.id === item.category_id && styles.chipTextActive]}>{category.name}</Text></Pressable>)}</View><Text style={styles.infoTitle}>Määratud kasutaja</Text><View style={styles.chips}><Pressable onPress={() => app.updateItem(item.id, { assigned_to: undefined })} style={[styles.chip, !item.assigned_to && styles.chipActive]}><Text style={[styles.chipText, !item.assigned_to && styles.chipTextActive]}>Jooksev list</Text></Pressable>{app.state.profiles.filter((profile) => app.state.groupMembers.some((member) => member.profile_id === profile.id)).map((profile) => <Pressable key={profile.id} onPress={() => app.updateItem(item.id, { assigned_to: profile.id })} style={[styles.chip, item.assigned_to === profile.id && styles.chipActive]}><Text style={[styles.chipText, item.assigned_to === profile.id && styles.chipTextActive]}>{profile.display_name}</Text></Pressable>)}</View></View> : null}
      {app.isCreator && editing ? <View style={styles.actions}><Field label="Nimetus" value={editName} onChangeText={setEditName} /><Field label="Kogus" value={editQuantity} onChangeText={setEditQuantity} keyboardType="numeric" /><Field label="Ühik / pakend" value={editUnit} onChangeText={setEditUnit} /><Field label="Märkus" value={editNote} onChangeText={setEditNote} multiline /><Button label="Salvesta muudatused" onPress={() => { app.updateItem(item.id, { name: editName.trim() || item.name, quantity: Number(editQuantity) || 1, unit: editUnit.trim() || undefined, note: editNote.trim() || undefined }); setEditing(false); }} /><Button label="Loobu" variant="ghost" onPress={() => setEditing(false)} /></View> : app.isCreator ? <Button label="Muuda toote andmeid" variant="ghost" onPress={() => setEditing(true)} /> : null}
      {!item.assigned_to && (item.status === 'unassigned' || item.status === 'unavailable') ? <Button label="Võtan endale" icon="+" onPress={() => app.claim(item.id)} /> : null}
      {mine && (item.status === 'assigned' || item.status === 'accepted') ? <View style={styles.actions}><Button label="Ostetud" icon="✓" onPress={() => { void markPurchased(); }} /><Button label="Ei leidnud / ei ole" icon="!" variant="danger" onPress={() => { void app.outcome(item.id, 'unavailable', 'Märgitud Saarly rakenduses'); }} /></View> : null}
      <View style={{ gap: 10 }}><Text style={styles.sectionTitle}>Tegevusajalugu</Text>{history.length ? history.map((entry) => <View key={entry.id} style={styles.timeline}><View style={styles.dot} /><View style={{ flex: 1 }}><Text style={styles.timelineText}><Text style={{ fontWeight: '800' }}>{new Date(entry.created_at).toLocaleTimeString('et-EE', { hour: '2-digit', minute: '2-digit' })}</Text> – {profileName(app.state, entry.actor_id)} {entry.action.toLocaleLowerCase('et-EE')}</Text>{entry.explanation ? <Text style={styles.timelineNote}>{entry.explanation}</Text> : null}</View></View>) : <Text style={styles.note}>Tegevusi veel pole.</Text>}</View>
      {app.isCreator ? <Button label={app.mode === 'demo' ? 'Liiguta prügikasti' : 'Kustuta toode'} variant="danger" onPress={confirmDelete} /> : null}
    </Sheet>
    <ImageViewer visible={imageOpen && Boolean(imageSource)} source={imageSource} title={`${item.name} foto`} onClose={() => setImageOpen(false)} />
  </>;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  compact: { padding: 15 }, selected: { borderColor: colors.primary, backgroundColor: colors.primarySoft }, checkbox: { width: 28, height: 28, borderRadius: 7, borderWidth: 1.5, borderColor: colors.fieldBorder, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, checkboxSelected: { borderColor: colors.primary, backgroundColor: colors.primary }, topRow: { flexDirection: 'row', gap: 10, alignItems: 'center' }, name: { fontSize: 18, lineHeight: 23, fontWeight: '700', letterSpacing: -.1, color: colors.ink }, quantity: { fontSize: 15, lineHeight: 21, color: colors.muted }, metaRow: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' }, categoryBadge: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: colors.primarySoft }, categoryBadgeText: { color: colors.primaryDark, fontSize: 13, lineHeight: 17, fontWeight: '700' }, assignedWrap: { flexDirection: 'row', alignItems: 'center', gap: 5 }, assigned: { color: colors.muted, fontSize: 14, fontWeight: '600' }, warning: { color: colors.warning, fontWeight: '600', fontSize: 14 }, note: { color: colors.muted, fontSize: 16, lineHeight: 23 }, photoMark: { width: 36, height: 36, borderRadius: 8, backgroundColor: colors.subtle, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, detailLead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, bigQuantity: { fontSize: 20, fontWeight: '700', color: colors.ink }, infoBox: { backgroundColor: colors.subtle, borderWidth: 1, borderColor: colors.border, padding: 14, borderRadius: 10, gap: 9 }, infoTitle: { color: colors.ink, fontWeight: '700', fontSize: 14 }, actions: { gap: 10 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, chip: { borderWidth: 1, borderColor: colors.fieldBorder, backgroundColor: colors.field, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 8 }, chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.secondaryBorder }, chipText: { color: colors.ink, fontWeight: '600' }, chipTextActive: { color: colors.primaryDark, fontWeight: '700' }, imageWrap: { height: 220, overflow: 'hidden', borderRadius: 11, backgroundColor: colors.photoSurface, borderWidth: 1, borderColor: colors.border }, image: { width: '100%', height: '100%' }, openHint: { position: 'absolute', right: 10, bottom: 10, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: 'rgba(0, 0, 0, .68)' }, openHintText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' }, photoEmpty: { height: 120, borderRadius: 11, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.fieldBorder, backgroundColor: colors.subtle, alignItems: 'center', justifyContent: 'center', gap: 6 }, photoEmptyIcon: { color: colors.ink, fontSize: 28 }, sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.ink }, timeline: { flexDirection: 'row', gap: 10, paddingBottom: 6 }, dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 7 }, timelineText: { fontSize: 15, lineHeight: 22, color: colors.ink }, timelineNote: { color: colors.muted, marginTop: 2 },
});
