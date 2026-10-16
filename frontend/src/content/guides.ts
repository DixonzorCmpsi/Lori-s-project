/**
 * Plain-language help for every page, written for someone opening the app for the first time.
 * Each page says what it is for, what the signed-in person can do, and what they cannot.
 * Edit the words here; the pages and the Help page both read from this file.
 */

export type GuideRole = 'director' | 'staff' | 'cast';

export interface Guide {
  /** One sentence: what this page is for. */
  what: string;
  can: string[];
  /** Things this person cannot do here, and who can. Leave empty when there is no limit. */
  cannot?: string[];
  tip?: string;
}

export type GuideId =
  | 'dashboard' | 'schedule' | 'callsheet' | 'scenes' | 'reports' | 'bulletin' | 'chat'
  | 'members' | 'teams' | 'signups' | 'files' | 'forms' | 'settings' | 'conflicts' | 'account';

type Guides = Record<GuideId, Partial<Record<GuideRole, Guide>>>;

const staffCannotManagePeople = 'Add, remove or block people, or invite new ones. Only the director does that.';

export const GUIDES: Guides = {
  dashboard: {
    director: {
      what: 'Your home screen. It shows what needs you today: your next call, anyone who said they will be late, and things people have not confirmed or signed yet.',
      can: [
        'Open your next rehearsal’s call sheet to see who is here.',
        'See who has told you they will be late or can’t come.',
        'See which announcements and forms people still need to confirm or sign, then follow up.',
        'Click any card to jump to that part of the app.',
      ],
      tip: 'Start each day here, then open the Call Sheet.',
    },
    staff: {
      what: 'Your home screen. It shows what needs you today: your next call, anyone who said they will be late, and things people have not confirmed or signed yet.',
      can: [
        'Open your next rehearsal’s call sheet to see who is here.',
        'See who has told you they will be late or can’t come.',
        'See what people still need to confirm or sign.',
      ],
      cannot: ['Change production settings. Only the director does that.'],
      tip: 'Start each day here, then open the Call Sheet.',
    },
    cast: {
      what: 'Your home screen. It shows your next call and anything waiting on you.',
      can: [
        'Tap “I’m here” to check in when you arrive.',
        'Tell the stage manager you will be late or can’t come.',
        'Confirm announcements and sign forms that need you.',
        'See this week’s rehearsals at a glance.',
      ],
      cannot: ['Change the schedule or anything else for the company. Ask your director or stage manager.'],
    },
  },

  schedule: {
    director: {
      what: 'The rehearsal calendar for the whole production.',
      can: [
        'Click a day to see its notes, location and who submitted conflicts.',
        'Choose “Edit Schedule” to add, move, cancel or delete rehearsals.',
        'Assign cast to a date. Only assigned people are called. With nobody assigned, the whole cast is called.',
        'Add your calls to your own phone or computer calendar with “Add to my calendar”.',
      ],
      tip: 'A yellow warning at the top means a room or a person is booked twice. Click “Show details”.',
    },
    staff: {
      what: 'The rehearsal calendar for the whole production.',
      can: [
        'Click a day to see its notes, location and who submitted conflicts.',
        'Choose “Edit Schedule” to add, move, cancel or delete rehearsals.',
        'Assign cast to a date. Only assigned people are called. With nobody assigned, the whole cast is called.',
        'Add your calls to your own calendar with “Add to my calendar”.',
      ],
    },
    cast: {
      what: 'Every rehearsal, with the ones you are called for highlighted.',
      can: [
        'Click a day to see the time, place and notes.',
        'Use “Add to my calendar” so your phone shows your calls and updates when plans change.',
      ],
      cannot: ['Change rehearsals. Ask your director or stage manager.'],
    },
  },

  callsheet: {
    director: {
      what: 'The paper sign-in sheet and daily call, on one page. Pick a rehearsal to see who is called and who has arrived.',
      can: [
        'Mark each person Present, Late, Absent or Excused. You can mark before they arrive.',
        'See notices where cast said they will be late or can’t come.',
        'Change the location and the note for this call.',
        'Open “Attendance report” for each person’s totals.',
      ],
      tip: '“Excused” does not count against someone’s attendance percentage.',
    },
    staff: {
      what: 'The paper sign-in sheet and daily call, on one page. Pick a rehearsal to see who is called and who has arrived.',
      can: [
        'Mark each person Present, Late, Absent or Excused. You can mark before they arrive.',
        'See notices where cast said they will be late or can’t come.',
        'Change the location and the note for this call.',
        'Open “Attendance report” for each person’s totals.',
      ],
    },
    cast: {
      what: 'Your call for a rehearsal, and who else is called.',
      can: [
        'Tap “I’m here” when you arrive.',
        'Tell the stage manager you will be late or can’t come, before the rehearsal.',
        'See who else is called.',
      ],
      cannot: ['See anyone else’s attendance, or mark attendance. Only the director and staff can.'],
    },
  },

  scenes: {
    director: {
      what: 'Break the show into scenes and cast them, so you can see who is needed when.',
      can: [
        'Add scenes, then add cast to each with their character name.',
        'Pick a rehearsal date under “Who is free?” to see which scenes work that day.',
        'Rename or delete a scene.',
      ],
      tip: 'Green means everyone in the scene is free. Yellow means one or two are away. Red means three or more are away.',
    },
    staff: {
      what: 'Break the show into scenes and cast them, so you can see who is needed when.',
      can: [
        'Add scenes, then add cast to each with their character name.',
        'Pick a rehearsal date under “Who is free?” to see which scenes work that day.',
      ],
      tip: 'Green means everyone in the scene is free. Yellow means one or two are away. Red means three or more are away.',
    },
    cast: {
      what: 'Which scenes you are in, and who you share them with.',
      can: ['Look up who is in each scene and which character they play.'],
      cannot: ['Change scenes or casting. Only the director and staff can.'],
    },
  },

  reports: {
    director: {
      what: 'The stage manager’s end-of-day report: what happened in rehearsal, split by department, sent to the people who need it.',
      can: [
        'Write a report with a section for each department (props, costumes, sound, lights and more).',
        'Pull in who was late or absent with “Insert late and absent”.',
        'Choose who receives it, save a draft, or send it by email.',
        'See who has confirmed they read it.',
      ],
      tip: 'Only people on the list you pick can read a report. Cast see it only if you add them.',
    },
    staff: {
      what: 'The stage manager’s end-of-day report: what happened in rehearsal, split by department, sent to the people who need it.',
      can: [
        'Write a report with a section for each department.',
        'Pull in who was late or absent with “Insert late and absent”.',
        'Choose who receives it, save a draft, or send it by email.',
        'See who has confirmed they read it.',
      ],
      cannot: ['Delete a report someone else wrote. Only its author or the director can.'],
    },
    cast: {
      what: 'Reports you were sent.',
      can: ['Read a report and tap “I’ve read this” so the stage manager knows.'],
      cannot: ['See reports you were not sent, or write reports.'],
    },
  },

  bulletin: {
    director: {
      what: 'Announcements for the whole company, like the callboard backstage.',
      can: [
        'Post an announcement. Tick “Notify members” to email it.',
        'Tick “Ask everyone to confirm they have read it” for important notices, then see who has not and send a reminder.',
        'Pin a post to keep it at the top, edit it, or delete it.',
      ],
    },
    staff: {
      what: 'Announcements for the whole company, like the callboard backstage.',
      can: [
        'Post an announcement. Tick “Notify members” to email it.',
        'Ask everyone to confirm they have read important notices, then send a reminder to those who have not.',
        'Pin posts, and edit or delete your own posts.',
      ],
      cannot: ['Edit or delete the director’s posts.'],
    },
    cast: {
      what: 'Announcements from your director and stage manager.',
      can: [
        'Read the latest news. Pinned notes are the most important.',
        'Tap “I’ve read this” when a post asks you to confirm.',
      ],
      cannot: ['Post announcements.'],
    },
  },

  chat: {
    director: {
      what: 'Private messages inside the production.',
      can: ['Message anyone in the production, one-to-one.', 'Message a whole team from Members → Manage.'],
      tip: 'Messages can’t be deleted. They are kept as a record.',
    },
    staff: {
      what: 'Private messages inside the production.',
      can: ['Message anyone in the production, one-to-one.', 'Message a whole team from Members → Manage.'],
      tip: 'Messages can’t be deleted. They are kept as a record.',
    },
    cast: {
      what: 'Private messages inside the production.',
      can: ['Message your director and the stage managers.', 'Message the cast who are on your team.'],
      cannot: ['Message cast members who are not on your team. This keeps young cast members safe.'],
      tip: 'Messages can’t be deleted. They are kept as a record.',
    },
  },

  members: {
    director: {
      what: 'Everyone in the production, and where each person stands.',
      can: [
        'Copy the invite link to bring cast in. A link works for up to 100 people and expires after 3 months.',
        'See who has submitted their conflicts (“Conflicts submitted”) and who has not (“Conflicts not in yet”).',
        '“Make staff” gives a cast member the stage manager’s tools. “Make cast” takes them away.',
        '“Remove” takes someone out. They can rejoin with the invite link. “Block” removes them and stops them rejoining.',
        'Open the Manage tab to organize cast into teams.',
      ],
      tip: '“Age not given” means that person has not entered their birth year yet. It is needed for under-18 safety rules.',
    },
    staff: {
      what: 'Everyone in the production, and where each person stands.',
      can: [
        'See who has submitted their conflicts and who has not.',
        'Open the Manage tab to organize cast into teams and message a team.',
      ],
      cannot: [staffCannotManagePeople],
    },
    cast: {
      what: 'The company list: who is in this production and what role each person has.',
      can: ['See who is in the production.'],
      cannot: ['Change anyone’s role or remove people.'],
    },
  },

  teams: {
    director: {
      what: 'Groups of cast, such as “Ensemble” or “Act 2 dancers”, so you can assign and message them together.',
      can: [
        'Create a team, then click a cast member to move them between teams.',
        'Message a team, or post an announcement to just that team.',
        'Assign a whole team to a rehearsal on the Schedule page.',
      ],
      tip: 'Cast on the same team can message each other.',
    },
    staff: {
      what: 'Groups of cast, such as “Ensemble” or “Act 2 dancers”, so you can assign and message them together.',
      can: [
        'Create a team, then click a cast member to move them between teams.',
        'Message a team, or post an announcement to just that team.',
      ],
      tip: 'Cast on the same team can message each other.',
    },
  },

  signups: {
    director: {
      what: 'Open calls for jobs that need volunteers, such as strike crew or box office. People pick a slot that suits them.',
      can: [
        'Post a slot with a date, time, place and number of spots. “2 of 4 filled” means two spots are taken.',
        'Remove someone from a slot with ✕, or edit or delete the slot.',
        'Sign yourself up too.',
      ],
      tip: 'When someone signs up for a time that overlaps their own rehearsal, the app warns them first.',
    },
    staff: {
      what: 'Open calls for jobs that need volunteers, such as strike crew or box office. People pick a slot that suits them.',
      can: [
        'Post a slot with a date, time, place and number of spots. “2 of 4 filled” means two spots are taken.',
        'Remove someone from a slot with ✕, or edit or delete the slot.',
      ],
    },
    cast: {
      what: 'Jobs that need volunteers. Pick a slot that suits you.',
      can: [
        'Tap “Sign me up” on a slot that has spots left. “2 of 4 filled” means two spots are taken.',
        'Tap “Withdraw” if your plans change. The spot goes back to everyone.',
      ],
      cannot: ['Create or change slots. Only the director and staff can.'],
      tip: 'If a slot overlaps one of your rehearsals, you will see a warning before you sign up.',
    },
  },

  files: {
    director: {
      what: 'Scripts, music tracks, handbooks and other files for the whole company.',
      can: [
        'Add a file (up to 10 MB). Everyone in the production can then view and download it.',
        'Click “View” to read a file in a pop-up. Works for PDF, Word, Excel, text, Markdown, pictures, audio and video.',
        'Delete a file you no longer want shared.',
      ],
      tip: 'PowerPoint and old .doc files can’t be previewed. People can still download them.',
    },
    staff: {
      what: 'Scripts, music tracks, handbooks and other files for the whole company.',
      can: [
        'Add a file (up to 10 MB). Everyone in the production can then view and download it.',
        'Click “View” to read a file in a pop-up, or “Download” to keep a copy.',
        'Delete a file you no longer want shared.',
      ],
      tip: 'PowerPoint and old .doc files can’t be previewed. People can still download them.',
    },
    cast: {
      what: 'Scripts, music, handbooks and other files shared by your director.',
      can: [
        'Click “View” to read a file in a pop-up without leaving the app.',
        'Click “Download” to keep a copy on your device.',
      ],
      cannot: ['Add or delete files. Only the director and staff can.'],
    },
  },

  forms: {
    director: {
      what: 'Permission slips, waivers and policies that people sign on screen by typing their name.',
      can: [
        'Create a form, choose who must sign (everyone or cast only), and ask for a parent or guardian’s name for members under 18.',
        'Click “Who signed” to see who has and who has not, and send a reminder.',
        'Archive a form to close it. Once anyone has signed, its text can no longer change.',
      ],
      tip: 'To change a signed form, archive it and publish a new one. That keeps a true record of what each person agreed to.',
    },
    staff: {
      what: 'Permission slips, waivers and policies that people sign on screen by typing their name.',
      can: [
        'Create a form and choose who must sign.',
        'Click “Who signed” to see who has and who has not, and send a reminder.',
        'Archive a form to close it.',
      ],
      tip: 'Once anyone has signed a form, its text can no longer change.',
    },
    cast: {
      what: 'Forms your director needs you to sign, such as a photo release.',
      can: [
        'Click “Read and sign”, read the form, type your full name and tick the box.',
        'If you are under 18, add a parent or guardian’s name and email.',
      ],
      cannot: ['Change a form, or undo a signature once you sign.'],
    },
  },

  settings: {
    director: {
      what: 'The production’s details and the rules that apply to everyone.',
      can: [
        'Set how many extra times cast can resubmit their conflicts.',
        'Extend the run if closing night has passed.',
        'Archive the production when it is over, which makes it read-only. Delete it only if you are sure.',
      ],
    },
    staff: {
      what: 'The production’s details.',
      can: ['See the production’s dates and status.'],
      cannot: ['Change settings, archive or delete the production. Only the director can.'],
    },
  },

  conflicts: {
    cast: {
      what: 'Tell your director which dates you can’t make, once, before the schedule is finalized.',
      can: [
        'Pick the days of the week you are usually unavailable, then fine-tune specific dates.',
        'Add a reason if you like. Only the director and staff see it.',
      ],
      cannot: ['Edit your conflicts after you submit. Ask your director to reset them if something changes.'],
      tip: 'Late or absent for one rehearsal? Use the Call Sheet instead.',
    },
    director: {
      what: 'Where cast submit the dates they can’t make.',
      can: ['See what each person submitted on the Schedule page, and reset a person’s conflicts from Members.'],
    },
    staff: {
      what: 'Where cast submit the dates they can’t make.',
      can: ['See what each person submitted on the Schedule page.'],
    },
  },

  account: {
    director: {
      what: 'Your own details and preferences.',
      can: [
        'Choose the look: Simple, Classic or Fancy, light or dark.',
        'Change your name, avatar, password and email notifications.',
        'Add emergency contacts.',
      ],
    },
    staff: {
      what: 'Your own details and preferences.',
      can: [
        'Choose the look: Simple, Classic or Fancy, light or dark.',
        'Change your name, avatar, password and email notifications.',
        'Add emergency contacts.',
      ],
    },
    cast: {
      what: 'Your own details and preferences.',
      can: [
        'Choose the look: Simple, Classic or Fancy, light or dark.',
        'Change your name, avatar, password and email notifications.',
        'Add an emergency contact (required if you are under 18).',
      ],
    },
  },
};

export function guideFor(page: GuideId, role: string | null): Guide | null {
  const entry = GUIDES[page];
  if (!entry) return null;
  if (role === 'director') return entry.director ?? entry.staff ?? entry.cast ?? null;
  if (role === 'staff') return entry.staff ?? entry.director ?? null;
  return entry.cast ?? entry.staff ?? null;
}

/** The permission table on the Help page. */
export const PERMISSIONS: { area: string; what: string; director: boolean; staff: boolean; cast: boolean | 'own' }[] = [
  { area: 'Schedule', what: 'See the calendar and your calls', director: true, staff: true, cast: true },
  { area: 'Schedule', what: 'Add, move, cancel or delete rehearsals', director: true, staff: true, cast: false },
  { area: 'Call sheet', what: 'Check yourself in; tell staff you’ll be late', director: true, staff: true, cast: true },
  { area: 'Call sheet', what: 'Mark other people’s attendance', director: true, staff: true, cast: false },
  { area: 'Bulletin', what: 'Read announcements and confirm them', director: true, staff: true, cast: true },
  { area: 'Bulletin', what: 'Post, pin and ask for confirmation', director: true, staff: true, cast: false },
  { area: 'Reports', what: 'Write and send rehearsal reports', director: true, staff: true, cast: false },
  { area: 'Reports', what: 'Read reports sent to you', director: true, staff: true, cast: true },
  { area: 'Scenes', what: 'Create scenes and cast them', director: true, staff: true, cast: false },
  { area: 'Sign-ups', what: 'Sign up for a slot', director: true, staff: true, cast: true },
  { area: 'Sign-ups', what: 'Create and manage slots', director: true, staff: true, cast: false },
  { area: 'Documents', what: 'View and download files', director: true, staff: true, cast: true },
  { area: 'Documents', what: 'Add or delete files', director: true, staff: true, cast: false },
  { area: 'Forms', what: 'Sign a form', director: true, staff: true, cast: true },
  { area: 'Forms', what: 'Create forms and see who signed', director: true, staff: true, cast: false },
  { area: 'Members', what: 'See the company list', director: true, staff: true, cast: true },
  { area: 'Members', what: 'Invite, promote, remove or block people', director: true, staff: false, cast: false },
  { area: 'Teams', what: 'Create teams and message them', director: true, staff: true, cast: false },
  { area: 'Chat', what: 'Message anyone in the production', director: true, staff: true, cast: false },
  { area: 'Chat', what: 'Message staff, and cast on your team', director: true, staff: true, cast: true },
  { area: 'Conflicts', what: 'Submit your own conflicts', director: false, staff: false, cast: true },
  { area: 'Settings', what: 'Change settings, archive or delete the production', director: true, staff: false, cast: false },
];

export const GLOSSARY: { term: string; meaning: string }[] = [
  { term: 'Call', meaning: 'A scheduled time when people are expected, such as a rehearsal, tech or a show.' },
  { term: 'Called', meaning: 'Expected at a particular call. If nobody is assigned to a date, the whole cast is called.' },
  { term: 'Call sheet', meaning: 'The page for one call: who is called, who has arrived, and who said they will be late.' },
  { term: 'Full company', meaning: 'Everyone in the cast is called, rather than a chosen group.' },
  { term: 'Conflict', meaning: 'A date a cast member can’t attend. They submit conflicts once, early on.' },
  { term: 'Excused', meaning: 'An approved absence. It does not count against attendance.' },
  { term: 'Distribution list', meaning: 'The people who receive a rehearsal report.' },
  { term: 'Open call', meaning: 'A job or shift that volunteers can sign up for, such as strike or box office.' },
  { term: 'Team', meaning: 'A group of cast you create. Team members can message each other.' },
  { term: 'Pinned', meaning: 'Kept at the top of the bulletin board because it matters most.' },
  { term: 'Archive', meaning: 'Closes a production and makes it read-only. Nothing is deleted.' },
];
