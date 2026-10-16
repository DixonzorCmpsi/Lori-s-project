import type { Step } from 'react-joyride';

/**
 * Page tours. Wording is plain and does not depend on the theme, so it reads the same in
 * Default and Fancy. Steps whose target is not on screen (for example a staff-only button
 * for a cast member) are skipped automatically by PageTour.
 */
const s = {};

// ── Dashboard ──────────────────────────────────────────────────────

export const dashboardTourSteps: Step[] = [
  {
    target: '[data-tour="dashboard-attention"]',
    title: 'Start here every day',
    content: 'Your next call and everything waiting on you: announcements to confirm, forms to sign, and for staff, who is running late or has not confirmed yet. Each row has a button that takes you straight there.',
    placement: 'bottom',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="dashboard-cards"]',
    title: 'Your production at a glance',
    content: 'These cards summarize the rehearsal schedule, status, announcements and your week. Click any card to open that section.',
    placement: 'top',
    ...s,
  },
  {
    target: '[data-tour="dashboard-week-card"]',
    title: 'This week',
    content: 'Each day shows the type of rehearsal and the call time. Today is highlighted.',
    placement: 'top',
    ...s,
  },
  {
    target: '[data-tour="dashboard-status-card"]',
    title: 'Status and conflicts',
    content: 'Cast joined, conflicts submitted, next call and opening night. For cast, this card is “My Info” and has the button to submit conflicts.',
    placement: 'top',
    ...s,
  },
  {
    target: '[data-tour="dashboard-announcements-card"]',
    title: 'Announcements',
    content: 'The latest posts from your director and stage manager. Click through for the full bulletin.',
    placement: 'top',
    ...s,
  },
];

// ── Schedule ───────────────────────────────────────────────────────

export const scheduleTourSteps: Step[] = [
  {
    target: '[data-tour="schedule-calendar-link"]',
    title: 'Put your calls on your phone',
    content: 'Subscribe once and your own calendar app shows your calls, and updates by itself when the schedule changes. You get a private link; keep it to yourself.',
    placement: 'bottom',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="schedule-edit-btn"]',
    title: 'Edit the schedule',
    content: 'Click to change the schedule. Pick which weekdays have rehearsals, then adjust individual dates, set default times, and press Apply.',
    placement: 'bottom',
    ...s,
  },
  {
    target: '[data-tour="schedule-calendar"]',
    title: 'The calendar',
    content: 'Each rehearsal shows its type and time. Click a day to see its notes and location, who has conflicts, and to assign cast. Only people you assign to a date are called; with nobody assigned, the whole cast is called.',
    placement: 'top',
    ...s,
  },
  {
    target: '[data-tour="schedule-legend"]',
    title: 'Color key',
    content: 'Yellow is rehearsal, blue is tech, purple is dress and pink is a performance.',
    placement: 'top',
    ...s,
  },
  {
    target: '[data-tour="schedule-pins"]',
    title: 'Pinned announcements',
    content: 'A pulsing dot on a day means a pinned announcement was posted. Click the dot to open it.',
    placement: 'top',
    ...s,
  },
];

export const scheduleCastTourSteps: Step[] = [
  {
    target: '[data-tour="schedule-calendar-link"]',
    title: 'Put your calls on your phone',
    content: 'Subscribe once and your own calendar app shows your calls and updates by itself when plans change. You get a private link; keep it to yourself.',
    placement: 'bottom',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="schedule-calendar"]',
    title: 'Your calendar',
    content: 'Every rehearsal shows its type and time. Click a day for the details. Days marked with an X are days off.',
    placement: 'top',
    ...s,
  },
  {
    target: '[data-tour="schedule-legend"]',
    title: 'Color key',
    content: 'Yellow is rehearsal, blue is tech, purple is dress and pink is a performance.',
    placement: 'top',
    ...s,
  },
  {
    target: '[data-tour="schedule-pins"]',
    title: 'Pinned announcements',
    content: 'A pulsing dot means a pinned announcement was posted that day. Tap it to read it.',
    placement: 'top',
    ...s,
  },
];

// ── Call sheet ─────────────────────────────────────────────────────

export const callSheetStaffTourSteps: Step[] = [
  {
    target: '[data-tour="callsheet-picker"]',
    title: 'Pick a rehearsal',
    content: 'It opens on the next upcoming call. Use the list, or the Earlier and Later buttons, to look at any other day.',
    placement: 'bottom',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="callsheet-details"]',
    title: 'The call',
    content: 'Time, type, location and notes. “Edit location and note” changes them for everyone. A yellow warning appears here if a room or a person is double-booked.',
    placement: 'bottom',
    ...s,
  },
  {
    target: '[data-tour="callsheet-list"]',
    title: 'Who is called',
    content: 'Mark each person Present, Late, Absent or Excused. You can mark people before they arrive. Coloured tags show who told you they will be late or absent, and who submitted a conflict for the day.',
    placement: 'top',
    ...s,
  },
  {
    target: '[data-tour="callsheet-tabs"]',
    title: 'Attendance report',
    content: 'Switch to the report for each person’s totals across all past rehearsals. Excused absences are left out of the percentage.',
    placement: 'bottom',
    ...s,
  },
];

export const callSheetCastTourSteps: Step[] = [
  {
    target: '[data-tour="callsheet-picker"]',
    title: 'Pick a rehearsal',
    content: 'It opens on your next call. Use the list to look at any other day.',
    placement: 'bottom',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="callsheet-mycall"]',
    title: 'Your call',
    content: 'Tap “I’m here” when you arrive. Running late or can’t come? Tell the stage manager here before the rehearsal, and they are told straight away.',
    placement: 'bottom',
    ...s,
  },
  {
    target: '[data-tour="callsheet-called"]',
    title: 'Who else is called',
    content: 'Everyone called for this rehearsal. You can see names only. Attendance is private to the director and staff.',
    placement: 'top',
    ...s,
  },
];

// ── Scenes ─────────────────────────────────────────────────────────

export const scenesTourSteps: Step[] = [
  {
    target: '[data-tour="scenes-add"]',
    title: 'Add a scene',
    content: 'Name each scene the way your script does, for example “Act 1, Scene 2”.',
    placement: 'bottom',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="scenes-free"]',
    title: 'Who is free?',
    content: 'Pick a rehearsal date. Each scene below turns green, yellow or red depending on how many of its cast submitted a conflict for that day.',
    placement: 'bottom',
    ...s,
  },
  {
    target: '[data-tour="scenes-list"]',
    title: 'Cast each scene',
    content: 'Add cast to a scene and type their character name. Cast with a conflict on the chosen day are tagged “Away”.',
    placement: 'top',
    ...s,
  },
];

// ── Reports ────────────────────────────────────────────────────────

export const reportsTourSteps: Step[] = [
  {
    target: '[data-tour="reports-new"]',
    title: 'Write a report',
    content: 'After rehearsal, write the day’s notes for each department. “Insert late and absent” fills in attendance for you. Choose who receives it, then save a draft or send it by email.',
    placement: 'bottom',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="reports-list"]',
    title: 'Your reports',
    content: 'Open one to see who has confirmed they read it. Drafts can be edited until you send them.',
    placement: 'top',
    ...s,
  },
];

// ── Bulletin ───────────────────────────────────────────────────────

export const bulletinTourSteps: Step[] = [
  {
    target: '[data-tour="bulletin-new-post"]',
    title: 'Post an announcement',
    content: 'Write a title and message. Tick “Notify members” to email it, and “Ask everyone to confirm they have read it” for anything important, so you can see who still has not.',
    placement: 'bottom',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="bulletin-posts"]',
    title: 'The board',
    content: 'Pinned posts stay at the top. On a post that asks for confirmation, click “confirmed” to see who has and has not, and send a reminder to those who have not.',
    placement: 'top',
    ...s,
  },
];

export const bulletinCastTourSteps: Step[] = [
  {
    target: '[data-tour="bulletin-posts"]',
    title: 'Announcements',
    content: 'Your director and stage manager post here. Pinned posts matter most. If a post says “I’ve read this”, tap it so they know you saw it.',
    placement: 'top',
    skipBeacon: true,
    ...s,
  },
];

// ── Chat ───────────────────────────────────────────────────────────

export const chatTourSteps: Step[] = [
  {
    target: '[data-tour="chat-new-message"]',
    title: 'New message',
    content: 'Pick a person, type your message and send. Cast can message staff and the cast on their own team.',
    placement: 'bottom',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="chat-conversations"]',
    title: 'Your conversations',
    content: 'Newest first. Team messages are grouped together and direct messages sit below. A badge shows how many are unread. Messages are kept as a record and can’t be deleted.',
    placement: 'top',
    ...s,
  },
];

// ── Members ────────────────────────────────────────────────────────

export const rosterTourSteps: Step[] = [
  {
    target: '[data-tour="roster-invite"]',
    title: 'Invite your cast',
    content: 'Copy the link and send it. People create an account, join, and are asked for their conflicts. “Regen” makes a new link and stops the old one working.',
    placement: 'bottom',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="roster-members"]',
    title: 'Everyone in the production',
    content: 'Listed by role. Each person shows whether their conflicts are in. “Make staff” gives a cast member the stage manager’s tools. “Remove” takes them out (they can rejoin). “Block” also stops them rejoining. Hover a button for a reminder of what it does.',
    placement: 'top',
    ...s,
  },
];

export const teamsTourSteps: Step[] = [
  {
    target: '[data-tour="teams-create"]',
    title: 'Create a team',
    content: 'Type a name and press Create. Make as many as you need: dancers, leads, ensemble.',
    placement: 'bottom',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="teams-list"]',
    title: 'Your teams',
    content: 'Each team shows its size. Click ✕ to delete one; its members just become unassigned.',
    placement: 'bottom',
    ...s,
  },
  {
    target: '[data-tour="teams-assign"]',
    title: 'Assign cast to teams',
    content: 'Click a cast member to move them through your teams: none, first team, second team, and round again. Changes are saved when you press Save.',
    placement: 'top',
    ...s,
  },
  {
    target: '[data-tour="teams-send-panel"]',
    title: 'Send to a team',
    content: 'Open a team to message every member at once or post an announcement just for them. Cast on the same team can message each other.',
    placement: 'top',
    ...s,
  },
  {
    target: '[data-tour="teams-send-toggle"]',
    title: 'Message or announcement',
    content: 'Message sends a private chat to each member. Announcement posts to the bulletin board for the team.',
    placement: 'top',
    ...s,
  },
];

// ── Sign-ups ───────────────────────────────────────────────────────

export const signupsStaffTourSteps: Step[] = [
  {
    target: '[data-tour="signups-new"]',
    title: 'Post an open call',
    content: 'Need strike crew or box office help? Post a slot with a date, time, place and number of spots. People sign themselves up.',
    placement: 'bottom',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="signups-list"]',
    title: 'Slots and who is in them',
    content: '“2 of 4 filled” means two spots are taken. Remove someone with ✕, or edit and delete the slot. People are warned if a slot overlaps their own rehearsal.',
    placement: 'top',
    ...s,
  },
];

export const signupsCastTourSteps: Step[] = [
  {
    target: '[data-tour="signups-list"]',
    title: 'Jobs that need volunteers',
    content: 'Tap “Sign me up” on a slot that suits you. “2 of 4 filled” means two spots are taken. Change your mind? Tap “Withdraw” and the spot goes back to everyone. You will get a warning if a slot overlaps one of your rehearsals.',
    placement: 'top',
    skipBeacon: true,
    ...s,
  },
];

// ── Documents ──────────────────────────────────────────────────────

export const documentsTourSteps: Step[] = [
  {
    target: '[data-tour="docs-tabs"]',
    title: 'Files and forms',
    content: 'Files are scripts, music and handbooks. Forms are permission slips and waivers that people sign on screen.',
    placement: 'bottom',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="docs-upload"]',
    title: 'Share a file',
    content: 'Choose a file up to 10 MB, give it a title and a category, and press Upload. Everyone in the production can then open it.',
    placement: 'bottom',
    ...s,
  },
  {
    target: '[data-tour="docs-list"]',
    title: 'Read it right here',
    content: '“View” opens the file in a pop-up, no download needed. It works for PDF, Word, Excel, text, Markdown, pictures, audio and video. “Download” saves a copy.',
    placement: 'top',
    ...s,
  },
];

export const formsTourSteps: Step[] = [
  {
    target: '[data-tour="docs-tabs"]',
    title: 'Files and forms',
    content: 'You are on Forms. Switch to Files for scripts, music and handbooks.',
    placement: 'bottom',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="forms-new"]',
    title: 'Create a form',
    content: 'Write what people agree to, choose who signs, and ask for a parent or guardian for members under 18. Once anyone signs, the text is locked, so what they agreed to is always on record.',
    placement: 'bottom',
    ...s,
  },
  {
    target: '[data-tour="forms-list"]',
    title: 'Sign or follow up',
    content: 'Cast: press “Read and sign”, type your full name and tick the box. Staff: “Who signed” shows who is still outstanding and sends a reminder.',
    placement: 'top',
    ...s,
  },
];

// ── Account ────────────────────────────────────────────────────────

export const accountTourSteps: Step[] = [
  {
    target: '[data-tour="account-appearance"]',
    title: 'Choose your look',
    content: 'Pick Default (clean and modern) or Fancy (the original theater look), and light or dark. It only changes how the app looks for you.',
    placement: 'bottom',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="account-avatar"]',
    title: 'Choose your avatar',
    content: 'Pick an icon or keep your initials. It appears next to your name throughout the app.',
    placement: 'bottom',
    ...s,
  },
  {
    target: '[data-tour="account-emergency"]',
    title: 'Emergency contacts',
    content: 'Add at least one. It is required if you are under 18. Your director and staff can see these if there is an emergency.',
    placement: 'top',
    ...s,
  },
  {
    target: '[data-tour="account-notifications"]',
    title: 'Email notifications',
    content: 'Turn this on for emails about announcements, reminders and messages. You can turn it off any time.',
    placement: 'top',
    ...s,
  },
];

// ── Conflicts (cast) ───────────────────────────────────────────────

export const conflictsTourSteps: Step[] = [
  {
    target: '[data-tour="conflicts-weekly"]',
    title: 'Start with your week',
    content: 'Tap any day of the week you are usually unavailable. Every rehearsal on that day is marked as a conflict for you. Most people start here.',
    placement: 'bottom',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="conflicts-specific-toggle"]',
    title: 'Fine-tune specific dates',
    content: 'Have a one-off conflict? Open the list of every scheduled date and switch individual ones on or off.',
    placement: 'bottom',
    ...s,
  },
  {
    target: '[data-tour="conflicts-submit"]',
    title: 'Submit once',
    content: 'When you are done, press Submit. After that, only your director can reset it. For a single missed rehearsal, use the Call Sheet instead.',
    placement: 'top',
    ...s,
  },
];

// ── Settings (director) ────────────────────────────────────────────

export const settingsTourSteps: Step[] = [
  {
    target: '[data-tour="settings-conflict-windows"]',
    title: 'Conflict windows',
    content: 'Everyone gets one conflict submission. Raise this number to let cast resubmit later, for example when the schedule changes. 0 means one only.',
    placement: 'bottom',
    skipBeacon: true,
    ...s,
  },
  {
    target: '[data-tour="settings-danger"]',
    title: 'Archive or delete',
    content: 'Archiving closes the production and makes it read-only, with nothing lost. Deleting is permanent.',
    placement: 'top',
    ...s,
  },
];
