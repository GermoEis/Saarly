import { Delivery } from '@/types/domain';

const pad = (value: number) => String(value).padStart(2, '0');

export function localDate(value = new Date()) { return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`; }
export function departureTime(value?: string | null) { return value?.slice(0, 5) || '18:00'; }
export function departureAt(delivery: Pick<Delivery, 'departure_date' | 'departure_time'>) { return new Date(`${delivery.departure_date}T${departureTime(delivery.departure_time)}`).getTime(); }
export function isFutureDeparture(date: string, time: string, now = Date.now()) { return new Date(`${date}T${departureTime(time)}`).getTime() > now; }
export function isActiveShipment(delivery: Delivery, now = Date.now()) {
  const scheduledAt = departureAt(delivery);
  // Vanemates kirjetes võib kellaaeg olla ebatavalises vormis. Neid ei tohi
  // kasutajale peita enne, kui tal on võimalik kuupäev/kellaaeg ära parandada.
  return delivery.status === 'planned' && (!Number.isFinite(scheduledAt) || scheduledAt + 60 * 60 * 1000 > now);
}
export function departureDates(selected: string, days = 45) {
  const dates = Array.from({ length: days }, (_, index) => { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() + index); return localDate(date); });
  return dates.includes(selected) ? dates : [selected, ...dates];
}
export const departureTimes = Array.from({ length: 48 }, (_, index) => `${pad(Math.floor(index / 2))}:${index % 2 ? '30' : '00'}`);
export function departureTimesForDate(date: string, now = new Date()) {
  const today = localDate(now);
  if (date < today) return [];
  return date === today ? departureTimes.filter((time) => isFutureDeparture(date, time, now.getTime())) : departureTimes;
}
export function defaultDeparture(now = new Date()) {
  const date = localDate(now);
  if (isFutureDeparture(date, '18:00', now.getTime())) return { date, time: '18:00' };
  const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate() + 1);
  return { date: localDate(tomorrow), time: '18:00' };
}
