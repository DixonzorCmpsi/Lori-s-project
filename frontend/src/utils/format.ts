import { format, formatDistanceToNow, parseISO } from 'date-fns';

export function formatDate(dateStr: string): string {
  return format(parseISO(dateStr), 'MMM d, yyyy');
}

export function formatShortDate(dateStr: string): string {
  return format(parseISO(dateStr), 'MMM d');
}

export function formatTime(timeStr: string): string {
  // timeStr is "HH:MM" or "HH:MM:SS"
  const [h, m] = timeStr.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, '0')} ${period}`;
}

export function formatRelativeTime(dateStr: string): string {
  return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
}

export function formatDateFull(dateStr: string): string {
  return format(parseISO(dateStr), 'EEEE, MMMM d, yyyy');
}

export function getDayName(dateStr: string): string {
  return format(parseISO(dateStr), 'EEEE').toLowerCase();
}
