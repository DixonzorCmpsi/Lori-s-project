import { formatTime } from '@/utils/format';
import type { DoubleBooking } from '@/services/attendance';

/** One plain-English sentence for a double-booking warning. */
export function describeDoubleBooking(w: DoubleBooking): string {
  const when = (i: DoubleBooking['items'][number]) => `${formatTime(i.start_time)}–${formatTime(i.end_time)}`;
  const day = new Date(`${w.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  if (w.kind === 'room') return `${day}: ${w.location} is booked twice (${w.items.map(when).join(' and ')}).`;
  if (w.kind === 'overlap') return `${day}: two full-company calls overlap (${w.items.map(when).join(' and ')}).`;
  if (w.kind === 'person') {
    const names = w.people.map(p => p.name).join(', ');
    return `${day}: ${names} ${w.people.length > 1 ? 'are' : 'is'} called to overlapping calls (${w.items.map(when).join(' and ')}).`;
  }
  const slot = w.slot ? `${formatTime(w.slot.start_time)}–${formatTime(w.slot.end_time)}` : '';
  return `${day}: ${w.people[0]?.name} signed up for “${w.slot?.title}” (${slot}), which overlaps their call.`;
}
