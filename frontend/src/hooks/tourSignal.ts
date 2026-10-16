import { useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react';

/**
 * Tells the rest of the page whether a guided tour is running or about to start,
 * so the "How this page works" box can step aside instead of overlapping it.
 */
type TourState = 'pending' | 'running';

/** A tour that has not started this long after it was due is treated as not coming. */
const PENDING_MS = 6000;

const entries = new Map<string, TourState>();
const listeners = new Set<() => void>();
let busy = false;

function emit() {
  const next = entries.size > 0;
  if (next === busy) return;
  busy = next;
  listeners.forEach(l => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Report one tour's state. Set before paint so the page never shows both at once. */
export function useReportTour(id: string, state: TourState | null) {
  useLayoutEffect(() => {
    if (state) entries.set(id, state);
    else entries.delete(id);
    emit();
  }, [id, state]);

  useLayoutEffect(() => () => {
    entries.delete(id);
    emit();
  }, [id]);
}

/**
 * True while any tour is running or waiting to start. A pending tour only counts
 * for a few seconds so a tour that never starts cannot hide the guide for good.
 */
export function useTourBusy(): boolean {
  return useSyncExternalStore(subscribe, () => busy, () => false);
}

/** Pending expires after PENDING_MS; restarts whenever `waiting` becomes true again. */
export function usePendingWindow(waiting: boolean): boolean {
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    if (!waiting) { setExpired(false); return; }
    const t = setTimeout(() => setExpired(true), PENDING_MS);
    return () => clearTimeout(t);
  }, [waiting]);
  return waiting && !expired;
}
