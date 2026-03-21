# SPEC-006: Schedule & Conflict Management

**Status:** Draft
**Last Updated:** 2026-03-21
**Depends On:** SPEC-001, SPEC-003, SPEC-004

---

## Goals (Immutable)

- Deterministic schedule generation from wizard inputs (days, times, blocked dates, tech week, dress)
- One-time conflict submission per cast member per production with DB-level immutability
- Director aggregated conflict view with per-date unavailability counts
- Soft-delete as the default for rehearsal removal (preserves conflict data)
- System bulletin post automatically created on schedule changes

## Non-Goals (Explicit Exclusions)

- Drag-and-drop calendar interface
- Recurring schedule templates
- Calendar export (iCal, Google Calendar)
- Automatic conflict resolution suggestions
- Cast self-service conflict editing after submission
- Partial conflict submission (all-or-nothing only)

## Success Metric

Given identical wizard inputs, the generated schedule is byte-for-byte identical. The Director can see exactly how many cast members are unavailable on any given date within one click.

## Immutable Constraints

- Schedule generation is a pure function of inputs (days, times, blocked dates, tech week, dress). Same inputs always produce the same output.
- Conflict submission is all-or-nothing in a single database transaction. No partial saves.
- `conflict_submissions` UNIQUE constraint on `(production_id, user_id)` is the authority for one-time submission. No application-level workarounds.
- Soft-delete sets `is_deleted = TRUE` on rehearsal_dates. It does NOT cascade-delete associated conflicts.
- `rehearsal_dates.start_time < end_time` enforced by a DB CHECK constraint.

---

## 1. Overview

The Director builds a rehearsal calendar through a guided wizard (SPEC-003 Section 5). Cast members submit conflicts against it. The Director sees an aggregated conflict view overlaid on the schedule.

## 2. Schedule Generation

The Director answers wizard questions about rehearsal days, times, exclusions, and tech week. The system generates `rehearsal_dates` records. The wizard flow is defined in SPEC-003 Section 5; this section defines the generation algorithm and data model.

### 2.1 Rehearsal Date Types

| Type | Color Code | Description |
|------|------------|-------------|
| `regular` | Amber | Standard rehearsal |
| `tech` | Blue | Technical rehearsal (lighting, sound, set) |
| `dress` | Purple | Full dress rehearsal |
| `performance` | Red | Show dates |

### 2.2 Schedule Generation Algorithm (Pseudocode)

This is a pure function. Given identical inputs, it MUST produce identical output.

```text
function generateSchedule(inputs):
  // Inputs:
  //   firstRehearsal: Date, openingNight: Date, closingNight: Date
  //   selectedDays: Set<DayOfWeek>, startTime: Time, endTime: Time
  //   blockedDates: Set<Date>
  //   techWeekEnabled: boolean, techWeekDays: number
  //   dressRehearsalEnabled: boolean

  dates = []

  // Step 1: Regular rehearsal dates (firstRehearsal to day before openingNight)
  for each date from firstRehearsal to (openingNight - 1 day), inclusive:
    if dayOfWeek(date) IN selectedDays AND date NOT IN blockedDates:
      dates.push({ date, startTime, endTime, type: 'regular' })

  // Step 2: Tech week (overrides day-of-week filter)
  if techWeekEnabled AND techWeekDays > 0:
    techStart = max(firstRehearsal, openingNight - techWeekDays)
    techEnd = openingNight - 1 day
    for each date from techStart to techEnd, inclusive:
      if date IN blockedDates:
        emit warning("Blocked date {date} in tech week — skipped")
        continue
      existing = dates.find(d => d.date == date)
      if existing: existing.type = 'tech'
      else: dates.push({ date, startTime, endTime, type: 'tech' })

  // Step 3: Dress rehearsal (last day of tech week = dress)
  if dressRehearsalEnabled AND techWeekEnabled:
    techDates = dates.filter(d => d.type == 'tech').sortByDate()
    if techDates.length > 0:
      techDates[techDates.length - 1].type = 'dress'

  // Step 4: Performance dates (openingNight to closingNight)
  for each date from openingNight to closingNight, inclusive:
    if date NOT IN blockedDates:
      dates.push({ date, startTime, endTime, type: 'performance' })

  // Step 5: Sort and validate
  dates.sort(byDateAscending)
  if dates.length == 0: return error("No dates generated")
  return dates
```

### 2.3 Generated Schedule Structure

Each `rehearsal_dates` record MUST contain:

- `date` (DATE, NOT NULL)
- `start_time` (TIME, NOT NULL) — MUST be before `end_time` (DB CHECK constraint)
- `end_time` (TIME, NOT NULL)
- `type` (ENUM: `regular`, `tech`, `dress`, `performance`, NOT NULL)
- `note` (TEXT, nullable, default NULL) — Director-editable free text, max 500 characters
- `is_cancelled` (BOOLEAN, NOT NULL, default FALSE)
- `is_deleted` (BOOLEAN, NOT NULL, default FALSE) — soft-delete flag

## 3. Conflict Management

### 3.1 Cast Conflict Submission

**Flow:**

1. Cast member opens `/production/[id]/conflicts`
2. Calendar displays all non-deleted rehearsal dates (`is_deleted = FALSE`)
3. Cast taps/clicks dates they are unavailable — selected dates toggle red with a checkmark
4. Cast enters an optional reason per selected date (max 500 characters)
5. Cast clicks "Submit Conflicts" — a confirmation dialog appears: "Once submitted, conflicts cannot be changed. Continue?"
6. On confirm, the API receives `POST /api/productions/[id]/conflicts` with `{ dates: [{ rehearsalDateId, reason? }] }`
7. Submission is final — no edits allowed after this point

**Submitting zero conflicts:** Cast members with no conflicts MUST still submit an empty conflict list (empty `dates` array). This records their submission in `conflict_submissions` and transitions the page to read-only State 2.

### 3.2 Conflict Validation

The `POST /api/productions/[id]/conflicts` endpoint MUST validate in this order:

1. User is authenticated — if not, return `401 Unauthorized`
2. User is a Cast member of this production — if not, return `403 Forbidden`
3. User has not already submitted conflicts (query `conflict_submissions` for existing row) — if already submitted, return `409 Conflict` with body `{ error: "Conflicts already submitted" }`
4. Every `rehearsalDateId` in the request belongs to this production and has `is_deleted = FALSE` — if any invalid, return `400 Bad Request` with body `{ error: "Invalid rehearsal date IDs", invalidIds: [...] }`
5. All validations pass: insert into `conflict_submissions` and `cast_conflicts` in a single database transaction. Return `201 Created`

### 3.3 Immutability Enforcement

The one-time submission rule is enforced at three levels:

- **Database:** `conflict_submissions` table UNIQUE constraint on `(production_id, user_id)` — a second insert fails with a constraint violation
- **API:** Endpoint checks for existing `conflict_submissions` row before accepting (returns `409` if found)
- **UI:** After submission, the page renders read-only State 2 (no form, no submit button)

## 4. Director's Aggregated View

The Director sees the schedule with **all cast conflicts overlaid**.

### 4.1 Calendar Overlay

For each rehearsal date, the Director sees:

- The date, time, and type (color-coded per Section 2.1)
- A conflict count badge: "{N} unavailable"
- Clicking the badge expands an inline panel listing: cast member name + reason (or "No reason given" if blank)
- Badge color indicates severity by fixed thresholds:
  - 0 conflicts: green (`bg-green-600/20 text-green-400`)
  - 1-2 conflicts: amber (`bg-amber-600/20 text-amber-400`)
  - 3-4 conflicts: orange (`bg-orange-600/20 text-orange-400`)
  - 5+ conflicts: red (`bg-red-600/20 text-red-400`)

### 4.2 Conflict Summary Table

Separate from the calendar, a sortable table:

| Date | Type | Conflicts | Names |
|------|------|-----------|-------|
| Mar 25 | Regular | 3 | Alex (doc appt), Jordan, Sam (work) |
| Mar 27 | Regular | 0 | — |
| Apr 1 | Tech | 7 | ... |

Director can sort by date or conflict count to find problematic dates.

## 5. Schedule Modification

The Director can modify the schedule at any time:

| Action | Effect on Conflicts |
|--------|-------------------|
| Add new rehearsal date | No conflicts exist yet for new date |
| Remove rehearsal date (soft-delete) | Date hidden from cast via `is_deleted = TRUE`. Conflicts PRESERVED for Director's historical reference. Cast no longer sees the date |
| Permanently delete rehearsal date | Director explicitly confirms. Date and associated conflicts are hard-deleted (cascade). This is irreversible |
| Change date/time | Existing conflicts stay (they're tied to the rehearsal_date record) |
| Cancel rehearsal | Date stays visible, marked cancelled, conflicts preserved for record |

The default "remove" action is a soft-delete. Hard-delete MUST show a confirmation dialog with the exact text: "This will permanently delete this date and all associated conflicts. This cannot be undone." The Director MUST click "Delete permanently" to confirm.

### 5.1 Notification on Changes

When the Director performs any schedule modification (add, soft-delete, hard-delete, cancel, change date/time), the system MUST:

1. Create a bulletin post with `author_id` set to the Director's user_id who triggered the action
2. Post title: "Schedule Updated"
3. Post body: A machine-generated description following this format:
   - Add: "Rehearsal added: {date} {startTime}-{endTime} ({type})"
   - Soft-delete: "Rehearsal removed: {date}"
   - Hard-delete: "Rehearsal permanently deleted: {date}"
   - Cancel: "Rehearsal cancelled: {date}"
   - Time change: "Rehearsal time changed: {date} now {newStartTime}-{newEndTime}"
4. Cast members see this post on the Bulletin Board Posters tab

## 6. Cast Schedule View

Cast members see a read-only personal schedule view:

- Full production calendar excluding soft-deleted dates (`is_deleted = TRUE` dates are filtered out of the query)
- Their own conflict dates highlighted with a red background (`bg-red-500/20`) and a "You're unavailable" label
- Director's notes displayed below the date/time on each date
- Cancelled dates shown with strikethrough text and a "Cancelled" badge in gray
- No edit controls, no buttons, no forms — the entire page is read-only
- Cast MUST NOT see other cast members' conflict data (the API MUST NOT return other members' conflicts)

## 7. Test Scenarios

| ID | Scenario | Expected Result |
|----|----------|-----------------|
| SCHED-01 | Generate schedule from wizard answers | Correct dates, types, and times |
| SCHED-02 | Blocked dates excluded | No rehearsal on blocked dates |
| SCHED-03 | Tech week generated | Consecutive days before opening, marked as tech |
| SCHED-04 | Cast submits conflicts | Conflicts saved, linked to rehearsal dates |
| SCHED-05 | Cast tries to re-submit conflicts | Blocked with error message |
| SCHED-06 | Director views aggregated conflicts | Sees count + names per date |
| SCHED-07 | Director adds new rehearsal date | Date appears on calendar, no conflicts |
| SCHED-08 | Director soft-deletes rehearsal date | Date hidden from cast, conflicts preserved |
| SCHED-09 | Director cancels rehearsal | Date marked cancelled, visible to cast |
| SCHED-10 | Cast views personal schedule | Sees calendar with own conflicts, no deleted dates |
| SCHED-11 | Schedule change triggers bulletin post | System post appears on bulletin board |
| SCHED-12 | 50 cast members submit conflicts | Aggregated view handles all data correctly |
| SCHED-13 | Director hard-deletes rehearsal date | Date + conflicts permanently deleted after confirm |
| SCHED-14 | Director resets a cast member's conflicts | Conflicts deleted, cast can re-submit |
