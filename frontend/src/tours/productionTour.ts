import type { Step } from 'react-joyride';

/** Per-step defaults — all visual styling comes from tourStyles.ts */
const theaterStep = {};

/**
 * The tour that runs the first time someone opens a production. It walks the navigation
 * in the order the app is laid out. Steps that point at something not on screen (for
 * example items inside the phone "More" menu) are skipped automatically.
 */

const help: Step = {
  target: '[data-tour="nav-help"]',
  title: 'Never lost',
  content: '“How it works” explains every page in plain English, who can do what, and what the words mean. “Take tour” replays the guide for the page you are on.',
  placement: 'right',
  ...theaterStep,
};

const people: Step = {
  target: '[data-tour="cast-panel"]',
  title: 'Cast and crew',
  content: 'Click here to see everyone in the production. Click a name for their contact details and, for staff, their conflicts and assigned dates.',
  placement: 'auto',
  ...theaterStep,
};

/** Tour for the director */
export const directorTourSteps: Step[] = [
  {
    target: '[data-tour="nav-dashboard"]',
    title: 'Welcome to the Call Board',
    content: 'Think of this as the callboard backstage, but it follows you around. Everything for your production lives in the menu. This page is your home.',
    placement: 'right',
    skipBeacon: true,
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-schedule"]',
    title: 'Schedule',
    content: 'Build the rehearsal calendar: pick a weekly pattern, then adjust single dates for tech, dress and performances. Everyone can put their own calls on their phone calendar.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-callsheet"]',
    title: 'Call Sheet',
    content: 'The sign-in sheet and daily call. See who is called, who has arrived and who said they will be late, and mark attendance.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-scenes"]',
    title: 'Scenes',
    content: 'Break the show into scenes, cast them, and see which scenes work on a given day based on who has conflicts.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-reports"]',
    title: 'Reports',
    content: 'End-of-day rehearsal reports for each department, emailed to the people you choose. You can see who has read them.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-bulletin"]',
    title: 'Bulletin',
    content: 'Announcements for the whole company. Ask people to confirm they have read important ones, then see who has not and remind them.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-chat"]',
    title: 'Chat',
    content: 'Private messages with anyone in the production. Messages are kept as a record.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-members"]',
    title: 'Members',
    content: 'Everyone in the production. Share the invite link, see who has submitted conflicts, promote cast to staff, and organize cast into teams. Only you can invite, remove or block people.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-signups"]',
    title: 'Sign-ups',
    content: 'Open calls for volunteer jobs such as strike or box office. People sign themselves up, and are warned if it clashes with a rehearsal.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-documents"]',
    title: 'Documents',
    content: 'Share scripts, music and handbooks, and read them in a pop-up. Also publish forms such as photo releases for people to sign on screen.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-settings"]',
    title: 'Settings',
    content: 'Production dates, how many times cast can resubmit conflicts, and archiving when the show closes. Only you can change these.',
    placement: 'right',
    ...theaterStep,
  },
  people,
  help,
];

/** Tour for staff (stage managers, assistants) */
export const staffTourSteps: Step[] = [
  {
    target: '[data-tour="nav-dashboard"]',
    title: 'Welcome to the Call Board',
    content: 'This is your home. You can run rehearsals day to day: the schedule, call sheet, reports and announcements. The director keeps control of people and settings.',
    placement: 'right',
    skipBeacon: true,
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-schedule"]',
    title: 'Schedule',
    content: 'Edit the rehearsal calendar, set locations, and assign cast to dates.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-callsheet"]',
    title: 'Call Sheet',
    content: 'Who is called, who has arrived, and who said they will be late. Mark attendance here.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-scenes"]',
    title: 'Scenes',
    content: 'Cast each scene and see which scenes work on a given day.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-reports"]',
    title: 'Reports',
    content: 'Write the end-of-day report for each department and email it to the people who need it.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-bulletin"]',
    title: 'Bulletin',
    content: 'Post announcements, and ask people to confirm they have read the important ones.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-chat"]',
    title: 'Chat',
    content: 'Private messages with anyone in the production.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-members"]',
    title: 'Members',
    content: 'See everyone in the production and who has submitted conflicts, and organize cast into teams. Inviting, promoting and removing people is up to the director.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-signups"]',
    title: 'Sign-ups',
    content: 'Post open calls for volunteer jobs, and see who has signed up.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-documents"]',
    title: 'Documents',
    content: 'Share scripts and handbooks, read them in a pop-up, and publish forms for people to sign.',
    placement: 'right',
    ...theaterStep,
  },
  people,
  help,
];

/** Tour for cast */
export const castTourSteps: Step[] = [
  {
    target: '[data-tour="nav-dashboard"]',
    title: 'Welcome to the Call Board',
    content: 'This is your home. It shows your next call and anything waiting on you. Use the menu to get everywhere else.',
    placement: 'right',
    skipBeacon: true,
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-bulletin"]',
    title: 'Bulletin',
    content: 'Announcements from your director and stage manager. Pinned posts matter most. If one says “I’ve read this”, tap it.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-schedule"]',
    title: 'Schedule',
    content: 'Every rehearsal, with yours highlighted. Use “Add to my calendar” so your phone always has the latest.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-callsheet"]',
    title: 'Call Sheet',
    content: 'Check in when you arrive. If you will be late or can’t come, tell the stage manager here, before the rehearsal.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-chat"]',
    title: 'Chat',
    content: 'Message your director, the stage managers, and the cast on your team.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-signups"]',
    title: 'Sign-ups',
    content: 'Volunteer jobs that need people, such as strike or box office. Tap “Sign me up”, or “Withdraw” if plans change.',
    placement: 'right',
    ...theaterStep,
  },
  {
    target: '[data-tour="nav-documents"]',
    title: 'Documents',
    content: 'Scripts, music and handbooks you can read in a pop-up. Forms to sign are here too.',
    placement: 'right',
    ...theaterStep,
  },
  people,
  help,
];
