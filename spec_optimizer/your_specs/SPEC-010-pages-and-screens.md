# SPEC-010: Pages & Screens

**Status:** Draft
**Last Updated:** 2026-03-21
**Depends On:** SPEC-001 through SPEC-009

---

## Goals (Immutable)

- Define every page route, its access control, and what it displays — no ambiguity left for the builder.
- ASCII wireframe for every screen (one wireframe per screen, no more, no less).
- Two complete user flows documented end-to-end: Director onboarding and Cast onboarding.
- Per-screen behavior specs covering all four states: loading, empty, error, and data.
- Schedule wizard is a 7-step form with validation at each step boundary.
- Bulletin board has two tabs: Posters (default) and Schedule.

## Non-Goals (Explicit Exclusions)

- Pixel-perfect mockups (wireframes only; visual implementation adapts to SPEC-009 theme).
- Animation specifications or transition definitions.
- Interaction micro-copy (button hover text, tooltip content, etc.).
- Print stylesheets or print-friendly layouts.
- PDF export of the schedule.
- Deep-linking to specific bulletin posts.

## Success Metric

An AI builder reading SPEC-009 + SPEC-010 can implement every page with the correct layout, navigation, access control, and behavior without asking any clarifying questions. Every screen has exactly one wireframe and one behavior description.

## Immutable Constraints

- Exactly 19 routes total — no additional routes may be added without a spec revision.
- Cast members see simplified navigation only: Bulletin Board + Chat (no Dashboard, Members, or Settings).
- Director dashboard must show: quick stats, upcoming schedule, recent posts, and invite link.
- Bulletin board default tab is Posters — not Schedule.
- Conflict submission has exactly 2 states: not submitted (editable) and submitted (read-only) — no draft or partial states.
- Schedule wizard has exactly 7 steps — no fewer, no more.
- Account deletion requires re-authentication (password or OAuth) before proceeding.

---

## 1. Overview

Each screen maps to a Next.js App Router page. Access control is enforced server-side in the route's layout or page component — unauthorized access MUST return a redirect to `/login` (for unauthenticated) or a `403` page (for insufficient role).

## 2. Route Map

| Route | Page | Access | Role |
|-------|------|--------|------|
| `/login` | Login | Public | All |
| `/register` | Registration | Public | All |
| `/forgot-password` | Password reset request | Public | All |
| `/reset-password` | New password form | Public (with token) | All |
| `/verify-email` | Email verification | Public (with token) | All |
| `/join` | Invite link handler | Public (with token) | All |
| `/` | Dashboard | Auth required | Director |
| `/theater/new` | Add theater | Auth required | Director |
| `/production/new` | Create production + wizard | Auth required | Director |
| `/production/[id]` | Production dashboard | Auth + member | Director, Staff |
| `/production/[id]/schedule` | Schedule view | Auth + member | All roles |
| `/production/[id]/bulletin` | Bulletin board | Auth + member | All roles |
| `/production/[id]/roster` | Member roster | Auth + member | Director, Staff |
| `/production/[id]/chat` | Chat list | Auth + member | All roles |
| `/production/[id]/chat/[convId]` | Conversation | Auth + member | All roles |
| `/production/[id]/conflicts` | Conflict submission | Auth + cast | Cast only |
| `/production/[id]/profile` | Cast profile setup | Auth + cast | Cast (first join) |
| `/production/[id]/settings` | Production settings | Auth + member | Director only |
| `/account` | Account settings | Auth required | All |

## 3. Screen Specifications

### 3.1 Login Page (`/login`)

**Purpose:** Authenticate existing users.

**Layout:**
```text
+----------------------------------+
|        Digital Call Board         |
|          [Logo/Icon]             |
|                                  |
|  [Sign in with Google]  (button) |
|                                  |
|  ──────── or ────────            |
|                                  |
|  Email:    [____________]        |
|  Password: [____________]        |
|                                  |
|  [Log In]              (button)  |
|                                  |
|  Forgot password?       (link)   |
|  Don't have an account? Register |
+----------------------------------+
```

**Behavior:**

- Google OAuth button triggers OAuth flow (SPEC-002 Section 2.1)
- Email/password validated client-side (Zod) then server-side
- On `401`: display "Invalid email or password" (identical message for wrong email and wrong password — MUST NOT differentiate)
- On `429`: display "Too many attempts. Try again in {retryAfterSeconds} minutes." where `retryAfterSeconds` comes from the `Retry-After` response header
- On account lockout (`423`): display "Account locked. Check your email."
- If user arrived via invite link, the invite token MUST be stored in `sessionStorage` under key `pendingInviteToken` — after successful login, the client MUST call `POST /api/join` with the token to auto-join the production

### 3.2 Registration Page (`/register`)

**Purpose:** Create new accounts.

**Layout:**
```text
+----------------------------------+
|        Create Account            |
|                                  |
|  [Sign up with Google]  (button) |
|                                  |
|  ──────── or ────────            |
|                                  |
|  Name:          [____________]   |
|  Email:         [____________]   |
|  Date of Birth: [__/__/____]     |
|  Password:      [____________]   |
|  Confirm:       [____________]   |
|                                  |
|  [ ] I agree to the Privacy      |
|      Policy (link)               |
|                                  |
|  [Create Account]       (button) |
|                                  |
|  Already have an account? Log in |
+----------------------------------+
```

**Behavior:**

- Age gate: DOB field is validated on blur. If age < 13, display inline error: "You must be 13 or older to create an account." and disable the submit button
- Password strength: validated against HaveIBeenPwned k-anonymity API. If breached, display inline error: "This password has appeared in a data breach. Please choose a different password."
- Privacy policy checkbox MUST be checked to enable submit button
- On success (email/password): redirect to `/verify-email?pending=true` which displays "Check your email to verify your account."
- On success (Google): redirect to `/` (dashboard)

### 3.3 Dashboard (`/`)

**Purpose:** Director's home. Shows their theaters and productions.

**Layout:**
```text
+--[Sidebar]------+--[Main Content]----------------+
| Digital Call     |                                 |
| Board            |  Your Productions              |
|                  |                                 |
| [+ New Theater]  |  +--[Production Card]--------+ |
|                  |  | Into the Woods             | |
| Lincoln HS       |  | Lincoln HS                 | |
|   Into the Woods |  | Opens: Apr 15              | |
|                  |  | Cast: 32/45                | |
| [Account]        |  | [Open]                     | |
| [Log Out]        |  +----------------------------+ |
+------------------+                                 |
                   |  +--[Empty State]-------------+ |
                   |  | No productions yet.         | |
                   |  | [Create your first one]     | |
                   |  +----------------------------+ |
                   +---------------------------------+
```

**Behavior:**

- Shows all productions across all theaters, ordered by opening date ascending (soonest first)
- Production cards display exactly: production name, theater name, opening date (formatted as "Opens: MMM DD"), cast count as "{joined}/{castSize}"
- Empty state (no theaters): "No theaters yet." with button "Add your first theater" linking to `/theater/new`
- Empty state (theaters exist, no productions): "No productions yet." with button "Create your first production" linking to `/production/new`
- Account settings link and logout button in sidebar footer

### 3.4 Create Production + Schedule Wizard (`/production/new`)

**Purpose:** Guided multi-step form to create a production and generate the schedule.

**Steps:**

| Step | Title | Fields |
|------|-------|--------|
| 1 | Production Details | Name, cast size, first rehearsal, opening night, closing night |
| 2 | Rehearsal Days | Multi-select: Mon-Sun |
| 3 | Rehearsal Times | Start time, end time |
| 4 | Blocked Dates | Date multi-picker for holidays/breaks |
| 5 | Tech Week | Yes/No, if yes: how many days |
| 6 | Dress Rehearsal | Yes/No |
| 7 | Review | Summary of all inputs + generated calendar preview |

**Behavior:**

- Steps are shown as a horizontal stepper: numbered circles (1-7) connected by lines, with the current step highlighted in `--accent` color and completed steps showing a checkmark
- Back button (disabled on step 1) and Next button on each step. Next MUST validate the current step's fields with Zod before advancing — if validation fails, inline errors appear and the step does not advance
- Step 7 shows the generated schedule as a month calendar preview using the algorithm from SPEC-006 Section 2.2. Director can click Back to adjust any prior step
- "Create Production" button on step 7 submits `POST /api/productions` with all wizard data. On success, redirect to `/production/[id]`. On error, display toast with error message
- On mobile (< 768px), steps are full-screen with a progress bar at the top showing "{current}/7"

### 3.5 Production Dashboard (`/production/[id]`)

**Purpose:** Director's main view for an active production. Staff sees the same but without Settings.

**Layout:**
```text
+--[Sidebar]------+--[Main Content]---------------------+
| [Back to Dash]   |                                     |
|                  |  Into the Woods                     |
| Schedule         |  Lincoln HS | Opens Apr 15          |
| Bulletin Board   |                                     |
| Members          |  +--[Quick Stats]-----------------+ |
| Chat             |  | Cast: 32 | Conflicts: 28/32    | |
| Settings         |  | Next Rehearsal: Mar 25 3pm     | |
|                  |  +--------------------------------+ |
|                  |                                     |
|                  |  +--[Upcoming Schedule]------------+ |
|                  |  | Mar 25 Tue  3-6pm  Regular      | |
|                  |  |   2 conflicts                   | |
|                  |  | Mar 27 Thu  3-6pm  Regular      | |
|                  |  |   0 conflicts                   | |
|                  |  +--------------------------------+ |
|                  |                                     |
|                  |  +--[Recent Posts]--+-[Invite]----+ |
|                  |  | Costume fitting  | Link: [...] | |
|                  |  | tomorrow at 2pm  | 32 joined   | |
|                  |  |    — Director    | [Copy] [New]| |
|                  |  +------------------+-------------+ |
+------------------+-------------------------------------+
```

### 3.6 Schedule Page (`/production/[id]/schedule`)

**Purpose:** Full calendar view. Director/Staff can edit. Cast can only view.

**Director View:**

- Month calendar grid with rehearsal dates color-coded by type (SPEC-009 Section 4.4)
- Click a date to open a right-side slide-over panel with fields: start time, end time, note (text input, max 500 chars), and buttons: "Save Changes", "Cancel Rehearsal" (sets `is_cancelled = TRUE`), "Remove" (soft-delete, sets `is_deleted = TRUE`), "Delete Permanently" (hard-delete with confirmation dialog)
- Conflict badges on each date per SPEC-006 Section 4.1 severity thresholds
- "+ Add Date" button opens a dialog with fields: date (date picker), start time, end time, type (dropdown: regular, tech, dress, performance). On save, calls `POST /api/productions/[id]/schedule/dates`
- Color legend at top of calendar showing all 6 states from SPEC-009 Section 4.4

**Cast View:**

- Same calendar grid layout, read-only
- Own conflict dates highlighted with red background (`bg-red-500/20`) and "You're unavailable" label
- No edit controls, no add button, no conflict counts for other cast members
- Director's notes visible below date/time on each date

### 3.7 Bulletin Board Page (`/production/[id]/bulletin`)

**Purpose:** Announcements and schedule info for all members.

**Layout:**
```text
+--[Tabs]-----------------------------+
| [Posters]  [Schedule]               |
+--------------------------------------+
| +--[New Post]  (Director/Staff)----+ |
| | Title: [___________]             | |
| | Body:  [Markdown editor________] | |
| | [Post]  [Pin]                    | |
| +----------------------------------+ |
|                                      |
| +--[Pinned Post]------------------+ |
| | ** COSTUME FITTING **            | |
| | Tomorrow at 2pm in Room 204...   | |
| | — Director, Mar 22   (edited)    | |
| | [Edit] [Unpin] [Delete]          | |
| +----------------------------------+ |
|                                      |
| +--[Post]-------------------------+ |
| | Schedule update                  | |
| | Tech week starts Apr 7...        | |
| | — Stage Manager, Mar 21          | |
| +----------------------------------+ |
+--------------------------------------+
```

**Behavior:**

- Default tab: Posters (active on page load). Schedule tab renders the calendar in cast-view mode (read-only, same layout as `/production/[id]/schedule` cast view)
- New post form at top of Posters tab, visible only to Director and Staff roles. Title field (required, 1-200 chars) and body field (Markdown textarea with live preview panel to the right on desktop, below on mobile). Markdown sanitized with rehype-sanitize before rendering — script tags, iframes, and event handlers MUST be stripped.
- Posts display: rendered Markdown body, author name, relative timestamp (e.g., "2 hours ago"), and "(edited)" suffix if `updated_at != created_at`
- Pinned posts render above non-pinned posts, separated by a horizontal divider. Within each group, posts are ordered by `created_at` descending (newest first).
- Director sees three action buttons on every post: "Edit", "Pin"/"Unpin" (toggles), "Delete"
- Staff sees "Edit", "Pin"/"Unpin", "Delete" on their own posts only. No action buttons on other users' posts.
- Cast sees no action buttons on any post — read-only view

### 3.8 Member Roster (`/production/[id]/roster`)

**Purpose:** Director manages production members. Staff can view.

**Layout:**
```text
+--[Invite Link]-----------------------------+
| https://app.com/join?token=abc...  [Copy]  |
| Expires: Apr 20  |  Used: 32/100  [Regen]  |
+---------------------------------------------+

+--[Members Table]--------------------------+
| Name          | Role   | Conflicts  | Actions |
|---------------|--------|------------|---------|
| Alex Johnson  | Staff  | 3/28       | [...]   |
| Jordan Lee    | Cast   | Submitted  | [...]   |
| Sam Williams  | Cast   | Pending    | [...]   |
+----------------------------------------------+
```

**Columns:**

- **Name:** Full name of the member
- **Role:** "Director", "Staff", or "Cast"
- **Conflicts:** For Cast: "Submitted" (with count, e.g., "3/28") or "Pending" (not yet submitted). For Staff/Director: "N/A"
- **Actions:** Dropdown menu (Director only). Staff sees this column as empty.

**Actions dropdown options (Director only):**

- "Promote to Staff" (visible only for Cast members) — calls `PATCH /api/productions/[id]/members/[userId]` with `{ role: "staff" }`
- "Demote to Cast" (visible only for Staff members) — calls `PATCH /api/productions/[id]/members/[userId]` with `{ role: "cast" }`
- "Reset Conflicts" (visible only for Cast who have submitted) — confirmation dialog: "This will delete all conflicts for this member and allow them to re-submit. Continue?" On confirm, calls `DELETE /api/productions/[id]/members/[userId]/conflicts`
- "Remove from Production" — confirmation dialog: "Remove {name} from this production? This cannot be undone." On confirm, calls `DELETE /api/productions/[id]/members/[userId]`

### 3.9 Chat Page (`/production/[id]/chat`)

**Purpose:** 1-on-1 messaging with role-based boundaries.

**Layout (Desktop):**
```text
+--[Conversations]--+--[Messages]-------------------+
| Search contacts    |  Jordan Lee                   |
|                    |  Cast Member                  |
| Alex Johnson   2m  |  ────────────────────────     |
|  "Can you check.." |  Jordan: Hi, I have a         |
|                    |  question about the costume    |
| Jordan Lee     1h  |  fitting tomorrow.   2:30pm   |
|  "Hi, I have a..." |                               |
|                    |  You: Sure, what's up?  2:31pm |
| + New Message      |                               |
+--------------------+  [Type a message...]  [Send]  |
                     +-------------------------------+
```

**Mobile:** Conversation list is a separate screen. Tapping opens full-screen conversation.

**Behavior:**

- Contact list filtered by role (SPEC-005 Section 3.3): Cast sees only Director and Staff contacts. Director and Staff see all members.
- Unread badge: integer count displayed on each conversation in the list. Updated in real-time via WebSocket.
- Real-time delivery via WebSocket (Supabase Realtime in production, `ws` in development)
- Message input: plain text only, max 2000 characters enforced client-side with a character counter. Enter sends. Shift+Enter inserts a newline. Empty messages MUST NOT send (button disabled).
- Director sees a "Delete" button on hover (desktop) or long-press (mobile) for any message in any conversation
- Non-Director users see "Delete" on their own messages only if the message is less than 5 minutes old (calculated from `created_at`)
- Connection status indicator in the header: green circle (`bg-green-500`) = connected, yellow circle (`bg-yellow-500`) with pulse animation = reconnecting

### 3.10 Conflict Submission Page (`/production/[id]/conflicts`)

**Purpose:** Cast members select dates they cannot attend. One-time submission.

**States:**

**State 1: Not yet submitted**
```text
+--------------------------------------+
| Mark Your Conflicts                  |
|                                      |
| Select the dates you CANNOT attend.  |
| This can only be submitted once.     |
|                                      |
| +--[Calendar]----------------------+ |
| |  March 2026                      | |
| |  [25] [27] [28]  <- clickable   | |
| |   ^selected (red)               | |
| +----------------------------------+ |
|                                      |
| Selected: 3 dates                    |
| Mar 25: [reason: ___________]        |
| Mar 27: [reason: ___________]        |
| Mar 28: [reason: ___________]        |
|                                      |
| [Submit Conflicts]                   |
|                                      |
| ** Once submitted, conflicts cannot  |
|    be changed. **                    |
+--------------------------------------+
```

**State 2: Already submitted (read-only)**
```text
+--------------------------------------+
| Your Conflicts (Submitted Mar 22)    |
|                                      |
| +--[Calendar]----------------------+ |
| | Your conflicts shown in red      | |
| +----------------------------------+ |
|                                      |
| You submitted 3 conflicts.          |
| Contact your director if you need   |
| to make changes.                    |
+--------------------------------------+
```

**Behavior:**

- Calendar displays all non-deleted rehearsal dates. Cast taps a date to toggle it as a conflict (selected/deselected)
- Selected dates render with red background (`bg-red-500/20`) and a checkmark icon
- Below the calendar, a list of selected dates appears, each with an optional reason text input (max 500 characters)
- "Selected: {N} dates" counter updates in real-time as dates are toggled
- Submit button triggers a confirmation dialog with text: "Once submitted, conflicts cannot be changed. Continue?" and buttons "Cancel" / "Submit"
- On confirm, calls `POST /api/productions/[id]/conflicts` per SPEC-006 Section 3.2. On `201`, page transitions to State 2. On `409`, display toast: "Conflicts already submitted."
- If Director resets this cast member's conflicts (via roster), reloading this page MUST show State 1 again

### 3.11 Cast Profile Setup (`/production/[id]/profile`)

**Purpose:** First-time profile for new cast members.

**Layout:**
```text
+--------------------------------------+
| Welcome to Into the Woods!           |
| Complete your profile to get started |
|                                      |
| Full Name:      [____________]       |
| Phone (opt):    [____________]       |
| Role/Character: [____________]       |
|                                      |
| Photo (optional):                    |
| [Upload Photo]  or drag & drop       |
| JPEG or PNG, max 5MB                |
|                                      |
| [Save & Continue]                    |
+--------------------------------------+
```

**Behavior:**

- Shown only on first join (when `cast_profiles` has no row for this user+production). If profile exists, redirect to `/production/[id]/conflicts`
- Photo upload: client-side preview in a 120x120px circle, type validation (JPEG/PNG only by extension and MIME type), size validation (max 5MB). Rejected files display inline error: "Only JPEG and PNG files under 5MB are accepted."
- Fields validated with Zod: name (required, 1-100 chars), phone (optional, validated as phone number pattern), role/character (required, 1-100 chars)
- After save (`POST /api/productions/[id]/profile` returns `201`), redirect to `/production/[id]/conflicts`

### 3.12 Account Settings (`/account`)

**Purpose:** User account management.

**Sections (rendered in this order):**

- **Profile:** Edit name (text input, required, 1-100 chars), email (read-only display, not editable), photo (same upload rules as cast profile: JPEG/PNG, max 5MB)
- **Password:** Change password form with fields: current password, new password, confirm new password. Visible only for email/password auth users. Hidden for Google-only OAuth users.
- **Connected accounts:** Shows Google account email if linked. "Link Google Account" button if not linked. "Unlink Google Account" button if linked AND user has email/password auth (MUST NOT allow unlinking if Google is the only auth method — button disabled with tooltip: "Add a password first").
- **Sessions:** "Log out of all devices" button. On click, confirmation dialog: "This will sign you out everywhere. Continue?" On confirm, calls `POST /api/auth/logout-all`, then redirects to `/login`.
- **Privacy:** "Delete my account" button in `--destructive` color. On click, re-authentication dialog appears (password input for email/password users, Google OAuth re-consent for Google-only users). After re-auth, confirmation dialog: "This will permanently delete your account and all associated data. This cannot be undone." On confirm, calls `DELETE /api/account`, then redirects to `/login` with toast: "Account deleted."
- **Age range:** Read-only display showing "13-17" or "18+" based on DOB. No edit control.

### 3.13 Production Settings (`/production/[id]/settings`)

**Purpose:** Director-only production management.

**Sections (rendered in this order):**

- **Production details:** Edit name (text input, required, 1-100 chars), first rehearsal date, opening night, closing night (date pickers with validation: first rehearsal < opening night <= closing night). Save calls `PATCH /api/productions/[id]`.
- **Danger zone** (red border, `border-destructive` styling):
  - **Archive production** (visible when `is_archived = FALSE`): Button "Archive Production". Confirmation dialog: "Archiving will make this production read-only and deactivate the invite link. You can restore it within 90 days." On confirm, calls `PATCH /api/productions/[id]` with `{ is_archived: true }`.
  - **Restore production** (visible when `is_archived = TRUE` AND `archived_at` is within 90 days): Button "Restore Production". On confirm, calls `PATCH /api/productions/[id]` with `{ is_archived: false }`.
  - **PII expired notice** (visible when `is_archived = TRUE` AND `archived_at` is older than 90 days): Disabled button with text "PII deleted — cannot be restored" and explanation: "This production's personal data was automatically deleted 90 days after archiving."
  - **Delete production** (visible always): Button "Delete Production" in `--destructive` color. On click, re-authentication dialog (password or OAuth). After re-auth, confirmation dialog: "This will permanently delete the production and all associated data. This cannot be undone." On confirm, calls `DELETE /api/productions/[id]`, then redirects to `/` with toast: "Production deleted."

## 4. Page Transitions & Flow

### 4.1 Director First-Time Flow

```text
/register -> /verify-email -> / (dashboard, empty) -> /theater/new -> /production/new (wizard)
-> /production/[id] (production dashboard)
```

### 4.2 Cast First-Time Flow

```text
/join?token=X -> /register (age gate) -> /verify-email -> auto-join production
-> /production/[id]/profile -> /production/[id]/conflicts -> /production/[id]/bulletin
```

### 4.3 Returning User Flow

```text
/login -> / (dashboard) -> click production card -> /production/[id] (Director/Staff) or /production/[id]/bulletin (Cast)
```

## 5. Test Scenarios

| ID | Scenario | Expected Result |
|----|----------|-----------------|
| PAGE-01 | Director completes full onboarding flow | Theater + production created, schedule generated |
| PAGE-02 | Cast completes invite -> profile -> conflicts flow | Joined production, profile saved, conflicts submitted |
| PAGE-03 | Cast revisits after conflicts submitted | Read-only conflict view, bulletin board accessible |
| PAGE-04 | Director views production dashboard | Quick stats, upcoming schedule, recent posts visible |
| PAGE-05 | Schedule wizard generates correct calendar preview | Dates match selected days, blocked dates excluded |
| PAGE-06 | Bulletin board renders Markdown safely | Bold, links work. Script tags stripped |
| PAGE-07 | Chat loads conversation list with correct contacts | Cast sees only Director/Staff. Director sees everyone |
| PAGE-08 | Conflict picker selects/deselects dates | Red highlight toggles, count updates |
| PAGE-09 | Member roster shows correct actions per role | Director sees all actions. Staff sees view-only |
| PAGE-10 | Mobile navigation shows bottom bar | 3 tabs: Bulletin, Schedule, Chat |
| PAGE-11 | Account deletion flow | Confirmation dialog, re-auth, account deleted |
| PAGE-12 | Production archive flow | Confirmation, read-only mode, invite link deactivated |
