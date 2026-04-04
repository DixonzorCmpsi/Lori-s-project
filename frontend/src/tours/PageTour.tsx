import { Joyride } from 'react-joyride';
import type { Step } from 'react-joyride';
import { useTour } from '@/hooks/useTour';

interface PageTourProps {
  tourId: string;
  steps: Step[];
}

/** Drop-in component that runs a page-specific tour on first visit */
export function PageTour({ tourId, steps }: PageTourProps) {
  const { run, handleEvent } = useTour(tourId, steps, true);

  if (steps.length === 0) return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      onEvent={handleEvent}
      continuous
      scrollToFirstStep
    />
  );
}
