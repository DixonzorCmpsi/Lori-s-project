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
    content: 'This is your production dashboard. You\'ll see upcoming rehearsals, announcements, conflict status, and quick links to every section.',
    placement: 'right',
    skipBeacon: true,
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-schedule"]',
    title: 'Schedule Builder',
    content: 'Build your rehearsal calendar here. Click "Edit Schedule" to open the editor. First, set a weekly pattern (e.g. Mon/Wed/Fri = Rehearsal). Then click individual days to override specific dates. Set default times, and hit Apply to save across the entire run.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-bulletin"]',
    title: 'Bulletin Board',
    content: 'Post announcements for the entire company. Each post appears as a sticky note on the chalkboard. Pin important notices to keep them at the top. Toggle "Notify members" to send alerts.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-members"]',
    title: 'Company Roster',
    content: 'View all members and their conflict status. Generate invite links to add cast. You can promote cast to staff, reset their conflicts, or remove them from the production.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-chat"]',
    title: 'Direct Messages',
    content: 'Send private messages to any cast or staff member. As director, you can also delete any message in any conversation for moderation purposes.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-settings"]',
    title: 'Production Settings',
    content: 'Update your production name, dates (first rehearsal through closing night), and manage invite links.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="cast-panel"]',
    title: 'Cast & Crew Panel',
    content: 'Click any member to see their profile, submitted conflicts, and assigned rehearsal dates. Switch between Cast and Staff tabs. Drag the panel edge to resize it.',
    placement: 'left',
    ...theaterStep,
  },
];

/** Tour for staff members */
export const staffTourSteps: Step[] = [
  {
    target: '[data-tour="nav-dashboard"]',
    title: 'Welcome, Stage Manager',
    content: 'This is your production dashboard. You have access to the schedule editor, bulletin board, and member management, just like the director.',
    placement: 'right',
    skipBeacon: true,
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-schedule"]',
    title: 'Schedule Builder',
    content: 'Edit the rehearsal calendar. Set weekly patterns (which days of the week have rehearsals), then override specific dates for tech week, dress rehearsals, or performances. Conflict counts show on each day so you can see who\'s unavailable.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-bulletin"]',
    title: 'Bulletin Board',
    content: 'Post and edit announcements. Pin important notices. Each post appears as a sticky note on the chalkboard.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-members"]',
    title: 'Company Roster',
    content: 'View all members and their conflict submission status. Generate invite links to share with new cast members.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-chat"]',
    title: 'Messages',
    content: 'Direct message anyone in the production. You can reach out to cast members with schedule updates or answer their questions.',
    placement: 'right',
    ...theaterStep,
  },
];

/** Tour for cast members when they first enter a production */
export const castTourSteps: Step[] = [
  {
    target: '[data-tour="nav-bulletin"]',
    title: 'Welcome to the Show!',
    content: 'This is the bulletin board. Check here for announcements from your director and stage manager. Important notices will be pinned to the top.',
    placement: 'right',
    skipBeacon: true,
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-schedule"]',
    title: 'Your Rehearsal Schedule',
    content: 'View the full rehearsal calendar. Days you\'re called for will be highlighted with colored sticky notes showing the type (rehearsal, tech, dress, performance). Blocked days are marked with an X.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-chat"]',
    title: 'Messages',
    content: 'Send direct messages to your director and stage manager. You can reach out anytime with questions, schedule concerns, or anything else. Note: you can only message director and staff, not other cast members.',
    placement: 'right',
    ...theaterStep,
  },
];
