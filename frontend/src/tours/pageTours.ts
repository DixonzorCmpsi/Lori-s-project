import type { Step } from 'react-joyride';

/** Per-step defaults — only skipBeacon; all visual styling comes from tourStyles.ts */
const s = {
  skipBeacon: true,
};

// ── Dashboard Tour ─────────────────────────────────────────────────

export const dashboardTourSteps: Step[] = [
  {
    target: '[data-tour="dashboard-schedule-card"]',
    title: 'Rehearsal Schedule',
    content: 'This yellow sticky shows your upcoming rehearsals. Click it to jump to the full schedule calendar. Color dots indicate the type: gold for regular, blue for tech, purple for dress, red for performances.',
    placement: 'bottom',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="dashboard-status-card"]',
    title: 'Production Status',
    content: 'Quick stats at a glance: how many cast have joined, how many submitted conflicts, your next call date, and opening night. This updates in real time as people join and submit.',
    placement: 'bottom',
    ...s,
  },
  {
    target: '[data-tour="dashboard-announcements-card"]',
    title: 'Announcements',
    content: 'Recent bulletin posts appear here. Click to go to the full bulletin board where you can read everything and post new announcements.',
    placement: 'bottom',
    ...s,
  },
  {
    target: '[data-tour="dashboard-invite-card"]',
    title: 'Cast Invite Link',
    content: 'Share this link with your cast to let them join the production. Click "Copy Link" to put it on your clipboard. The link expires after 30 days or 100 uses.',
    placement: 'bottom',
    ...s,
  },
  {
    target: '[data-tour="dashboard-week-card"]',
    title: 'This Week',
    content: 'A quick view of what\'s happening this week. Colored squares mean there\'s a rehearsal that day. Click to jump to the full calendar.',
    placement: 'bottom',
    ...s,
  },
  {
    target: '[data-tour="dashboard-quickactions-card"]',
    title: 'Quick Actions',
    content: 'Jump to any section of the app from here. View schedule, post on the bulletin, manage your roster, or open chat.',
    placement: 'bottom',
    ...s,
  },
];

// ── Schedule Tour (Director/Staff) ──────────────────────────────────

export const scheduleTourSteps: Step[] = [
  {
    target: '[data-tour="schedule-edit-btn"]',
    title: 'Edit Your Schedule',
    content: 'Click this to enter edit mode. You\'ll see a weekly pattern toolbar at the top where you set which days of the week have rehearsals (Mon/Wed/Fri, for example). Then you can override individual dates below.',
    placement: 'bottom',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="schedule-calendar"]',
    title: 'The Calendar',
    content: 'Each day shows a colored sticky note with the rehearsal type and time. Click any day to see details, including who\'s assigned and who has conflicts. In edit mode, click days to cycle through types: Rehearsal, Tech, Dress, Performance, Blocked, or Off.',
    placement: 'top',
    ...s,
  },
  {
    target: '[data-tour="schedule-legend"]',
    title: 'Color Legend',
    content: 'These gaffer tape strips show what each color means. Yellow = regular rehearsal, Blue = tech, Purple = dress, Pink = performance. The colors match the sticky notes on each calendar day.',
    placement: 'top',
    ...s,
  },
];

// ── Schedule Tour (Cast) ────────────────────────────────────────────

export const scheduleCastTourSteps: Step[] = [
  {
    target: '[data-tour="schedule-calendar"]',
    title: 'Your Rehearsal Calendar',
    content: 'Days you\'re called for show colored sticky notes with the type and time. Days marked with an X are blocked (no rehearsal). Click any day to see the full details for that date.',
    placement: 'top',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="schedule-legend"]',
    title: 'What the Colors Mean',
    content: 'Yellow = regular rehearsal, Blue = tech rehearsal, Purple = dress rehearsal, Pink = performance. Check your call time on each day\'s sticky note.',
    placement: 'top',
    ...s,
  },
];

// ── Bulletin Tour ───────────────────────────────────────────────────

export const bulletinTourSteps: Step[] = [
  {
    target: '[data-tour="bulletin-new-post"]',
    title: 'Post an Announcement',
    content: 'Click here to create a new announcement. You can add a title and body, then choose whether to notify all members or post silently.',
    placement: 'bottom',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="bulletin-posts"]',
    title: 'Announcements Board',
    content: 'Each post appears as a sticky note on the chalkboard. Pinned posts (marked with a yellow note) stay at the top. You can pin, edit, or delete any post using the controls at the bottom of each note.',
    placement: 'top',
    ...s,
  },
];

// ── Bulletin Tour (Cast, read-only) ─────────────────────────────────

export const bulletinCastTourSteps: Step[] = [
  {
    target: '[data-tour="bulletin-posts"]',
    title: 'Announcements',
    content: 'Your director and stage manager post announcements here. Pinned posts (in yellow) are the most important. Check back regularly for updates about rehearsals, schedule changes, and company news.',
    placement: 'top',
    skipBeacon: true,
    ...s,
  },
];

// ── Chat Tour ───────────────────────────────────────────────────────

export const chatTourSteps: Step[] = [
  {
    target: '[data-tour="chat-new-message"]',
    title: 'Start a Conversation',
    content: 'Click here to message someone. You\'ll see a contact picker with everyone you can message. Pick a person, type your message, and send.',
    placement: 'bottom',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="chat-conversations"]',
    title: 'Your Conversations',
    content: 'All your ongoing conversations appear here, sorted by most recent. Unread messages show a red badge with the count. Click any conversation to open it.',
    placement: 'top',
    ...s,
  },
];

// ── Roster Tour ─────────────────────────────────────────────────────

export const rosterTourSteps: Step[] = [
  {
    target: '[data-tour="roster-invite"]',
    title: 'Invite Cast Members',
    content: 'Generate an invite link and share it with your cast. They\'ll create an account, join the production, and be prompted to submit their scheduling conflicts right away.',
    placement: 'right',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="roster-members"]',
    title: 'Production Roster',
    content: 'All members are listed by role: Directors, Staff, then Cast. Each card shows their conflict status (submitted or pending). As director, you can promote cast to staff, demote staff, or remove members from the production.',
    placement: 'top',
    ...s,
  },
];

// ── Conflicts Tour (Cast) ───────────────────────────────────────────

export const conflictsTourSteps: Step[] = [
  {
    target: '[data-tour="conflicts-date-list"]',
    title: 'Mark Your Unavailable Dates',
    content: 'Click any date you CANNOT attend. It\'ll turn red. You can optionally add a reason (like "work" or "family event"). Only mark dates you truly can\'t make.',
    placement: 'top',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="conflicts-submit"]',
    title: 'Submit Once',
    content: 'When you\'re done selecting all your conflicts, hit Submit. This is a one-time submission. You cannot change your conflicts after submitting, so make sure you\'ve marked everything.',
    placement: 'top',
    ...s,
  },
];
