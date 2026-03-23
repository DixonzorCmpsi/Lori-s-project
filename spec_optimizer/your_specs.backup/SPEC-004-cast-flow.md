# SPEC-004: Cast Flow

**Status:** Draft
**Last Updated:** 2026-03-21
**Depends On:** SPEC-001, SPEC-002, SPEC-003

---

## Goals (Immutable)

- Cast joins production via invite link, completes profile setup, submits conflicts once, and lands on bulletin board
- Conflict submission is atomic: all conflict rows inserted in a single database transaction, or none are
- Director can reset a cast member's conflicts (deletes submission record + all conflict rows in one transaction), allowing re-submission
- Image uploads validated by magic bytes (first 4-8 bytes), not file extension. EXIF stripped server-side. UUID filenames generated server-side

## Non-Goals (Explicit Exclusions)

- Cast-to-cast messaging: cast can only communicate with director/staff, not other cast members
- Cast editing the schedule: schedule is read-only for cast, no edit controls rendered
- Cast editing submitted conflicts: conflicts are immutable after submission, no edit endpoint exists
- Cast seeing other cast members' conflicts: conflict data is scoped to the individual + director/staff
- Self-service conflict reset: only the Director can reset a cast member's conflicts
- Video/audio uploads: only JPEG and PNG images are accepted for headshots

## Success Metric

A cast member who clicks the invite link can complete onboarding (profile setup + conflict submission) in under 3 minutes with no prior instructions. Conflicts are guaranteed to be submitted exactly once per cast member per production unless the Director explicitly resets them.

## Immutable Constraints

- Conflicts are immutable after submission. No edit or partial update endpoint exists
- conflict_submissions UNIQUE(production_id, user_id) is the authoritative guard against double submission, not application-level checks
- JPEG and PNG only, validated by magic bytes (not file extension or MIME header)
- 5MB max upload size per image. Requests exceeding this return 413
- EXIF metadata stripped from all uploaded images before storage
- UUID filenames generated server-side. Original filenames are discarded entirely
- Conflict reason text max 500 characters (DB CHECK constraint)

---

## 1. Overview

Cast members join via an invite link shared by the Director. Their capabilities are limited to: view announcements, view schedule, submit conflicts once, and chat with Director/Staff only.

## 2. Cast Onboarding Flow

```text
User receives invite link from Director (email/text)
  -> Clicks link: /join?token=xxx
  -> Server validates token, stores production_id in session, redirects to /join (clean URL)
  -> If not authenticated:
      -> Login or Register page (age gate: must be 13+)
      -> After auth, auto-join production as Cast
  -> If authenticated:
      -> Auto-join production as Cast role
  -> Redirect to: Cast Profile Setup (if first time)
  -> Then: Bulletin Board (poster tab)
```

**Key Rules:**
- No access code, no QR code. Just a plain URL link
- **Everyone enters as Cast.** Staff is a promotion, not a separate entry point (see SPEC-001 Section 3.2)
- Token is validated and stripped from the URL immediately (see SPEC-002 Section 2.4)

## 3. Cast Profile Setup

On first joining a production, cast completes their profile. This information is visible to the Director and Staff.

**Fields:**

| Field | Type | Required | Max Length | Notes |
|-------|------|----------|------------|-------|
| Full Name | Text | Yes | 200 chars | Display name within production |
| Phone Number | Text | No | 20 chars | Emergency contact |
| Role/Character | Text | No | 200 chars | Assigned later by Director, or self-reported |
| Headshot/Photo | Image upload | No | 5 MB | For cast roster (see upload rules below) |

**Privacy:** Date of birth MUST NOT be collected in the profile. The age gate happens once at registration (SPEC-002 Section 2.3).

### 3.1 Image Upload Requirements

- **Max file size:** 5 MB
- **Allowed types:** JPEG and PNG only. Validated by checking file **magic bytes** (first 4-8 bytes of the file), not just the file extension. SVG, GIF, WebP, and all other formats are rejected
- **EXIF stripping:** Server MUST strip all EXIF metadata before storage (EXIF can contain GPS coordinates and other PII)
- **Filename:** Server generates a random filename (UUID). The original filename is discarded entirely — prevents path traversal attacks (the original filename is never used in any file path)
- **Storage:** Environment-aware file storage. In production, images are uploaded to **Supabase Storage** (`headshots` bucket, private) via the REST API using the service role key. In development, images are stored at `./uploads/headshots/` on the local filesystem. The `STORAGE_PROVIDER` environment variable controls which backend is used (`supabase` or `local`). The serving endpoint `GET /api/uploads/[filename]` works identically in both environments — it validates auth + production membership, then proxies from Supabase Storage (production) / reads from local disk (development).
- **Deletion:** Users MUST be able to delete their photo at any time via a "Remove Photo" button on the profile page. Photos MUST also be deleted when the user is removed from a production or deletes their account. Deletion MUST remove the file from storage (Supabase Storage or local disk) and set `cast_profiles.headshot_url` to NULL

## 4. Conflict Submission

After completing their profile, cast members submit their scheduling conflicts. **This is a one-time submission — conflicts cannot be edited after submission.**

### 4.1 Conflict Entry UI

The cast member sees the full production calendar (generated by the Director's schedule builder) and marks dates they are unavailable.

**Input:**
- Calendar view showing all rehearsal dates
- Cast clicks/taps dates they CANNOT attend
- For each conflict date: a reason text field (max 500 characters, not required, defaults to NULL)
- "Submit Conflicts" button with confirmation dialog:
  > "Once submitted, your conflicts cannot be changed. Are you sure?"

### 4.2 Conflict Rules

- Conflicts are **immutable** after submission
- Cast gets ONE submission window
- If a cast member has not submitted conflicts, the Director roster MUST display "Conflicts: Not submitted" for that member
- Director and Staff can see all cast conflicts overlaid on the schedule
- Cast MUST NOT see other cast members' conflicts. The API MUST return only the requesting user's own conflicts

### 4.3 Race Condition Handling

The `INSERT INTO conflict_submissions` with its UNIQUE constraint `(production_id, user_id)` is the **authoritative guard** against double submission — not the pre-check SELECT. The full flow:

1. API receives conflict submission request
2. Open a database transaction
3. `INSERT INTO conflict_submissions` — if this raises a unique constraint violation, return `409 Conflict` with message "Conflicts already submitted" and rollback
4. `INSERT INTO cast_conflicts` for each selected date
5. Commit transaction

If any insert fails, the entire submission rolls back. This prevents partial conflict data from being saved.

### 4.4 Director Conflict Reset

The Director can reset a cast member's conflict submission, allowing them to re-submit. This is necessary when a cast member makes errors in their one-time submission.

**Flow:**
1. Director selects a cast member from the roster
2. Director clicks "Reset Conflicts" with a confirmation dialog: "This will delete all of [name]'s submitted conflicts and allow them to re-submit. This cannot be undone."
3. Server deletes the cast member's `conflict_submissions` row and all their `cast_conflicts` rows for that production in a single transaction
4. A system-generated bulletin post notifies the cast member: "Your conflicts have been reset by the director. Please re-submit your conflicts."
5. Cast member sees the conflict submission form again on their next visit

### 4.5 Database Schema (Cast Profiles & Conflicts)

```sql
-- Cross-references: full schemas in SPEC-002 and SPEC-003
CREATE TABLE productions (id UUID PRIMARY KEY);
CREATE TABLE users (id UUID PRIMARY KEY);
CREATE TABLE rehearsal_dates (id UUID PRIMARY KEY, production_id UUID);

CREATE TABLE cast_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id   UUID NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  display_name    TEXT NOT NULL CHECK (char_length(display_name) <= 200),
  phone           TEXT CHECK (phone IS NULL OR char_length(phone) <= 20),
  role_character  TEXT CHECK (role_character IS NULL OR char_length(role_character) <= 200),
  headshot_url    TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(production_id, user_id)
);

CREATE TRIGGER trg_cast_profiles_updated_at
  BEFORE UPDATE ON cast_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE cast_conflicts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id     UUID NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rehearsal_date_id UUID NOT NULL REFERENCES rehearsal_dates(id) ON DELETE CASCADE,
  reason            TEXT CHECK (reason IS NULL OR char_length(reason) <= 500),
  submitted_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, rehearsal_date_id)
);

CREATE TABLE conflict_submissions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id UUID NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(production_id, user_id)
);
```

**Schema notes:**
- `cast_profiles` is **per-production** — a user can have different display names, roles, and headshots in different productions
- `display_name` is separate from `users.name` — it's the name shown within this production's roster
- `headshot_url` stores the path to the uploaded image (UUID filename, e.g., `a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg`)
- `conflict_submissions` is the authoritative guard: if a row exists for `(production_id, user_id)`, the user MUST NOT submit again. The Director resets by deleting this row (Section 4.4)

## 5. Bulletin Board (Cast View)

The bulletin board is the cast member's **home screen** after onboarding. It has two tabs:

### 5.1 Poster Tab (Default, shown first)

- Shows announcements/posts created by Director and Staff members
- Read-only for cast
- Pinned posts appear at the top
- Ordered newest-first
- Each post shows: title, body, author name, timestamp

### 5.2 Schedule Tab

- Shows the production calendar
- Rehearsal dates color-coded by type (regular, tech, dress, performance)
- Soft-deleted dates (`is_deleted = TRUE`) are excluded from the cast schedule view
- Cast member's **own conflicts** are overlaid (highlighted/marked)
- Cancelled rehearsals shown with strikethrough
- Notes from Director visible on each date
- **Cast cannot edit anything** — view only

## 6. Cast Navigation

The cast member's app has a minimal layout:

```
+----------------------------------+
|  [Bulletin Board]    [Chat]      |
|                                  |
|  +----------------------------+  |
|  | [Posters] | [Schedule]     |  |
|  +----------------------------+  |
|  |                            |  |
|  |   (Tab content here)       |  |
|  |                            |  |
|  +----------------------------+  |
+----------------------------------+
```

- **Bulletin Board** — Poster tab (default) + Schedule tab
- **Chat** — Messages with Director/Staff only

## 7. Test Scenarios

| ID | Scenario | Expected Result |
|----|----------|-----------------|
| CAST-01 | User clicks invite link, not registered | Redirect to register (age gate), then auto-join as Cast |
| CAST-02 | User clicks invite link, already logged in | Auto-join as Cast, redirect to profile setup |
| CAST-03 | Cast completes profile | Profile saved, redirected to conflict submission |
| CAST-04 | Cast submits conflicts | Conflicts saved in transaction, marked as submitted |
| CAST-05 | Cast tries to submit conflicts again | 409 Conflict — "Conflicts already submitted" |
| CAST-06 | Cast views bulletin board | Sees poster tab by default with Director posts |
| CAST-07 | Cast views schedule tab | Sees calendar with their conflicts overlaid |
| CAST-08 | Cast tries to edit schedule | No edit controls available — view only |
| CAST-09 | Cast tries to chat with another cast member | No option available — can only see Staff/Director |
| CAST-10 | Director views cast conflicts | All cast conflicts visible on schedule overlay |
| CAST-11 | 50 cast members join production | System handles all joins, conflicts, and views |
| CAST-12 | Cast clicks invalid/regenerated invite link | Error: "This invite link is no longer valid" |
| CAST-13 | Director resets cast member's conflicts | Conflicts deleted, cast can re-submit |
| CAST-14 | Cast re-submits after Director reset | New conflicts saved successfully |
| CAST-15 | Two simultaneous conflict submissions (race condition) | One succeeds, other gets 409 (DB unique constraint) |
| CAST-16 | Upload headshot as JPEG, valid | Image saved with UUID filename, EXIF stripped |
| CAST-17 | Upload SVG file as headshot | Rejected — JPEG/PNG only |
| CAST-18 | Upload file exceeding 5MB | Rejected with 413 Payload Too Large |
| CAST-19 | Conflict reason exceeds 500 chars | Rejected with validation error |
| CAST-20 | Cast member is promoted to Staff | Role changes, gains admin privileges, see SPEC-001 |
