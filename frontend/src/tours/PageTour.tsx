import { useMemo } from 'react';
import { Joyride } from 'react-joyride';
import type { Step } from 'react-joyride';
import { usePageTour } from '@/hooks/useTour';
import { useTheme } from '@/contexts/ThemeContext';
import { getTheaterTourStyles, theaterTourLocale, theaterTourOptions } from './tourStyles';

interface PageTourProps {
  tourId: string;
  steps: Step[];
}

/** Drop-in component for page-specific tours. Waits for production tour to finish first. */
export function PageTour({ tourId, steps }: PageTourProps) {
  const { run, handleEvent } = usePageTour(tourId, steps);
  const { theme } = useTheme();
  const styles = useMemo(() => getTheaterTourStyles(), [theme]);

  if (steps.length === 0 || !run) return null;

  return (
    <Joyride
      steps={steps}
      run={run}
      onEvent={handleEvent}
      continuous
      scrollToFirstStep={false}
      styles={styles as any}
      locale={theaterTourLocale}
      options={theaterTourOptions}
    />
  );
}
