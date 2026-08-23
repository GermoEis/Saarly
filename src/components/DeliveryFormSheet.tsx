import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useApp } from '@/context/AppContext';
import { ThemeColors } from '@/theme';
import { Button, Field, Sheet } from './ui';
import { DeparturePicker } from './DeparturePicker';
import { departureTime, isActiveShipment, isFutureDeparture } from '@/data/departures';

export function DeliveryFormSheet({ listId, onClose }: { listId: string | null; onClose: () => void }) {
  if (!listId) return null;
  return <DeliveryForm key={listId} listId={listId} onClose={onClose} />;
}

function DeliveryForm({ listId, onClose }: { listId: string; onClose: () => void }) {
  const app = useApp();
  const existing = app.state.deliveries.find((delivery) => delivery.list_id === listId && delivery.courier_id === app.currentUser?.id && isActiveShipment(delivery));
  const [ship, setShip] = useState(existing?.ship_name ?? ''); const [date, setDate] = useState(existing?.departure_date ?? ''); const [time, setTime] = useState(existing ? departureTime(existing.departure_time) : ''); const [saving, setSaving] = useState(false);
  const port = existing?.port ?? 'Tallinn'; const place = existing?.handover_place ?? 'D-terminal'; const [note, setNote] = useState(existing?.note ?? '');

  const save = async () => {
    if (!listId || !ship.trim() || !date.trim() || !time.trim() || !isFutureDeparture(date, time)) return;
    setSaving(true);
    try {
      const saved = await app.saveDelivery(listId, { ship_name: ship.trim(), departure_date: date.trim(), departure_time: time.trim(), port: port.trim(), handover_place: place.trim(), note: note.trim() || undefined });
      if (saved) onClose();
    } finally { setSaving(false); }
  };

  return <Sheet visible title="Määra laev" onClose={onClose}>
    <Choice label="Varem kasutatud laevad" values={[...new Set(app.state.deliveries.map((delivery) => delivery.ship_name).filter((name) => name.toLocaleLowerCase('et-EE') !== 'baltic queen'))]} selected={ship} onSelect={setShip} />
    <Field label="Laeva nimi" value={ship} onChangeText={setShip} />
    <DeparturePicker date={date} time={time} onDateChange={setDate} onTimeChange={setTime} />
    <Field label="Täiendav märkus" value={note} onChangeText={setNote} multiline />
    <Button label={saving ? 'Salvestan…' : 'Salvesta laevainfo'} onPress={() => { void save(); }} disabled={saving || !ship.trim() || !date.trim() || !time.trim() || !isFutureDeparture(date, time)} />
  </Sheet>;
}

function Choice({ label, values, selected, onSelect }: { label: string; values: string[]; selected: string; onSelect: (value: string) => void }) {
  const app = useApp(); const styles = makeStyles(app.themeColors);
  return <View style={{ gap: 8 }}><Text style={styles.label}>{label}</Text><View style={styles.chips}>{values.map((value) => <Pressable key={value} onPress={() => onSelect(value)} style={[styles.chip, value === selected && styles.chipActive]}><Text style={[styles.chipText, value === selected && styles.chipTextActive]}>{value}</Text></Pressable>)}</View></View>;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  label: { color: colors.ink, fontSize: 15, fontWeight: '600' }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: { borderWidth: 1, borderColor: colors.fieldBorder, backgroundColor: colors.field, borderRadius: 8, paddingHorizontal: 11, paddingVertical: 8 },
  chipActive: { backgroundColor: colors.primarySoft, borderColor: colors.secondaryBorder }, chipText: { color: colors.ink, fontWeight: '600' }, chipTextActive: { color: colors.primaryDark, fontWeight: '700' },
});
