import { useState, useCallback, useEffect } from 'react';
import type { Step, EventData, Controls } from 'react-joyride';

const TOUR_STORAGE_KEY = 'dcb-tours-completed';

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
}

export function resetAllTours() {
  localStorage.removeItem(TOUR_STORAGE_KEY);
}

export function useTour(tourId: string, steps: Step[], autoStart = true) {
  const [run, setRun] = useState(false);

  const isCompleted = getCompletedTours()[tourId] === true;

  useEffect(() => {
    if (autoStart && !isCompleted && steps.length > 0) {
      const timer = setTimeout(() => setRun(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [autoStart, isCompleted, steps.length]);

  const handleEvent = useCallback((data: EventData) => {
    const { status } = data;
    if (status === 'finished' || status === 'skipped') {
      setRun(false);
      markTourComplete(tourId);
    }
  }, [tourId]);

  const startTour = useCallback(() => {
    setRun(true);
  }, []);

  return { run, steps, handleEvent, startTour, isCompleted };
}
