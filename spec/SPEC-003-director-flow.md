# SPEC-003: Director Flow

**Status:** Draft
**Last Updated:** 2026-03-21
**Depends On:** SPEC-001, SPEC-002

---

## Goals (Immutable)

- Director creates a theater and a production within it via guided onboarding flow
- Schedule wizard generates a deterministic rehearsal calendar from exactly 7 questions (day selection, start time, end time, blocked dates, tech week toggle, tech week length, dress rehearsal toggle)
- Bulletin board supports Markdown posts sanitized server-side before storage (no raw HTML persisted)
- Member roster supports promote/demote/remove/reset-conflicts for each member
- Production archival sets read-only mode and triggers 90-day PII deletion via scheduled job

## Non-Goals (Explicit Exclusions)

- Drag-and-drop schedule editor: v1 uses wizard generation + individual date editing only
- Calendar sync (Google Calendar, iCal export): no external calendar integration in v1
- Email notifications for schedule changes: v1 uses bulletin board posts for announcements
- Multi-production view: Director manages one production at a time in v1
- Recurring production templates: no ability to clone or template a production's settings

## Success Metric

Given identical wizard inputs (same 7 answers, same production dates), the schedule generator produces byte-identical output every time. Director can manage all members and the full production lifecycle (create, edit, archive, unarchive) from the dashboard without any external tools.

## Immutable Constraints

- first_rehearsal <= opening_night <= closing_night enforced as DB CHECK constraints
- All text fields have max length CHECK constraints at the database level (theater name 200, city 100, state 100, production name 200, note 1000, post title 200, post body 10000)
- Markdown is sanitized server-side before storage, not just on render. Raw HTML tags are stripped
- Soft-delete is the default for rehearsal dates (is_deleted flag). Hard delete is not exposed
- Tech week overrides the day-of-week filter (rehearsals every day during tech week)
- Blocked dates override tech week (blocked date within tech week is skipped, with warning)

---

## 1. Overview

After authenticating, the Director completes a guided setup flow: add a theater/school, create a production, answer scheduling questions, and land on the production dashboard.

## 2. Director Onboarding Flow

```
Login/Register
  -> Dashboard (empty state: "Add your first theater")
  -> Add Theater/School
  -> Add Production (within that theater)
  -> Schedule Builder Questions
  -> Production Dashboard (schedule + bulletin board + invite link)
```

## 3. Add Theater/School

The Director registers their venue. This is the top-level organizational unit.

**Fields:**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Theater/School Name | Text (max 200) | Yes | e.g., "Lincoln High School" |
| City | Text (max 100) | Yes | |
| State | Text (max 100) | Yes | |

**Behavior:**
- In v1, a Director MUST have exactly one theater. The UI MUST NOT render a "create second theater" option
- Theater is the parent container for productions
- If the Director already has a theater, `POST /api/theaters` MUST return `409 Conflict` with message "You already have a theater." The `/theater/new` page MUST redirect to the dashboard if the Director already has a theater.

## 4. Add Production

Within a theater, the Director creates a production.

**Fields:**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Production Name | Text (max 200) | Yes | e.g., "Into the Woods" |
| Cast Size (estimated) | Number | Yes | Integer, minimum 1, maximum 200. Used for display only in v1 |
| First Rehearsal Date | Date | Yes | MUST be >= today |
| Opening Night | Date | Yes | MUST be >= First Rehearsal |
| Closing Night | Date | Yes | MUST be >= Opening Night |

**Date Validation Rules:**
- `first_rehearsal <= opening_night <= closing_night` — enforced at both API and database level
- All dates must be in the future at time of creation
- These constraints are CHECK constraints in the `productions` table
- If the Director already has an active (non-archived) production, `POST /api/productions` MUST return `409 Conflict` with message "You already have an active production." The `/production/new` page MUST redirect to the existing production if one exists.

## 5. Schedule Builder Questions

After creating the production, the Director answers questions that **auto-generate a rehearsal calendar**. This is a guided wizard.

**Questions:**
| # | Question | Input Type | Purpose |
|---|----------|------------|---------|
| 1 | What days of the week do you want to rehearse? | Multi-select (Mon-Sun) | Sets recurring rehearsal days |
| 2 | What time do rehearsals start? | Time picker | Default start time |
| 3 | What time do rehearsals end? | Time picker | Default end time |
| 4 | Are there any dates you want to block off? (holidays, breaks) | Date multi-picker | Excluded dates |
| 5 | Do you want a tech week? | Yes/No | If yes: consecutive days before opening |
| 6 | How many tech rehearsal days? | Number (if tech week = yes) | Integer, minimum 1, maximum 14. Default: 5 |
| 7 | Do you want a dress rehearsal? | Yes/No | If yes: last day of tech week is marked as dress (exactly 1 day) |

**Schedule Generation Logic:**
1. Generate all dates between First Rehearsal and Opening Night
2. Filter to only selected days of the week
3. Remove blocked dates
4. Mark tech week dates (N consecutive calendar days ending the day before opening_night, inclusive)
5. If dress rehearsal is enabled, mark the last day of tech week as type `dress` (exactly 1 day, not additional)
6. Each date gets the default start/end times
7. Generate performance dates from opening_night to closing_night (inclusive), excluding blocked dates, with type 'performance'

**Edge Cases & Precedence Rules:**
- **Tech week overrides day-of-week filter:** During tech week, rehearsals happen every day regardless of the selected weekdays
- **Blocked dates override tech week:** If a blocked date falls within tech week, that date is skipped. The Director is shown a warning: "Blocked date [date] falls within tech week and will be skipped"
- **Tech week clamped to first rehearsal:** If N tech days before opening extends before the first rehearsal date, tech week starts at first rehearsal instead
- **Dress rehearsal is a subset of tech week:** The last day of tech week is marked as type `dress`, not added as a separate date. Exactly 1 dress rehearsal day
- **Performance dates:** The wizard automatically generates performance dates for every day from `opening_night` to `closing_night` (inclusive). Blocked dates within this range are excluded. Performance dates use the same default start/end times. The Director can remove unwanted performance dates after generation.
- **Empty schedule:** If no valid rehearsal dates remain after all filtering, show an error: "No rehearsal dates could be generated. Please adjust your settings." Do not create an empty schedule
- **Start time < end time:** Validate that rehearsal start time is before end time. Reject with error if not

**Schedule Generation Pseudocode:**

```
function generateSchedule(input):
  dates = []

  // Step 1-3: Regular rehearsals
  for each day D from first_rehearsal to (opening_night - 1):
    if D is in blocked_dates: continue
    if dayOfWeek(D) is in selected_days:
      dates.push({ date: D, type: 'regular', start: input.start_time, end: input.end_time })

  // Step 4-5: Tech week (overrides day-of-week filter)
  if tech_week_enabled:
    tech_start = max(first_rehearsal, opening_night - tech_days)
    for each day D from tech_start to (opening_night - 1):
      if D is in blocked_dates:
        warnings.push("Blocked date {D} falls within tech week and will be skipped")
        continue
      type = 'tech'
      if dress_rehearsal_enabled AND D == (opening_night - 1) AND D not in blocked_dates:
        type = 'dress'
      // Replace any existing regular entry for this date
      remove from dates where date == D
      dates.push({ date: D, type: type, start: input.start_time, end: input.end_time })

  // Step 6: Performance dates
  for each day D from opening_night to closing_night:
    if D is in blocked_dates: continue
    dates.push({ date: D, type: 'performance', start: input.start_time, end: input.end_time })

  if dates is empty:
    return error("No rehearsal dates could be generated. Please adjust your settings.")

  return dates sorted by date ascending
```

**Output:** A calendar visible on the Director's dashboard with all generated rehearsal dates.

## 6. Production Dashboard

The Director's main view after setup. Contains:

### 6.1 Schedule View
- Calendar showing all rehearsal dates
- Color-coded: Regular rehearsal, Tech rehearsal, Dress rehearsal, Performance
- Director can click any date to edit time, add notes, or cancel
- Conflicts from cast are overlaid (e.g., "3 cast members unavailable")

### 6.2 Bulletin Board

- Director can create posts (title + body)
- Director and Staff can **edit** their own posts after creation. Editing re-sanitizes the Markdown server-side. Edited posts show a small "(edited)" indicator with the edit timestamp. Directors can also edit Staff posts
- Posts use **Markdown** format. The server renders Markdown to HTML using a safe renderer that strips all raw HTML tags. Allowed formatting: bold, italic, headings (h1-h3), lists, links (rendered with `rel="noopener noreferrer" target="_blank"`), and line breaks. No embedded images, iframes, scripts, or raw HTML. **Sanitization happens server-side before storage**, not just on render
- Posts are visible to all production members
- Posts are ordered newest-first
- Director can pin a post to the top. Only one post MUST be pinned at a time; pinning a new post unpins the previous one
- Director can delete any post. Staff can delete their own posts only
- Staff can create posts and pin posts
- **System-generated posts** (e.g., schedule update notifications, conflict reset notifications) are attributed to the Director who triggered the action. The `author_id` is the Director's user_id. The post body makes the automation clear (e.g., "Schedule updated: Tech week moved to April 7-11"). No schema change needed — the NOT NULL constraint on `author_id` is satisfied.

### 6.3 Invite Link Section

- Shows the current invite link (single link for everyone — all join as Cast)
- Shows expiry date and remaining uses
- "Copy Link" button
- "Regenerate Link" button (invalidates old link, creates new 30-day token)
- Shows count of members who have joined
- Note: There are no separate staff invite links. Staff are promoted from the roster (see 6.4)

### 6.4 Member Roster

- List of all members who joined via invite link
- Shows: Name, role (Cast/Staff), date joined, conflicts submitted (yes/no)
- **Director actions per member:**
  - Promote to Staff (cast member gains admin privileges)
  - Demote to Cast (staff member loses admin privileges)
  - Remove from production (confirmation dialog required)
  - Reset conflicts (allows cast member to re-submit — see SPEC-004 Section 4.4)

### 6.4.1 Demotion Side Effects

When a Staff member is demoted to Cast:

1. **Bulletin posts:** Posts authored by the demoted user remain visible and attributed to them. The demoted user can no longer edit their own posts and can no longer delete their own posts (Cast has no post editing capability). The Director retains the ability to edit and delete any post.
2. **Conflict data:** The demoted user immediately loses access to the aggregated conflict view. Their next API request for conflict data returns 403.
3. **Chat conversations:** Existing conversation history with other Cast members remains readable (messages are not deleted). However, the demoted user can no longer send new messages to Cast members — the API enforces Cast-to-Cast blocking on every new message. The contact list is refreshed on next load.
4. **WebSocket:** On the next 5-minute re-validation cycle, the server detects the role change and closes the WebSocket with code 4401, forcing the client to reconnect with updated permissions.

### 6.5 Production Archival

The Director can archive a production at any time, including before closing night.

**Flow:**
1. Director clicks "Archive Production" from the production dashboard
2. Confirmation dialog: "Archiving will mark this production as closed. Members will retain read-only access for 90 days, after which all PII (profiles, conflicts, chat messages) will be permanently deleted. Are you sure?"
3. Server sets `productions.is_archived = TRUE` and records `archived_at` timestamp
4. All members retain **read-only access** — they can view the bulletin board and schedule but cannot post, chat, or modify anything
5. Invite link is automatically deactivated
6. After **90 days** from `archived_at`, a scheduled job permanently deletes: cast profiles, conflicts, chat messages, and uploaded images. Production metadata (name, dates, theater) is retained for the Director's historical records
7. Director MUST be able to **unarchive** within the 90-day window (restores full access)

**UI:** The unarchive button appears on the Production Settings page (`/production/[id]/settings`) when the production is archived and within the 90-day window. After the 90-day window, the unarchive button is hidden and the production shows "PII deleted — cannot be restored."

**Schema addition:** Add `archived_at TIMESTAMPTZ` to the `productions` table.

## 7. Director Schedule Manipulation

The Director can modify the generated schedule:

| Action | Behavior |
|--------|----------|
| Add rehearsal date | Pick a date + start time + end time + type (`regular`, `tech`, `dress`, `performance`), insert into `rehearsal_dates` |
| Remove rehearsal date | Soft-delete (set `is_deleted = TRUE`). A system-generated bulletin post MUST notify all members |
| Change rehearsal time | Update start/end time for a specific date |
| Add note to a date | Update `rehearsal_dates.note` (max 1000 chars). Visible to all production members on that date |
| Cancel a rehearsal | Set `is_cancelled = TRUE` (stays on calendar, rendered with strikethrough text). A system-generated bulletin post MUST notify all members |

Cast members **cannot** modify the schedule. They only view it.

## 8. Database Schema (Director-Related)

```sql
-- Cross-references: full schemas in SPEC-002
CREATE TABLE users (id UUID PRIMARY KEY);

CREATE TABLE theaters (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL CHECK (char_length(name) <= 200),
  city       TEXT NOT NULL CHECK (char_length(city) <= 100),
  state      TEXT NOT NULL CHECK (char_length(state) <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE productions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theater_id          UUID NOT NULL REFERENCES theaters(id) ON DELETE CASCADE,
  name                TEXT NOT NULL CHECK (char_length(name) <= 200),
  estimated_cast_size INTEGER,
  first_rehearsal     DATE NOT NULL,
  opening_night       DATE NOT NULL,
  closing_night       DATE NOT NULL,
  is_archived         BOOLEAN DEFAULT FALSE,
  archived_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  CHECK (first_rehearsal <= opening_night),
  CHECK (opening_night <= closing_night)
);

CREATE TRIGGER trg_productions_updated_at
  BEFORE UPDATE ON productions
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE rehearsal_dates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id UUID NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  start_time    TIME NOT NULL,
  end_time      TIME NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('regular', 'tech', 'dress', 'performance')),
  note          TEXT CHECK (note IS NULL OR char_length(note) <= 1000),
  is_cancelled  BOOLEAN DEFAULT FALSE,
  is_deleted    BOOLEAN DEFAULT FALSE,       -- soft-delete: hidden from cast, conflicts preserved
  deleted_at    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  CHECK (start_time < end_time)
);

CREATE TABLE bulletin_posts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id UUID NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  author_id     UUID NOT NULL REFERENCES users(id),
  title         TEXT NOT NULL CHECK (char_length(title) <= 200),
  body          TEXT NOT NULL CHECK (char_length(body) <= 10000),  -- Markdown, sanitized server-side
  is_pinned     BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_bulletin_posts_updated_at
  BEFORE UPDATE ON bulletin_posts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

### 8.1 Authorization Rules

- All API endpoints that read a theater and all API endpoints that modify a theater MUST verify `theaters.owner_id = authenticated_user.id`
- All API endpoints that modify a production MUST verify the user is a Director / Staff member of that production (via `production_members`)
- Bulletin post creation MUST verify the author is a Director / Staff member
- These checks are enforced in middleware, not just at the query level
- Soft-deleted rehearsal dates (`is_deleted = TRUE`) are hidden from cast schedule views but remain queryable by the Director for historical conflict reference

## 9. Test Scenarios

| ID | Scenario | Expected Result |
|----|----------|-----------------|
| DIR-01 | Director creates a theater | Theater record created, linked to Director |
| DIR-02 | Director creates a production | Production record created within theater |
| DIR-03 | Schedule builder generates dates | Correct dates based on day selection and exclusions |
| DIR-04 | Blocked dates excluded from schedule | Blocked dates do not appear |
| DIR-05 | Tech week generated before opening | Correct consecutive dates marked as tech |
| DIR-06 | Director edits a rehearsal time | Time updated, cast sees new time |
| DIR-07 | Director cancels a rehearsal | Date marked cancelled, visible to cast |
| DIR-08 | Director posts to bulletin board (Markdown) | Post sanitized and visible to all production members |
| DIR-09 | Director pins a post | Pinned post appears first |
| DIR-10 | Director generates invite link | Unique token created for production (30-day expiry) |
| DIR-11 | Director regenerates invite link | Old token invalidated, new one works |
| DIR-12 | Director elevates cast to staff | User role updated to staff in production_members |
| DIR-13 | Director removes member | Member row deleted, user loses access |
| DIR-14 | Production with first_rehearsal after opening_night | Rejected with validation error |
| DIR-15 | Input exceeding max length (e.g., 201-char theater name) | Rejected with 400 Bad Request |
| DIR-16 | Tech week overlaps blocked date | Blocked date skipped, warning shown to Director |
| DIR-17 | Tech week extends before first rehearsal | Tech week clamped to start at first rehearsal |
| DIR-18 | No valid dates after filtering | Error: "No rehearsal dates could be generated" |
| DIR-19 | Non-owner tries to modify theater via API | 403 Forbidden |
| DIR-20 | Bulletin post with XSS script tag in Markdown | Script stripped by sanitizer, post saved safely |
| DIR-21 | Director demotes staff to cast | Role updated back to cast |
| DIR-22 | Director soft-deletes a rehearsal date | Date hidden from cast, conflicts preserved for Director |
| DIR-23 | Staff member creates bulletin post | Post created successfully (staff has posting rights) |
