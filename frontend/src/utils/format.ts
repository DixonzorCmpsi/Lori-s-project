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
  if (!dateStr) return '';
  return formatDistanceToNow(parseISO(dateStr), { addSuffix: true });
}

/** Shows "2:30 PM" for today, "Apr 4, 2:30 PM" for this year, "Apr 4, 2025" for older */
export function formatMessageTime(dateStr: string): string {
  if (!dateStr) return '';
  const d = parseISO(dateStr);
  const now = new Date();
  const isToday = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  if (isToday) return format(d, 'h:mm a');
  if (d.getFullYear() === now.getFullYear()) return format(d, 'MMM d, h:mm a');
  return format(d, 'MMM d, yyyy');
}

/** Get initials from a name — "Hannah Johansson" → "HJ", "Dixon" → "D" */
export function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return parts[0][0]?.toUpperCase() || '?';
}

export function formatDateFull(dateStr: string): string {
  return format(parseISO(dateStr), 'EEEE, MMMM d, yyyy');
}

export function getDayName(dateStr: string): string {
  return format(parseISO(dateStr), 'EEEE').toLowerCase();
}
