import { useState, useCallback, useEffect } from 'react';
import type { Step, EventData } from 'react-joyride';
import { useReportTour, usePendingWindow } from './tourSignal';

/** Time for the "How this page works" box to fold away before a tour measures the page. */
const SETTLE_MS = 380;

const TOUR_STORAGE_KEY = 'dcb-tours-completed';
const ACTIVE_TOUR_KEY = 'dcb-tour-active';
/** Bump when tour content changes so people see the updated tours once. */
const TOUR_VERSION = '2';
const versioned = (tourId: string) => `${tourId}@${TOUR_VERSION}`;

function getCompletedTours(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(TOUR_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function markTourComplete(tourId: string) {
  const completed = getCompletedTours();
  completed[versioned(tourId)] = true;
  localStorage.setItem(TOUR_STORAGE_KEY, JSON.stringify(completed));
  // Clear active flag
  sessionStorage.removeItem(ACTIVE_TOUR_KEY);
  // Notify other hooks that a tour finished
  window.dispatchEvent(new Event('tour-completed'));
}

function setActiveTour(tourId: string) {
  sessionStorage.setItem(ACTIVE_TOUR_KEY, tourId);
}

function getActiveTour(): string | null {
  return sessionStorage.getItem(ACTIVE_TOUR_KEY);
}

export function isTourCompleted(tourId: string): boolean {
  return getCompletedTours()[versioned(tourId)] === true;
}

export function resetAllTours() {
  localStorage.removeItem(TOUR_STORAGE_KEY);
  sessionStorage.removeItem(ACTIVE_TOUR_KEY);
}

/** Dispatch event to tell the current page's tour to start */
export function triggerPageTour() {
  window.dispatchEvent(new Event('start-page-tour'));
}

/**
 * Primary tour hook. Used for the production-level tour in BackstageLayout.
 * Has priority — page tours wait for this to complete.
 */
export function useTour(tourId: string, steps: Step[], autoStart = true) {
  const [run, setRun] = useState(false);
  const isCompleted = getCompletedTours()[versioned(tourId)] === true;
  const waiting = autoStart && !isCompleted && steps.length > 0 && !!tourId && !run;
  const pending = usePendingWindow(waiting);
  useReportTour(`prod:${tourId}`, run ? 'running' : pending ? 'pending' : null);

  useEffect(() => {
    if (autoStart && !isCompleted && steps.length > 0 && tourId) {
      const timer = setTimeout(() => {
        setActiveTour(tourId);
        setRun(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [autoStart, isCompleted, steps.length, tourId]);

  const handleEvent = useCallback((data: EventData) => {
    const { status, type } = data as EventData & { type?: string };
    if (status === 'finished' || status === 'skipped' || type === 'tour:end') {
      setRun(false);
      markTourComplete(tourId);
    }
  }, [tourId]);

  const startTour = useCallback(() => {
    setActiveTour(tourId);
    setRun(true);
  }, [tourId]);

  return { run, steps, handleEvent, startTour, isCompleted };
}

/**
 * Page-level tour hook. Waits for any active primary tour to finish before starting.
 */
export function usePageTour(tourId: string, steps: Step[]) {
  const [run, setRun] = useState(false);
  const [starting, setStarting] = useState(false);
  const isCompleted = getCompletedTours()[versioned(tourId)] === true;
  const waiting = (!isCompleted && steps.length > 0 && !run) || starting;
  const pending = usePendingWindow(waiting);
  useReportTour(`page:${tourId}`, run ? 'running' : pending ? 'pending' : null);

  // Auto-start: only runs when the tour hasn't been completed yet
  useEffect(() => {
    if (isCompleted || steps.length === 0) return;

    let cancelled = false;

    function tryStart() {
      // Re-check completion from localStorage to avoid stale closure
      if (cancelled || getCompletedTours()[versioned(tourId)]) return;
      const active = getActiveTour();
      // Don't start if another tour is running
      if (active && active !== tourId) return;
      setActiveTour(tourId);
      setTimeout(() => { if (!cancelled) setRun(true); }, SETTLE_MS);
    }

    // Wait a bit for the production tour to claim the active slot
    const timer = setTimeout(() => {
      const active = getActiveTour();
      if (!active) {
        // No production tour running, start page tour
        tryStart();
      }
      // Otherwise wait for it to finish
    }, 2000);

    // Listen for production tour completion
    function onTourCompleted() {
      setTimeout(tryStart, 500);
    }
    window.addEventListener('tour-completed', onTourCompleted);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener('tour-completed', onTourCompleted);
    };
  }, [isCompleted, steps.length, tourId]);

  // Manual start: always active so "Take Tour" button works even after dismissal
  useEffect(() => {
    if (steps.length === 0) return;

    function onManualStart() {
      setActiveTour(tourId);
      setStarting(true);
      // Let the "How this page works" box fold away before the tour measures the page
      setTimeout(() => { setStarting(false); setRun(true); }, SETTLE_MS);
    }
    window.addEventListener('start-page-tour', onManualStart);
    return () => window.removeEventListener('start-page-tour', onManualStart);
  }, [steps.length, tourId]);

  const handleEvent = useCallback((data: EventData) => {
    const { status, type, action } = data as EventData & { type?: string; action?: string };
    if (status === 'finished' || status === 'skipped' || type === 'tour:end' || action === 'close') {
      setRun(false);
      markTourComplete(tourId);
    }
  }, [tourId]);

  /** Ends a tour that has nothing to show (every target missing from the screen). */
  const finish = useCallback(() => {
    setRun(false);
    markTourComplete(tourId);
  }, [tourId]);

  return { run, handleEvent, isCompleted, finish };
}
