import { useState } from 'react';
import { View } from 'react-native';
import { useApp } from '@/context/AppContext';
import { ItemCard } from '@/components/ItemCard';
import { PhotoField, SelectedPhoto } from '@/components/PhotoField';
import { Button, Empty, Field, Page, Sheet } from '@/components/ui';

export default function FloatingScreen() {
  const app = useApp(); const items = app.state.items.filter((item) => !item.assigned_to && item.status === 'unassigned' && !app.state.lists.find((list) => list.id === item.list_id)?.archived_at);
  const [adding, setAdding] = useState(false); const [name, setName] = useState(''); const [quantity, setQuantity] = useState('1'); const [unit, setUnit] = useState(''); const [note, setNote] = useState(''); const [photo, setPhoto] = useState<SelectedPhoto | null>(null); const [saving, setSaving] = useState(false);
  const reset = () => { setName(''); setQuantity('1'); setUnit(''); setNote(''); setPhoto(null); };
  const submit = async () => { if (!name.trim() || saving) return; setSaving(true); const saved = await app.addQuickItem({ name: name.trim(), quantity: Number(quantity) || 1, unit: unit.trim() || undefined, note: note.trim() || undefined }, photo ? { uri: photo.uri, mimeType: photo.mimeType, base64: photo.base64 } : undefined); setSaving(false); if (saved) { reset(); setAdding(false); } };
  return <Page title="Jooksev list" subtitle={app.isCreator ? 'Lisa siia kaupu ka ilma eraldi nimekirja tegemata.' : 'Vali vabade toodete seast see, mille saad ära tuua.'} action={app.isCreator ? <Button label="Lisa asi" icon="+" onPress={() => setAdding(true)} /> : undefined}>
    {items.length ? items.map((item) => <ItemCard key={item.id} item={item} />) : <Empty icon="○" title="Jooksev list on tühi" body={app.isCreator ? 'Lisa siia esimene asi või jäta mõne nimekirja toode määramata.' : 'Kõik tooted on juba kellegi käes või tehtud.'} />}
    <Sheet visible={adding} title="Lisa jooksvasse listi" onClose={() => { if (!saving) { setAdding(false); reset(); } }}><Field label="Nimetus" value={name} onChangeText={setName} placeholder="Näiteks piim" autoFocus /><View style={{ flexDirection: 'row', gap: 10 }}><View style={{ flex: 1 }}><Field label="Kogus" value={quantity} onChangeText={setQuantity} keyboardType="numeric" /></View><View style={{ flex: 2 }}><Field label="Ühik või pakend" value={unit} onChangeText={setUnit} placeholder="tk, 1 l, pakk" /></View></View><Field label="Märkus" value={note} onChangeText={setNote} placeholder="Valikuline täpsustus" multiline /><PhotoField value={photo} onChange={setPhoto} /><Button label={saving ? 'Lisan…' : 'Lisa jooksvasse listi'} onPress={() => void submit()} disabled={!name.trim() || saving} /></Sheet>
  </Page>;
}
