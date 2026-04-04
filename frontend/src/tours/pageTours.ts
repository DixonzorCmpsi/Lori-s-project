import type { Step } from 'react-joyride';

/** Per-step defaults — all visual styling comes from tourStyles.ts */
const s = {
  skipBeacon: true,
};

// ── Dashboard Tour ─────────────────────────────────────────────────

export const dashboardTourSteps: Step[] = [
  {
    target: '[data-tour="dashboard-schedule-card"]',
    title: 'Upcoming Rehearsals',
    content: 'Your next rehearsals at a glance. Click to jump to the full calendar. Colors tell you the type: gold for rehearsal, blue for tech, purple for dress, red for performance.',
    placement: 'bottom',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="dashboard-status-card"]',
    title: 'Production Status',
    content: 'How many cast have joined, how many submitted conflicts, your next call, and opening night. Updates in real time as people join.',
    placement: 'bottom',
    ...s,
  },
  {
    target: '[data-tour="dashboard-announcements-card"]',
    title: 'Latest Announcements',
    content: 'Recent bulletin posts show up here. Click through to see the full board and post new ones.',
    placement: 'bottom',
    ...s,
  },
  {
    target: '[data-tour="dashboard-invite-card"]',
    title: 'Invite Link',
    content: 'Share this link with your cast to get them on the Call Board. They\'ll create an account, join the production, and submit their conflicts. Click "Copy Link" to grab it.',
    placement: 'bottom',
    ...s,
  },
  {
    target: '[data-tour="dashboard-week-card"]',
    title: 'This Week',
    content: 'A quick look at what\'s happening this week. Colored squares mean there\'s a call that day.',
    placement: 'bottom',
    ...s,
  },
  {
    target: '[data-tour="dashboard-quickactions-card"]',
    title: 'Quick Actions',
    content: 'Jump to any part of the Call Board from here. Schedule, bulletin, roster, or chat.',
    placement: 'bottom',
    ...s,
  },
];

// ── Schedule Tour (Director/Staff) ──────────────────────────────────

export const scheduleTourSteps: Step[] = [
  {
    target: '[data-tour="schedule-edit-btn"]',
    title: 'Edit the Schedule',
    content: 'Click to enter edit mode. Set a weekly pattern at the top (which days have rehearsals), then override individual dates below. Set default times and hit Apply.',
    placement: 'bottom',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="schedule-calendar"]',
    title: 'The Calendar',
    content: 'Each day shows a note with the rehearsal type and time. Click any day to see who\'s assigned and who has conflicts. In edit mode, click days to cycle through types.',
    placement: 'top',
    ...s,
  },
  {
    target: '[data-tour="schedule-legend"]',
    title: 'Color Key',
    content: 'Yellow = rehearsal, Blue = tech, Purple = dress, Pink = performance. These match the notes on each calendar day.',
    placement: 'top',
    ...s,
  },
];

// ── Schedule Tour (Cast) ────────────────────────────────────────────

export const scheduleCastTourSteps: Step[] = [
  {
    target: '[data-tour="schedule-calendar"]',
    title: 'Your Calendar',
    content: 'Days you\'re called for show colored notes with the type and time. Days marked with an X are off. Click any day to see details.',
    placement: 'top',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="schedule-legend"]',
    title: 'Color Key',
    content: 'Yellow = rehearsal, Blue = tech, Purple = dress, Pink = performance. Check the note on each day for your call time.',
    placement: 'top',
    ...s,
  },
];

// ── Bulletin Tour ───────────────────────────────────────────────────

export const bulletinTourSteps: Step[] = [
  {
    target: '[data-tour="bulletin-new-post"]',
    title: 'Post an Announcement',
    content: 'Write a title and body, then choose whether to notify the cast or post quietly. Every post goes up as a note on the board.',
    placement: 'bottom',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="bulletin-posts"]',
    title: 'The Board',
    content: 'Pinned posts stay at the top. You can pin, edit, or delete any post from the controls at the bottom of each note.',
    placement: 'top',
    ...s,
  },
];

// ── Bulletin Tour (Cast, read-only) ─────────────────────────────────

export const bulletinCastTourSteps: Step[] = [
  {
    target: '[data-tour="bulletin-posts"]',
    title: 'Announcements',
    content: 'Your director and stage manager post here. Pinned notes are the most important. Check back often for schedule changes and updates.',
    placement: 'top',
    skipBeacon: true,
    ...s,
  },
];

// ── Chat Tour ───────────────────────────────────────────────────────

export const chatTourSteps: Step[] = [
  {
    target: '[data-tour="chat-new-message"]',
    title: 'New Message',
    content: 'Pick someone from the contact list, type your message, send. Simple as that.',
    placement: 'bottom',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="chat-conversations"]',
    title: 'Your Conversations',
    content: 'All your threads, sorted by most recent. Unread messages show a red badge. Click to open.',
    placement: 'top',
    ...s,
  },
];

// ── Roster Tour ─────────────────────────────────────────────────────

export const rosterTourSteps: Step[] = [
  {
    target: '[data-tour="roster-invite"]',
    title: 'Invite Your Cast',
    content: 'Generate an invite link and share it. They\'ll create an account, join the production, and get prompted to submit their scheduling conflicts.',
    placement: 'right',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="roster-members"]',
    title: 'The Roster',
    content: 'Everyone listed by role. Each card shows conflict status. You can promote, demote, or remove people from here.',
    placement: 'top',
    ...s,
  },
];

// ── Conflicts Tour (Cast) ───────────────────────────────────────────

export const conflictsTourSteps: Step[] = [
  {
    target: '[data-tour="conflicts-date-list"]',
    title: 'Mark Your Conflicts',
    content: 'Click any date you can\'t make. It turns red. Add a reason if you want (like "work" or "family"). Only mark dates you truly cannot attend.',
    placement: 'top',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="conflicts-submit"]',
    title: 'Submit Once',
    content: 'When you\'re done, hit Submit. This is a one-time submission, you can\'t change it after, so double-check everything first.',
    placement: 'top',
    ...s,
  },
];
