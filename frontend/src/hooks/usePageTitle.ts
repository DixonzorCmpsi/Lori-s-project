import { useEffect } from 'react';

const BASE_TITLE = 'Digital Call Board';

/**
 * Sets the document title for the current page.
 * Resets to the base title on unmount.
 */
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} — ${BASE_TITLE}` : BASE_TITLE;
    return () => {
      document.title = BASE_TITLE;
    };
  }, [title]);
}
