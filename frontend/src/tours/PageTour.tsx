import { Joyride } from 'react-joyride';
import type { Step } from 'react-joyride';
import { usePageTour } from '@/hooks/useTour';

interface PageTourProps {
  tourId: string;
  steps: Step[];
}

/** Drop-in component for page-specific tours. Waits for production tour to finish first. */
export function PageTour({ tourId, steps }: PageTourProps) {
  const { run, handleEvent } = usePageTour(tourId, steps);

  if (steps.length === 0) return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      onEvent={handleEvent}
      continuous
      scrollToFirstStep
      locale={{ last: 'End' }}
      options={{ closeButtonAction: 'skip' }}
    />
  );
}
