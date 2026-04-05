import type { Step } from 'react-joyride';

/** Per-step defaults — all visual styling comes from tourStyles.ts */
const theaterStep = {};

/** Tour for directors/staff when they first enter a production */
export const directorTourSteps: Step[] = [
  {
    target: '[data-tour="nav-dashboard"]',
    title: 'Welcome to the Call Board',
    content: 'This is your production at a glance. Upcoming rehearsals, announcements, conflict status, and quick links to everything you need to run the show.',
    placement: 'right',
    skipBeacon: true,
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-schedule"]',
    title: 'The Schedule',
    content: 'Build your rehearsal calendar. Set a weekly pattern (Mon/Wed/Fri, for example), then override individual dates for tech week, dress, or performances. Set default times and hit Apply.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-bulletin"]',
    title: 'The Bulletin Board',
    content: 'Post announcements for the whole production. Each one goes up as a sticky note on the board. Pin the important stuff to the top. Toggle notifications to ping your cast.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-members"]',
    title: 'Members & Teams',
    content: 'Everyone in the production lives here. See who\'s submitted conflicts, promote people to staff, or organize cast into teams. Cast in the same team can message each other.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-chat"]',
    title: 'Messages',
    content: 'Direct message anyone in the production. Need to reach a cast member about a schedule change? This is where you do it. You can also moderate any conversation.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-settings"]',
    title: 'Settings',
    content: 'Production settings, conflict window management, and member role changes. Set how many times cast can re-submit conflicts here.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="cast-panel"]',
    title: 'Cast & Crew',
    content: 'Click any name to see their conflicts, assigned dates, and contact info. Switch between Cast and Staff tabs. You can drag the panel edge to resize it.',
    placement: 'left',
    ...theaterStep,
  },
];

/** Tour for staff members */
export const staffTourSteps: Step[] = [
  {
    target: '[data-tour="nav-dashboard"]',
    title: 'Welcome to the Call Board',
    content: 'Here\'s your production hub. You\'ve got full access to the schedule, bulletin board, and roster, same as the director.',
    placement: 'right',
    skipBeacon: true,
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-schedule"]',
    title: 'The Schedule',
    content: 'Build and edit the rehearsal calendar. Set a weekly pattern, then override specific dates for tech, dress, and performances. Conflict counts show on each day so you can plan around availability.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-bulletin"]',
    title: 'The Bulletin Board',
    content: 'Post announcements, pin the important ones, and keep the cast in the loop. Each post goes up as a sticky note on the board.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-members"]',
    title: 'The Roster',
    content: 'See everyone in the production and their conflict status. Generate invite links to bring in new cast members.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-chat"]',
    title: 'Messages',
    content: 'Direct message anyone in the production. Great for schedule updates, answering questions, or anything that doesn\'t need to go on the bulletin.',
    placement: 'right',
    ...theaterStep,
  },
];

/** Tour for cast members when they first enter a production */
export const castTourSteps: Step[] = [
  {
    target: '[data-tour="nav-dashboard"]',
    title: 'Welcome to the Call Board',
    content: 'Your personal dashboard. See this week\'s schedule, your info, latest announcements, and upcoming rehearsals all in one place.',
    placement: 'right',
    skipBeacon: true,
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-bulletin"]',
    title: 'Bulletin Board',
    content: 'Your director posts announcements here. Pinned notes are the ones to read first. Check back often for schedule changes.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-schedule"]',
    title: 'Your Schedule',
    content: 'The full rehearsal calendar. Days you\'re called for show colored notes with the type and time. Click any day to see the details.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-chat"]',
    title: 'Messages',
    content: 'Message your director, stage manager, or teammates directly. If you\'ve been assigned to a team, you can also chat with other cast in your group.',
    placement: 'right',
    ...theaterStep,
  },
];
