import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '@/context/AppContext';
import { ThemeColors } from '@/theme';
import { Button, Field, Sheet } from './ui';

export function DeliveryFormSheet({ listId, onClose }: { listId: string | null; onClose: () => void }) {
  if (!listId) return null;
  return <DeliveryForm key={listId} listId={listId} onClose={onClose} />;
}

function DeliveryForm({ listId, onClose }: { listId: string; onClose: () => void }) {
  const app = useApp();
  const existing = app.state.deliveries.find((delivery) => delivery.list_id === listId && delivery.courier_id === app.currentUser?.id);
  const [ship, setShip] = useState(existing?.ship_name ?? 'Baltic Queen'); const [date, setDate] = useState(existing?.departure_date ?? new Date().toISOString().slice(0, 10)); const [time, setTime] = useState(existing?.departure_time ?? '');
  const [port, setPort] = useState(existing?.port ?? 'Tallinn'); const [place, setPlace] = useState(existing?.handover_place ?? 'D-terminal'); const [note, setNote] = useState(existing?.note ?? '');

  const save = () => {
    if (!listId || !ship.trim() || !date.trim() || !port.trim() || !place.trim()) return;
    app.saveDelivery(listId, { ship_name: ship.trim(), departure_date: date.trim(), departure_time: time.trim() || undefined, port: port.trim(), handover_place: place.trim(), note: note.trim() || undefined });
    onClose();
  };

  return <Sheet visible title="Määra laev" onClose={onClose}>
    <Choice label="Varem kasutatud laevad" values={[...new Set(['Baltic Queen', ...app.state.deliveries.map((delivery) => delivery.ship_name)])]} selected={ship} onSelect={setShip} />
    <Field label="Laeva nimi" value={ship} onChangeText={setShip} />
    <Field label="Väljumise kuupäev" value={date} onChangeText={setDate} placeholder="AAAA-KK-PP" />
    <Field label="Laeva väljumise kellaaeg (valikuline)" value={time} onChangeText={setTime} placeholder="Näiteks 18:00" />
    <Choice label="Varem kasutatud sadamad" values={[...new Set(['Tallinn', ...app.state.deliveries.map((delivery) => delivery.port)])]} selected={port} onSelect={setPort} />
    <Field label="Sadam või terminal" value={port} onChangeText={setPort} />
    <Field label="Üleandmise koht" value={place} onChangeText={setPlace} />
    <Field label="Täiendav märkus" value={note} onChangeText={setNote} multiline />
    <Button label="Salvesta laevainfo" onPress={save} disabled={!ship.trim() || !date.trim() || !port.trim() || !place.trim()} />
  </Sheet>;
}

function Choice({ label, values, selected, onSelect }: { label: string; values: string[]; selected: string; onSelect: (value: string) => void }) {
  const app = useApp(); const styles = makeStyles(app.themeColors);
  return <View style={{ gap: 8 }}><Text style={styles.label}>{label}</Text><View style={styles.chips}>{values.map((value) => <Pressable key={value} onPress={() => onSelect(value)} style={[styles.chip, value === selected && styles.chipActive]}><Text style={[styles.chipText, value === selected && styles.chipTextActive]}>{value}</Text></Pressable>)}</View></View>;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  label: { color: colors.ink, fontSize: 15, fontWeight: '700' }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderWidth: 1, borderColor: colors.fieldBorder, backgroundColor: colors.field, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 9 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary }, chipText: { color: colors.ink, fontWeight: '700' }, chipTextActive: { color: colors.onPrimary },
});
