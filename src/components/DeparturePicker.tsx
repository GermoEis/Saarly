import { Picker } from '@react-native-picker/picker';
import { StyleSheet, Text, View } from 'react-native';
import { departureDates, departureTimesForDate, localDate } from '@/data/departures';
import { useApp } from '@/context/AppContext';
import { ThemeColors } from '@/theme';

export function DeparturePicker({ date, time, onDateChange, onTimeChange }: { date: string; time: string; onDateChange: (value: string) => void; onTimeChange: (value: string) => void }) {
  const app = useApp(); const styles = makeStyles(app.themeColors);
  const times = date ? departureTimesForDate(date) : [];
  const changeDate = (nextDate: string) => { onDateChange(nextDate); const available = nextDate ? departureTimesForDate(nextDate) : []; if (time && !available.includes(time)) onTimeChange(''); };
  return <View style={{ gap: 9 }}><Text style={styles.label}>Väljumise kuupäev ja kellaaeg</Text><View style={styles.row}><View style={styles.selectWrap}><Text style={styles.caption}>Kuupäev</Text><Picker selectedValue={date} onValueChange={changeDate} style={styles.select}><Picker.Item label="Vali kuupäev" value="" />{departureDates(date || localDate()).map((value) => <Picker.Item key={value} label={new Date(`${value}T12:00:00`).toLocaleDateString('et-EE', { weekday: 'short', day: 'numeric', month: 'long' })} value={value} />)}</Picker></View><View style={styles.selectWrap}><Text style={styles.caption}>Kellaaeg</Text><Picker selectedValue={time} onValueChange={onTimeChange} style={styles.select} enabled={Boolean(date) && times.length > 0}><Picker.Item label="Vali kellaaeg" value="" />{times.map((value) => <Picker.Item key={value} label={value} value={value} />)}</Picker></View></View><Text style={styles.hint}>Kui täpset kella ei tea, vali palun kell 18.00.</Text></View>;
}

const makeStyles = (colors: ThemeColors) => StyleSheet.create({
  label: { color: colors.ink, fontSize: 15, fontWeight: '600' }, row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, selectWrap: { flexGrow: 1, flexBasis: 190, borderWidth: 1, borderColor: colors.fieldBorder, borderRadius: 9, backgroundColor: colors.field, overflow: 'hidden', minHeight: 74 }, caption: { color: colors.muted, fontSize: 13, fontWeight: '600', paddingHorizontal: 13, paddingTop: 9 }, select: { color: colors.ink, height: 46 }, hint: { color: colors.muted, fontSize: 14, lineHeight: 20 },
});
