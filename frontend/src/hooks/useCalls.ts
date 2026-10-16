import { useMemo } from 'react';
import { useApi } from '@/hooks/useApi';
import { getSchedule } from '@/services/schedule';
import { formatTime } from '@/utils/format';
import type { RehearsalDate } from '@/types';

export const CALL_TYPE_LABELS: Record<string, string> = {
  regular: 'Rehearsal',
  tech: 'Tech',
  dress: 'Dress',
  performance: 'Show',
  blocked: 'Off',
};

export function localISO(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function callLabel(d: Pick<RehearsalDate, 'date' | 'start_time' | 'type'>): string {
  const day = new Date(`${d.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day} · ${formatTime(d.start_time)} · ${CALL_TYPE_LABELS[d.type] ?? d.type}`;
}

/** Calls (rehearsals, tech, shows) sorted by date, plus the one to show first. */
export function useCalls(productionId: string | undefined) {
  const { data, isLoading, refetch } = useApi<RehearsalDate[]>(
    productionId ? () => getSchedule(productionId) : () => Promise.resolve([]),
    [productionId],
  );
  const calls = useMemo(
    () =>
      (data ?? [])
        .filter(d => !d.is_deleted && d.type !== 'blocked')
        .sort((a, b) => (a.date + a.start_time).localeCompare(b.date + b.start_time)),
    [data],
  );
  const today = localISO(new Date());
  const defaultCall = useMemo(
    () => calls.find(c => c.date >= today && !c.is_cancelled) ?? calls[calls.length - 1] ?? null,
    [calls, today],
  );
  return { calls, defaultCall, isLoading, refetch };
}
