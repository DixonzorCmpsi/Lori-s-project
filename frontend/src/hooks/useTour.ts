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
  const [stepIndex, setStepIndex] = useState(0);

  const isCompleted = getCompletedTours()[tourId] === true;

  // Auto-start tour after a short delay if not completed
  useEffect(() => {
    if (autoStart && !isCompleted && steps.length > 0) {
      const timer = setTimeout(() => setRun(true), 1200);
      return () => clearTimeout(timer);
    }
  }, [autoStart, isCompleted, steps.length]);

  const handleEvent = useCallback((data: EventData, controls: Controls) => {
    const { status, type, action } = data;

    if (status === 'finished' || status === 'skipped') {
      setRun(false);
      markTourComplete(tourId);
    }

    if (type === 'step:after') {
      if (action === 'prev') {
        controls.prev();
      } else {
        controls.next();
      }
    }
  }, [tourId]);

  const startTour = useCallback(() => {
    setStepIndex(0);
    setRun(true);
  }, []);

  return {
    run,
    stepIndex,
    steps,
    handleEvent,
    startTour,
    isCompleted,
  };
}

// ── Theater-themed Joyride styles ──────────────────────────────────

export const theaterTourStyles: Record<string, any> = {
  options: {
    backgroundColor: 'hsl(220, 6%, 11%)',
    primaryColor: 'hsl(38, 70%, 50%)',
    textColor: 'hsl(35, 20%, 85%)',
    arrowColor: 'hsl(220, 6%, 11%)',
    overlayColor: 'rgba(0, 0, 0, 0.7)',
    zIndex: 1000,
  },
  tooltip: {
    borderRadius: '8px',
    padding: '16px 20px',
    boxShadow: '0 12px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,175,55,0.15)',
  },
  tooltipTitle: {
    fontFamily: '"Playfair Display", serif',
    fontSize: '15px',
    fontWeight: 600,
    color: 'hsl(43, 74%, 58%)',
    marginBottom: '6px',
  },
  tooltipContent: {
    fontSize: '13px',
    lineHeight: '1.5',
    color: 'hsl(25, 8%, 65%)',
  },
  buttonNext: {
    backgroundColor: 'hsl(38, 70%, 50%)',
    color: 'hsl(25, 20%, 8%)',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.05em',
    textTransform: 'uppercase' as const,
    borderRadius: '6px',
    padding: '8px 16px',
  },
  buttonBack: {
    color: 'hsl(25, 8%, 50%)',
    fontSize: '11px',
    marginRight: '8px',
  },
  buttonSkip: {
    color: 'hsl(25, 8%, 40%)',
    fontSize: '11px',
  },
  buttonClose: {
    color: 'hsl(25, 8%, 50%)',
  },
  spotlight: {
    borderRadius: '8px',
  },
};
