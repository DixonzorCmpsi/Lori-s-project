import { useState, useCallback, useEffect } from 'react';
import type { Step, EventData } from 'react-joyride';

const TOUR_STORAGE_KEY = 'dcb-tours-completed';
const ACTIVE_TOUR_KEY = 'dcb-tour-active';

function getCompletedTours(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(TOUR_STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function markTourComplete(tourId: string) {
  const completed = getCompletedTours();
  completed[tourId] = true;
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
  return getCompletedTours()[tourId] === true;
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
  const isCompleted = getCompletedTours()[tourId] === true;

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
    const { status, type, action } = data as EventData & { type?: string; action?: string };
    if (status === 'finished' || status === 'skipped' || type === 'tour:end' || action === 'close') {
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
  const isCompleted = getCompletedTours()[tourId] === true;

  useEffect(() => {
    if (isCompleted || steps.length === 0) return;

    let cancelled = false;

    function tryStart() {
      // Re-check completion from localStorage to avoid stale closure
      if (cancelled || getCompletedTours()[tourId]) return;
      const active = getActiveTour();
      // Don't start if another tour is running
      if (active && active !== tourId) return;
      setActiveTour(tourId);
      setRun(true);
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
    // Listen for manual "Take Tour" button
    function onManualStart() {
      if (cancelled || getCompletedTours()[tourId]) return;
      setActiveTour(tourId);
      setRun(true);
    }
    window.addEventListener('tour-completed', onTourCompleted);
    window.addEventListener('start-page-tour', onManualStart);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      window.removeEventListener('tour-completed', onTourCompleted);
      window.removeEventListener('start-page-tour', onManualStart);
    };
  }, [isCompleted, steps.length, tourId]);

  const handleEvent = useCallback((data: EventData) => {
    const { status, type, action } = data as EventData & { type?: string; action?: string };
    if (status === 'finished' || status === 'skipped' || type === 'tour:end' || action === 'close') {
      setRun(false);
      markTourComplete(tourId);
    }
  }, [tourId]);

  return { run, handleEvent, isCompleted };
}
