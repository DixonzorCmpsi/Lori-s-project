import type { Step } from 'react-joyride';

const theaterStep = {
  backgroundColor: 'hsl(220, 6%, 11%)',
  textColor: 'hsl(35, 20%, 85%)',
  primaryColor: 'hsl(38, 70%, 50%)',
  overlayColor: 'rgba(0, 0, 0, 0.7)',
  arrowColor: 'hsl(220, 6%, 11%)',
};

/** Tour for directors/staff when they first enter a production */
export const directorTourSteps: Step[] = [
  {
    target: '[data-tour="nav-dashboard"]',
    title: 'Welcome Backstage',
    content: 'This is your production dashboard. You\'ll see an overview of upcoming rehearsals, announcements, and cast status at a glance.',
    placement: 'right',
    skipBeacon: true,
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-schedule"]',
    title: 'Schedule Builder',
    content: 'Build your rehearsal schedule here. Click "Edit Schedule" to set weekly patterns, then override individual dates.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-bulletin"]',
    title: 'Bulletin Board',
    content: 'Post announcements for the entire company. Pin important notices to keep them at the top.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-members"]',
    title: 'Company Roster',
    content: 'View all members, promote cast to staff, reset conflict submissions, or remove members. Generate invite links here.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-chat"]',
    title: 'Direct Messages',
    content: 'Send private messages to any cast or staff member. As director, you can moderate messages in any conversation.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-settings"]',
    title: 'Production Settings',
    content: 'Update production details, dates, and manage your invite links here.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="cast-panel"]',
    title: 'Cast & Crew Panel',
    content: 'Click any member to see their profile, conflicts, and assignments. Drag the edge to resize.',
    placement: 'left',
    ...theaterStep,
  },
];

/** Tour for cast members when they first enter a production */
export const castTourSteps: Step[] = [
  {
    target: '[data-tour="nav-bulletin"]',
    title: 'Welcome to the Show!',
    content: 'Check here for announcements from your director and stage manager.',
    placement: 'right',
    skipBeacon: true,
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-schedule"]',
    title: 'Your Schedule',
    content: 'View the rehearsal calendar. Days you\'re assigned to will be highlighted. Blocked days are marked with an X.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-chat"]',
    title: 'Messages',
    content: 'Send direct messages to your director and stage manager anytime with questions or concerns.',
    placement: 'right',
    ...theaterStep,
  },
];
