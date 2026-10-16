import { apiClient } from './api';

export interface CalendarLink {
  token: string;
  path: string;
}

export const getCalendarLink = (productionId: string) => apiClient<CalendarLink>(`/productions/${productionId}/calendar-link`);
export const resetCalendarLink = (productionId: string) =>
  apiClient<CalendarLink>(`/productions/${productionId}/calendar-link/reset`, { method: 'POST' });

/** Absolute URL of the feed (what Google Calendar asks for). */
export const feedUrl = (link: CalendarLink) => `${window.location.origin}${link.path}`;
/** webcal:// opens the user's calendar app directly. */
export const webcalUrl = (link: CalendarLink) => feedUrl(link).replace(/^https?:/, 'webcal:');
