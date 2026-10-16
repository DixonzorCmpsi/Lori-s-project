import { useEffect, useMemo } from 'react';
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
  const { run, handleEvent, finish } = usePageTour(tourId, steps);
  const { theme, uiStyle } = useTheme();
  const styles = useMemo(() => getTheaterTourStyles(uiStyle), [theme, uiStyle]);
  // Skip steps whose target is not on this screen (for example staff-only buttons for cast)
  const liveSteps = useMemo(
    () => (run ? steps.filter(st => typeof st.target !== 'string' || !!document.querySelector(st.target)) : steps),
    [run, steps],
  );

  // A tour whose targets are all off screen would otherwise stay "running" forever
  useEffect(() => {
    if (run && liveSteps.length === 0) finish();
  }, [run, liveSteps.length, finish]);

  if (liveSteps.length === 0 || !run) return null;

  return (
    <Joyride
      steps={liveSteps}
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
