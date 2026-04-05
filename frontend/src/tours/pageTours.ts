import type { Step } from 'react-joyride';

/** Per-step defaults — all visual styling comes from tourStyles.ts */
const s = {};

// ── Dashboard Tour ─────────────────────────────────────────────────

export const dashboardTourSteps: Step[] = [
  {
    target: '[data-tour="dashboard-cards"]',
    title: 'Your Call Board',
    content: 'Everything you need at a glance. Each card is a sticky note pinned to the board. Click any card to jump into that section.',
    placement: 'bottom',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="dashboard-week-card"]',
    title: 'This Week',
    content: 'Your week at a glance — each day shows the rehearsal type and call time. Today is highlighted.',
    placement: 'bottom',
    ...s,
  },
  {
    target: '[data-tour="dashboard-status-card"]',
    title: 'Status & Conflicts',
    content: 'Key numbers: cast joined, conflicts submitted, next call, and opening night. For cast, this shows your info and lets you submit conflicts.',
    placement: 'bottom',
    ...s,
  },
  {
    target: '[data-tour="dashboard-announcements-card"]',
    title: 'Announcements',
    content: 'Recent bulletin posts from your director and stage manager. Click through to see the full board.',
    placement: 'bottom',
    ...s,
  },
  {
    target: '[data-tour="dashboard-schedule-card"]',
    title: 'Upcoming Rehearsals',
    content: 'Your next rehearsals with type and time. Click to jump to the full calendar.',
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
  {
    target: '[data-tour="schedule-pins"]',
    title: 'Pinned Announcements',
    content: 'Pinned bulletin posts show a pulsing dot on the day they were posted. Click the dot to jump straight to the pinned post.',
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
  {
    target: '[data-tour="schedule-pins"]',
    title: 'Pinned Announcements',
    content: 'A pulsing dot means a pinned bulletin post was added that day. Tap it to open the announcement.',
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
    content: 'Pinned posts stay at the top. You can pin multiple notes, edit, or delete any post from the controls at the bottom of each note.',
    placement: 'top',
    ...s,
  },
];

// ── Bulletin Tour (Cast, read-only) ─────────────────────────────────

export const bulletinCastTourSteps: Step[] = [
  {
    target: '[data-tour="bulletin-posts"]',
    title: 'Announcements',
    content: 'Your director and stage manager post here. Pinned notes are the most important and pulse on the schedule.',
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
    content: 'All your threads, sorted by most recent. Team messages group together at the top, direct messages sit below. Unread messages show a red badge.',
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
    content: 'Everyone listed by role. Each card shows conflict status and profile completion. Promote, demote, remove, or ban members from each card.',
    placement: 'top',
    ...s,
  },
];

// ── Account Tour ───────────────────────────────────────────────────

export const accountTourSteps: Step[] = [
  {
    target: '[data-tour="account-avatar"]',
    title: 'Choose Your Avatar',
    content: 'Pick a theater-themed icon or keep your initials. Your avatar shows up next to your name everywhere in the app.',
    placement: 'bottom',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="account-emergency"]',
    title: 'Emergency Contacts',
    content: 'Add at least one emergency contact. If you\'re under 18, this is required by law. Your director and staff can see these in case of an emergency.',
    placement: 'top',
    ...s,
  },
  {
    target: '[data-tour="account-notifications"]',
    title: 'Email Notifications',
    content: 'Toggle this to receive email updates for announcements, team messages, and conflict reminders. You can turn it off anytime.',
    placement: 'top',
    ...s,
  },
];

// ── Conflicts Tour (Cast) ───────────────────────────────────────────

export const conflictsTourSteps: Step[] = [
  {
    target: '[data-tour="conflicts-weekly"]',
    title: 'Start With Your Week',
    content: 'Tap any day of the week you\'re generally unavailable. Every rehearsal on that day gets marked as a conflict automatically. Most people start here.',
    placement: 'bottom',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="conflicts-specific-toggle"]',
    title: 'Fine-Tune Specific Dates',
    content: 'Have a one-off conflict? Click here to see every scheduled date and toggle individual ones on or off.',
    placement: 'bottom',
    ...s,
  },
  {
    target: '[data-tour="conflicts-submit"]',
    title: 'Submit Once',
    content: 'When you\'re done, hit Submit. Your director may give you extra submission windows if your schedule changes later.',
    placement: 'top',
    ...s,
  },
];

// ── Settings Tour (Director) ───────────────────────────────────────

export const settingsTourSteps: Step[] = [
  {
    target: '[data-tour="settings-conflict-windows"]',
    title: 'Conflict Windows',
    content: 'Set how many extra times cast can submit conflicts after their initial submission. 0 means one-and-done. Useful when the schedule changes mid-production.',
    placement: 'bottom',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="settings-danger"]',
    title: 'Danger Zone',
    content: 'Archive or delete the production. Archiving hides it from the dashboard but keeps the data. Deletion is permanent.',
    placement: 'top',
    ...s,
  },
];

// ── Teams Tour (Director/Staff) ────────────────────────────────────

export const teamsTourSteps: Step[] = [
  {
    target: '[data-tour="teams-create"]',
    title: 'Create a Team',
    content: 'Type a name and hit Create. You can make as many teams as you need — dancers, leads, ensemble, whatever fits your production.',
    placement: 'bottom',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="teams-list"]',
    title: 'Your Teams',
    content: 'All your teams show here with their member counts. Click the X to delete a team — members will just become unassigned.',
    placement: 'bottom',
    ...s,
  },
  {
    target: '[data-tour="teams-assign"]',
    title: 'Assign Cast to Teams',
    content: 'Click any cast member to cycle them through your teams. No team → first team → second team → no team, and so on. Changes are local until you hit Save.',
    placement: 'top',
    ...s,
  },
  {
    target: '[data-tour="teams-send-panel"]',
    title: 'Send to a Team',
    content: 'Inside a team, you can send a direct message to every member or post a bulletin announcement.',
    placement: 'top',
    ...s,
  },
  {
    target: '[data-tour="teams-send-toggle"]',
    title: 'Message vs Announcement',
    content: 'Choose Message to DM each member, or Announcement to post a bulletin visible to all.',
    placement: 'top',
    ...s,
  },
];
