import { useState } from 'react';
import * as Linking from 'expo-linking';
import { Alert, Platform, StyleSheet, Text, View } from 'react-native';
import { useApp } from '@/context/AppContext';
import { ThemeColors } from '@/theme';
import { Button, Card, Field, Page, Sheet } from '@/components/ui';

export default function NotesScreen() {
  const app = useApp();
  const styles = makeStyles(app.themeColors);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [phone, setPhone] = useState('');
  const [url, setUrl] = useState('');
  const notes = [...app.state.notes].sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  const resetForm = () => {
    setEditingId(null); setTitle(''); setContent(''); setPhone(''); setUrl('');
  };
  const openNew = () => { resetForm(); setOpen(true); };
  const openEdit = (noteId: string) => {
    const note = app.state.notes.find((value) => value.id === noteId);
    if (!note) return;
    setEditingId(note.id); setTitle(note.title); setContent(note.content);
    setPhone(note.phone ?? ''); setUrl(note.url ?? ''); setOpen(true);
  };
  const close = () => { setOpen(false); resetForm(); };
  const submit = () => {
    if (!title.trim() || !content.trim()) return;
    const input = { title: title.trim(), content: content.trim(), phone: phone.trim() || undefined, url: url.trim() || undefined };
    if (editingId) app.updateNote(editingId, input); else app.addNote(input);
    close();
  };
  const remove = (noteId: string, noteTitle: string) => {
    const run = () => app.deleteNote(noteId);
    const message = `Märge „${noteTitle}“ kustutatakse jäädavalt.`;
    if (Platform.OS === 'web') { if (window.confirm(message)) run(); }
    else Alert.alert('Kustuta märge?', message, [{ text: 'Katkesta', style: 'cancel' }, { text: 'Kustuta', style: 'destructive', onPress: run }]);
  };

  return <Page title="Märkmed" subtitle="Püsiv info sadamate, laevade ja oluliste juhiste kohta." action={<Button label="Lisa" icon="+" onPress={openNew} />}>
    {notes.length === 0 ? <Card><Text style={styles.empty}>Märkmeid ei ole veel lisatud.</Text></Card> : null}
    {notes.map((note) => <Card key={note.id}>
      <Text style={styles.title}>{note.title}</Text>
      <Text style={styles.content}>{note.content}</Text>
      {note.phone ? <Button label={note.phone} icon="☎" variant="secondary" onPress={() => Linking.openURL(`tel:${note.phone}`)} /> : null}
      {note.url ? <Button label="Ava veebiaadress" icon="↗" variant="ghost" onPress={() => Linking.openURL(note.url!)} /> : null}
      <View style={styles.actions}>
        <View style={styles.action}><Button label="Muuda" icon="✎" variant="secondary" onPress={() => openEdit(note.id)} /></View>
        <View style={styles.action}><Button label="Kustuta" icon="×" variant="danger" onPress={() => remove(note.id, note.title)} /></View>
      </View>
    </Card>)}
    <Sheet visible={open} title={editingId ? 'Muuda märget' : 'Uus märge'} onClose={close}>
      <Field label="Pealkiri" value={title} onChangeText={setTitle} placeholder="Näiteks D-terminali info" autoFocus />
      <Field label="Sisu" value={content} onChangeText={setContent} placeholder="Kirjuta oluline info" multiline />
      <Field label="Telefoninumber (valikuline)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="+372 ..." />
      <Field label="Veebiaadress (valikuline)" value={url} onChangeText={setUrl} keyboardType="url" autoCapitalize="none" placeholder="https://..." />
      <Button label={editingId ? 'Salvesta muudatused' : 'Salvesta märge'} onPress={submit} disabled={!title.trim() || !content.trim()} />
    </Sheet>
  </Page>;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  title: { color: colors.ink, fontSize: 20, lineHeight: 26, fontWeight: '700', letterSpacing: -.15 },
  content: { color: colors.muted, fontSize: 16, lineHeight: 24 },
  empty: { color: colors.muted, fontSize: 16, lineHeight: 24, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginTop: 4, paddingTop: 3 },
  action: { flexGrow: 1, minWidth: 140 },
});
