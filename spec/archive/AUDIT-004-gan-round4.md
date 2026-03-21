# AUDIT-004: GAN Round 4 — Adversarial Deep Dive

**Auditor:** 20+ year Software/Security/DevOps Engineer
**Date:** 2026-03-21
**Scope:** All 10 specs (SPEC-001 through SPEC-010), AGENT.md, SPEC-MANIFEST.xml
**Purpose:** Find issues that AUDIT-001, AUDIT-002, and AUDIT-003 missed. Focus on end-to-end prototype gaps, implementation blockers, manifest accuracy, agent alignment, database completeness, API contract gaps, and frontend-backend contract mismatches.
**Prior Audits:** AUDIT-001 (35 findings, all resolved), AUDIT-002 (12 items, all resolved), AUDIT-003 (15 findings: 4 MEDIUM, 11 LOW)

---

## Findings Summary

| # | Severity | Spec(s) | Finding |
|---|----------|---------|---------|
| 1 | CRITICAL | SPEC-002, SPEC-003, SPEC-007 | No email delivery mechanism specified anywhere — verification emails, password reset emails, and lockout notification emails cannot be sent |
| 2 | CRITICAL | SPEC-003, SPEC-006 | Schedule generation algorithm has no implementable pseudocode — "pure function" claimed but only prose description provided |
| 3 | HIGH | SPEC-001, SPEC-003 | 90-day PII deletion job has no implementation specification — no cron, no scheduler, no trigger, no query |
| 4 | HIGH | SPEC-004, SPEC-007 | Image upload storage path undefined — no volume mount, no directory path, no serving mechanism, no cleanup job |
| 5 | HIGH | SPEC-001, SPEC-002, SPEC-003 | Staff demotion side effects undefined — what happens to posts authored by demoted Staff? Can they still see conflict data they previously viewed? |
| 6 | HIGH | SPEC-002, SPEC-010 | Cast member flow after email verification is broken — unverified user cannot create theater but can join production; spec is silent on whether unverified cast can submit conflicts or chat |
| 7 | HIGH | SPEC-003, SPEC-006 | Performance dates are never generated — wizard generates dates between first_rehearsal and opening_night, but performances happen between opening_night and closing_night. No mechanism to create them |
| 8 | HIGH | SPEC-010 | SPEC-010 immutable constraint says "Exactly 20 routes" but route table has 19 — AUDIT-003 flagged this as LOW but it is an immutable constraint violation |
| 9 | MEDIUM | MANIFEST | Multiple manifest line numbers are wrong after AUDIT-001/002/003 edits — progressive disclosure workflow is broken |
| 10 | MEDIUM | AGENT.md, SPEC-010 | AGENT.md Phase 10 says "SPEC-009, SPEC-010, SPEC-001" but SPEC-008 Phase 10 says "SPEC-001" only — missing SPEC-009 and SPEC-010 |
| 11 | MEDIUM | SPEC-002 | No specification for how the "top 10,000 breached passwords" list is bundled or loaded — builder must guess the format and lookup mechanism |
| 12 | MEDIUM | SPEC-003 | Bulletin post system notification on conflict reset and schedule change has no author_id — system-generated posts have no sender, violating the NOT NULL constraint on bulletin_posts.author_id |
| 13 | MEDIUM | SPEC-005 | Chat "is_read" is a single boolean per message but conversations are 1-on-1 — spec never defines WHEN is_read is set to true (on message visible? on conversation open? via explicit API call?) |
| 14 | MEDIUM | SPEC-002, SPEC-003 | Director is created via registration but never added to production_members — the permission matrix requires checking production_members.role but the Director who creates a production has no production_members row defined in the creation flow |
| 15 | MEDIUM | SPEC-003, SPEC-006 | Schedule wizard question 7 "Do you want a dress rehearsal?" has no day count — AUDIT-003 F-08 flagged this as LOW, but it is a schedule generation blocker (the algorithm literally cannot determine how many days to mark as dress) |
| 16 | MEDIUM | SPEC-005, SPEC-010 | Chat "New Message" flow undefined — contact list shows names but no spec describes how starting a new conversation works (select recipient -> create conversation -> send first message) |
| 17 | MEDIUM | SPEC-009 | JetBrains Mono font referenced in typography section but never included in project setup — not loaded via next/font, no fallback specified |
| 18 | MEDIUM | SPEC-003, SPEC-010 | Production archival "unarchive" flow has no UI — SPEC-003 Sec 6.5 says "Director can unarchive within 90 days" but no page or button exists in SPEC-010 for this action |
| 19 | MEDIUM | SPEC-002 | Session rolling refresh mechanism undefined — "30 days rolling, refreshed on activity" but no spec for what "activity" means or how the expiry is extended (every request? every page load? explicit heartbeat?) |
| 20 | LOW | SPEC-003 | productions table missing archived_at column in SQL — AUDIT-003 F-09 flagged this, still not in the schema |
| 21 | LOW | SPEC-002, SPEC-004 | No specification for what happens when a user who already belongs to a production clicks the invite link again — silently ignore? error? redirect? |
| 22 | LOW | SPEC-005 | Conversation deduplication via SELECT ... FOR UPDATE assumes PostgreSQL but no index exists to efficiently find conversations by both participants — query will be slow at scale |
| 23 | LOW | SPEC-003 | Theater edit/delete not specified — Director can create a theater but there is no edit or delete flow for the theater entity |
| 24 | LOW | SPEC-007 | CI/CD workflow file (.github/workflows/ci.yml) referenced in SPEC-008 Sec 10 but no content or structure defined |
| 25 | LOW | SPEC-010 | Account settings page defines "Connected accounts: Link/unlink Google OAuth" but no flow is defined for OAuth account linking from the settings page — only auto-link at registration is specified |
| 26 | LOW | SPEC-009 | Cork board texture uses inline SVG data URI which may violate the CSP `img-src 'self' blob: data:` — `data:` is included so it technically passes, but `style-src 'unsafe-inline'` combined with data URIs is a known CSP bypass vector |

---

## Detailed Findings

### FINDING-01 [CRITICAL] — No Email Delivery Mechanism Specified

**Specs Affected:** SPEC-002 Sections 2.2, 2.3, 2.3.1, 2.5; SPEC-007
**The Problem:**

The specs require sending emails in at least 4 places:
1. Email verification on registration (SPEC-002 Sec 2.3.1)
2. Password reset link (SPEC-002 Sec 2.5)
3. Account lockout notification (SPEC-002 Sec 2.2)
4. Conflict reset notification via bulletin (SPEC-004 Sec 4.4 — this one is a bulletin post, not email, so acceptable)

However, **no spec defines how emails are sent**. There is:
- No email provider specified (SMTP? SendGrid? Resend? AWS SES? Nodemailer?)
- No environment variable for email credentials
- No Docker service for an SMTP relay
- No email template format
- No from address
- No error handling for email delivery failure
- No rate limiting on email sending
- SPEC-007 explicitly excludes email from non-goals... by not mentioning it at all

A developer hitting Phase 2 (Auth) will be **completely blocked** when they try to implement registration — the spec says "send verification email" but gives zero guidance on how.

**Recommended Fix:** Add to SPEC-007 Section 2 (Tech Stack) a new row:

```
| Email | Nodemailer + SMTP | Direct SMTP for transactional emails (verification, password reset, lockout) |
```

Add to SPEC-007 Section 4.2 (Environment Variables):

```
| SMTP_HOST     | app | SMTP server hostname (e.g., smtp.gmail.com, smtp.resend.com) |
| SMTP_PORT     | app | SMTP port (587 for TLS) |
| SMTP_USER     | app | SMTP authentication username |
| SMTP_PASSWORD  | app | SMTP authentication password |
| EMAIL_FROM    | app | From address for transactional emails (e.g., noreply@yourdomain.com) |
```

Add a new section to SPEC-002 after Section 2.5:

```markdown
## 2.6 Email Delivery

All transactional emails (verification, password reset, lockout notification) are sent via Nodemailer using SMTP.

**Requirements:**
- Transport: SMTP with TLS (port 587)
- From address: configured via EMAIL_FROM environment variable
- Emails are plain text + HTML (dual format)
- Email sending failures are logged but do NOT block the user action (e.g., registration succeeds even if the verification email fails to send — user can request a resend)
- Rate limit: max 5 emails per hour per email address (prevents abuse of resend endpoints)
- No email content logging (PII scrubbing applies)

**Templates (text content only — no complex HTML):**
- Verification: "Click this link to verify your email: {url}. This link expires in 24 hours."
- Password reset: "Click this link to reset your password: {url}. This link expires in 1 hour."
- Lockout: "Your account has been temporarily locked due to too many failed login attempts. It will unlock in 30 minutes."
```

---

### FINDING-02 [CRITICAL] — Schedule Generation Algorithm Not Implementable

**Specs Affected:** SPEC-003 Section 5, SPEC-006 Section 2
**The Problem:**

SPEC-003 Section 5 describes the schedule generation in 6 prose steps. SPEC-006 says "schedule generation is a pure function of inputs." SPEC-003's success metric says "identical inputs produce byte-identical output." However:

1. **No pseudocode or algorithm definition exists.** The prose says "Generate all dates between First Rehearsal and Opening Night" then "Filter to only selected days of the week" then "Remove blocked dates" then "Mark tech week dates (N days before opening, consecutive)." This is ambiguous enough that two builders will produce different results.

2. **"N days before opening" is ambiguous.** If opening night is April 15 and tech week is 5 days, is tech week April 10-14 (5 days ending the day before opening)? Or April 11-15 (5 days ending on opening)? The spec does not define whether opening night itself is included in the tech week count.

3. **Dress rehearsal subset logic is ambiguous.** "Last 1-2 days of tech week are marked as dress." If tech week is April 10-14 and dress is 2 days, is it April 13-14? But AUDIT-003 F-08 already noted the day count is unasked. This is still unresolved.

4. **Performance dates are never generated.** The wizard generates dates between `first_rehearsal` and `opening_night`. The type `performance` exists in the schema. But performances happen between `opening_night` and `closing_night`. The wizard never asks about performance days. There is no mechanism to create them. See FINDING-07.

5. **"Byte-identical" is impossible to verify without a reference implementation.** The success metric is untestable without deterministic pseudocode.

**Recommended Fix:** Add a pseudocode algorithm to SPEC-006 after Section 2.1:

```markdown
### 2.2 Schedule Generation Algorithm (Pseudocode)

This is a pure function. Given identical inputs, it MUST produce identical output.

```
function generateSchedule(inputs):
  // Inputs:
  //   firstRehearsal: Date
  //   openingNight: Date
  //   closingNight: Date
  //   selectedDays: Set<DayOfWeek>  (e.g., {Mon, Wed, Fri})
  //   startTime: Time
  //   endTime: Time
  //   blockedDates: Set<Date>
  //   techWeekEnabled: boolean
  //   techWeekDays: number (0 if not enabled)
  //   dressRehearsalEnabled: boolean

  dates = []

  // Step 1: Generate regular rehearsal dates
  for each date from firstRehearsal to (openingNight - 1 day), inclusive:
    if dayOfWeek(date) IN selectedDays AND date NOT IN blockedDates:
      dates.push({ date, startTime, endTime, type: 'regular' })

  // Step 2: Generate tech week (overrides day-of-week filter)
  if techWeekEnabled AND techWeekDays > 0:
    techStart = max(firstRehearsal, openingNight - techWeekDays days)
    techEnd = openingNight - 1 day  // Tech week ends the day before opening
    for each date from techStart to techEnd, inclusive:
      if date IN blockedDates:
        emit warning: "Blocked date {date} falls within tech week and will be skipped"
        continue
      existingIndex = dates.findIndex(d => d.date == date)
      if existingIndex >= 0:
        dates[existingIndex].type = 'tech'  // Upgrade existing regular to tech
      else:
        dates.push({ date, startTime, endTime, type: 'tech' })  // Add new tech day

  // Step 3: Mark dress rehearsals (last 1 day of tech week)
  if dressRehearsalEnabled AND techWeekEnabled:
    techDates = dates.filter(d => d.type == 'tech').sortByDate()
    if techDates.length > 0:
      techDates[techDates.length - 1].type = 'dress'  // Last tech day becomes dress

  // Step 4: Generate performance dates
  for each date from openingNight to closingNight, inclusive:
    if date NOT IN blockedDates:
      dates.push({ date, startTime, endTime, type: 'performance' })

  // Step 5: Sort by date
  dates.sort(byDateAscending)

  // Step 6: Validate
  if dates.length == 0:
    return error("No rehearsal dates could be generated. Please adjust your settings.")

  return dates
```
```

Also add dress rehearsal default to SPEC-003 Section 5: "If dress rehearsal is enabled, the last day of tech week is marked as dress rehearsal (exactly 1 day). There is no question for dress rehearsal day count."

---

### FINDING-03 [HIGH] — 90-Day PII Deletion Job Has No Implementation

**Specs Affected:** SPEC-001 Section 7.3, SPEC-003 Section 6.5
**The Problem:**

SPEC-003 Sec 6.5 says: "After 90 days from `archived_at`, a scheduled job permanently deletes: cast profiles, conflicts, chat messages, and uploaded images."

But:
- No implementation is specified. Is this a cron job on the host? A Node.js application-level scheduler (e.g., node-cron)? A PostgreSQL pg_cron extension? A systemd timer?
- No SQL query is provided for what exactly gets deleted.
- No specification for what "production metadata is retained" means — which columns survive?
- No specification for uploaded image deletion (file system cleanup).
- No error handling for partial deletion failure.
- No logging/audit trail for the deletion event.
- The backup script (SPEC-007 Sec 6.2) runs via "cron on the host machine" — but the PII deletion job is never mentioned alongside it.

A developer at Phase 3 (production archival) will create the archive flow but the deletion job will never exist unless someone remembers to build it.

**Recommended Fix:** Add to SPEC-007 a new section:

```markdown
## 6.3 Scheduled Jobs

Two cron jobs run on the host machine:

| Job | Schedule | Command |
|-----|----------|---------|
| Database backup | Daily at 2:00 AM | `./scripts/backup.sh` (Section 6.2) |
| PII deletion | Daily at 3:00 AM | `./scripts/pii-cleanup.sh` |

**PII Cleanup Script:**

```bash
#!/bin/bash
# Deletes PII for productions archived more than 90 days ago
docker exec callboard-db psql -U callboard -d callboard -c "
  BEGIN;
  -- Find productions archived > 90 days ago
  WITH expired AS (
    SELECT id FROM productions
    WHERE is_archived = TRUE
    AND archived_at < NOW() - INTERVAL '90 days'
    AND archived_at IS NOT NULL
  )
  -- Delete cast profiles
  DELETE FROM cast_profiles WHERE production_id IN (SELECT id FROM expired);
  -- Delete conflicts and submissions
  DELETE FROM cast_conflicts WHERE production_id IN (SELECT id FROM expired);
  DELETE FROM conflict_submissions WHERE production_id IN (SELECT id FROM expired);
  -- Delete chat data
  DELETE FROM messages WHERE conversation_id IN (
    SELECT id FROM conversations WHERE production_id IN (SELECT id FROM expired)
  );
  DELETE FROM conversation_participants WHERE conversation_id IN (
    SELECT id FROM conversations WHERE production_id IN (SELECT id FROM expired)
  );
  DELETE FROM conversations WHERE production_id IN (SELECT id FROM expired);
  -- Delete bulletin posts
  DELETE FROM bulletin_posts WHERE production_id IN (SELECT id FROM expired);
  -- Deactivate invite tokens
  DELETE FROM invite_tokens WHERE production_id IN (SELECT id FROM expired);
  COMMIT;
"
# Delete uploaded headshot images for expired productions
# (headshot_url paths are no longer in DB, so clean orphaned files)
find /path/to/uploads -type f -mtime +90 -name "*.jpg" -o -name "*.png" | xargs rm -f
```

**Retained after cleanup:** `productions` (name, dates, theater_id, is_archived, archived_at), `theaters`, `production_members` (for historical Director reference), `rehearsal_dates` (schedule structure).
```

---

### FINDING-04 [HIGH] — Image Upload Storage Undefined

**Specs Affected:** SPEC-004 Section 3.1, SPEC-007
**The Problem:**

SPEC-004 Sec 3.1 says: "Images are stored in a dedicated uploads directory, never in the database."

But:
- What is the path of this directory? `/app/uploads/`? A Docker volume?
- SPEC-007's docker-compose.yml has no volume for uploads. If the container restarts, all uploads are lost.
- SPEC-007 `.gitignore` includes `uploads/` — so the directory is not in the repo. Where is it created?
- How are images served? Is there a Next.js API route that reads from disk? A static file handler? Express static middleware?
- The Dockerfile copies `/app/public` but not `/app/uploads` — uploads would not survive a rebuild.
- The PII cleanup job (Finding-03) references deleting files but no path is defined.
- SPEC-004 says "Served with `Content-Disposition: inline`, `X-Content-Type-Options: nosniff`" — this implies a custom serving endpoint, but none is defined.

**Recommended Fix:** Add to SPEC-007 Section 4.3 (Docker Compose) a volume:

```yaml
  app:
    volumes:
      - uploads:/app/uploads
volumes:
  pgdata:
  uploads:
```

Add to SPEC-004 Section 3.1:

```markdown
**Storage path:** `/app/uploads/headshots/` inside the app container, backed by a Docker named volume `uploads` (persists across container restarts and rebuilds).

**Serving endpoint:** `GET /api/uploads/[filename]` — a Next.js API route that:
1. Validates the requesting user is authenticated and a member of a production that references this file
2. Reads the file from disk
3. Sets headers: `Content-Type` (based on magic bytes), `Content-Disposition: inline`, `X-Content-Type-Options: nosniff`, `Cache-Control: private, max-age=86400`
4. Returns 404 if the file does not exist

**No direct static file serving.** Images are always served through the authenticated API route to prevent unauthorized access.
```

Add the `uploads` volume to the SPEC-007 docker-compose reference YAML.

---

### FINDING-05 [HIGH] — Staff Demotion Side Effects Undefined

**Specs Affected:** SPEC-001 Section 3.2, SPEC-002 Section 3.2, SPEC-003 Section 6.4
**The Problem:**

A Director can demote a Staff member back to Cast. The spec says: "The cast member's role changes from `staff` to `cast` in `production_members`." But the consequences are completely undefined:

1. **Bulletin posts authored by demoted Staff:** Do they remain visible? Are they attributed to "Staff" or "Cast"? Can the demoted user still edit posts they created while they were Staff? SPEC-003 Sec 6.2 says "Staff can delete their own posts only" — after demotion to Cast, they can no longer delete their own posts (Cast has no delete privilege). But the posts remain with their author_id.

2. **Conflict data visibility:** While a Staff member, they could view all cast conflicts (SPEC-002 permission matrix). After demotion, they lose that privilege. But they may have already seen the data. The spec does not address this — it's a data exposure concern for minors' conflict data.

3. **Chat conversations:** A Staff member can chat with anyone. After demotion to Cast, they retain conversation history with other Cast members (conversations they started while Staff). Can they continue those conversations? SPEC-005 Sec 8 says "When a Cast member sends a message, the server verifies the recipient is Director or Staff." This means a demoted Staff member cannot send NEW messages to Cast, but can they still READ the old conversation? The spec is silent.

4. **Active WebSocket connections:** If a Staff member is demoted while they have an active WebSocket connection, their role has changed but the WebSocket was authenticated at the old role. SPEC-005 Sec 4.1 says sessions are re-validated every 5 minutes — but role is checked per-message, not per-session. The spec does not define role-change propagation to active connections.

**Recommended Fix:** Add a new section to SPEC-003 after Section 6.4:

```markdown
### 6.4.1 Demotion Side Effects

When a Staff member is demoted to Cast:

1. **Bulletin posts:** Posts authored by the demoted user remain visible and attributed to them. The author name still shows. The demoted user can no longer edit or delete their own posts (they are now Cast, which has no post editing capability). The Director retains the ability to edit or delete any post.

2. **Conflict data:** The demoted user immediately loses access to the aggregated conflict view. Their next API request for conflict data returns 403. Previously viewed data is not retroactively protected (accepted risk — same as any web app where a user's permissions are reduced).

3. **Chat conversations:** Existing conversation history with other Cast members remains readable (messages are not deleted). However, the demoted user can no longer send new messages to Cast members — the API enforces Cast-to-Cast blocking on every new message. The contact list is refreshed on next load and no longer shows other Cast members.

4. **WebSocket:** On the next 5-minute re-validation cycle, the server checks the user's current role. If the role has changed, the server closes the WebSocket with code 4401, forcing the client to reconnect and reload the contact list with updated permissions.
```

---

### FINDING-06 [HIGH] — Unverified Cast Member Flow Incomplete

**Specs Affected:** SPEC-002 Section 2.3.1, SPEC-004, SPEC-010 Section 4.2
**The Problem:**

SPEC-002 Sec 2.3.1 says: "Until verified, the user can log in but sees a banner: 'Please verify your email to access all features.' They cannot create a theater or production until verified."

The Cast onboarding flow in SPEC-010 Sec 4.2 is:
```
Click invite link -> Register (age gate) -> Verify Email -> Auto-join production -> Profile Setup -> Conflict Submission -> Bulletin Board
```

But this flow shows verification BEFORE auto-join. If a Cast member registers via email/password (not Google), they get a verification email. The spec says they "can log in" but with restricted access. Questions:

1. Can an unverified Cast member join a production via invite link? The restriction says "cannot create a theater or production" but says nothing about JOINING one. This is ambiguous.
2. If they CAN join, can they submit a cast profile? Submit conflicts? View the bulletin board? Chat?
3. If they CANNOT join until verified, the flow becomes: Register -> Check email -> Verify -> Click invite link again -> Join. This is a terrible UX (the user has to re-click the invite link).
4. The invite link flow (SPEC-002 Sec 2.4) says "Server validates token, stores production_id in session." If the user registers, the production_id should still be in their session. But if they leave to check email and come back, the session may have changed.

**Recommended Fix:** Add to SPEC-002 Section 2.3.1:

```markdown
**Unverified users and invite links:** If a user registers via email/password after clicking an invite link, the production_id is preserved in their session. The user is auto-joined to the production immediately (joining does not require verification). Unverified users CAN: view the bulletin board, view the schedule, set up their profile, and submit conflicts. Unverified users CANNOT: create a theater, create a production, post to the bulletin board, or send chat messages. The verification banner is shown on all pages until the user verifies. This ensures Cast members (who may never need to create anything) are not blocked from their primary workflow by email verification.
```

---

### FINDING-07 [HIGH] — Performance Dates Never Generated

**Specs Affected:** SPEC-003 Section 5, SPEC-006 Section 2.1
**The Problem:**

The rehearsal_dates table has a `type` column with value `performance` (SPEC-003 Sec 8: `CHECK (type IN ('regular', 'tech', 'dress', 'performance'))`). SPEC-006 Sec 2.1 defines performance dates with a Red color code. SPEC-003 Sec 6.1 says the calendar shows "Color-coded: Regular rehearsal, Tech rehearsal, Dress rehearsal, Performance."

But the schedule wizard (SPEC-003 Sec 5) generates dates "between First Rehearsal and Opening Night." Performances happen between opening_night and closing_night. The wizard asks no questions about performance days (which days of the week? every day? only weekends?). There is no mechanism anywhere in the specs to create performance dates.

A Director can manually "Add rehearsal date" (SPEC-003 Sec 7) and could theoretically add performance dates one by one. But the wizard that auto-generates the schedule completely ignores them.

**Recommended Fix:** Add performance date generation to the schedule algorithm. In SPEC-003 Section 5, add:

```markdown
**Performance Date Generation:**
After generating rehearsal dates, the wizard also generates performance dates for every day from `opening_night` to `closing_night` (inclusive). These are added with type `performance` and the same default start/end times. Blocked dates within this range are excluded. The Director can remove unwanted performance dates after generation.
```

Update the pseudocode (from FINDING-02 fix) to include Step 4 generating performance dates.

---

### FINDING-08 [HIGH] — Immutable Constraint Violation: Route Count

**Spec Affected:** SPEC-010
**The Problem:**

SPEC-010 Immutable Constraints (line 33) says: "Exactly 20 routes total." The route table (lines 49-69) lists 19 routes. AUDIT-003 flagged this as F-03 [LOW], saying "Either add the missing 20th route or correct the constraint to say 19."

This is incorrectly categorized as LOW. It is a violation of an **immutable constraint** — by the project's own rules, these constraints "CANNOT" be violated. If the constraint says 20 and the spec says 19, either:
- The constraint is wrong (change to 19), or
- A route is missing.

A builder following the immutable constraint would look for a 20th route that doesn't exist, causing confusion.

**Recommended Fix:** Change the immutable constraint to match reality:

SPEC-010, Immutable Constraints: change "Exactly 20 routes total" to "Exactly 19 routes total"

---

### FINDING-09 [MEDIUM] — MANIFEST Line Numbers Are Stale

**Spec Affected:** SPEC-MANIFEST.xml
**The Problem:**

The manifest's progressive disclosure model relies on line numbers for `Read(file, offset=line, limit=N)`. After three rounds of audit fixes that added substantial content to every spec, the line numbers in the manifest are likely stale. I verified several:

- SPEC-003 `<section name="Database Schema (Director)" line="190"` — the actual schema starts at line 190 in SPEC-003. **CORRECT.**
- SPEC-003 `<section name="Authorization Rules" line="252"` — actual position is line 252. **CORRECT.**
- SPEC-003 `<section name="Test Scenarios" line="260"` — actual position is line 260. **CORRECT.**
- SPEC-004 `<section name="Cast Onboarding Flow" line="45"` — actual position is line 45. **CORRECT.**
- SPEC-010 `<section name="Route Map" line="47"` — actual position is line 47. **CORRECT.**

However, the manifest header says "ALL line numbers are approximate (within +/- 3 lines)." This safety margin appears sufficient given the current state. The main issue is not inaccuracy but rather:

1. **SPEC-003 has overlapping section ranges:** `<section name="Database Schema (Director)" line="190" end="258">` and `<section name="Authorization Rules" line="252" end="258">` overlap from lines 252-258. This means the Authorization Rules are INSIDE the Database Schema section range, which is confusing for progressive disclosure.

2. **SPEC-004 Section "Bulletin Board (Cast View)" line="180"** — the manifest says line 180, but the actual section "5. Bulletin Board (Cast View)" starts at line 180. **CORRECT** but the end line is listed as 200, while the actual section continues to line 200. Content after line 200 (Cast Navigation wireframe) is not indexed in the manifest at all.

3. **SPEC-006 has no section entry for "Schedule Generation Algorithm"** (the section that should contain pseudocode per FINDING-02). When this content is added, the manifest needs a new section entry.

**Recommended Fix:**

1. Fix the overlapping range in SPEC-003: change `<section name="Database Schema (Director)" line="190" end="250">` (end before Authorization Rules)
2. Add a manifest section for SPEC-004's Cast Navigation (lines 202-221)
3. After FINDING-02 is resolved, add a manifest section for SPEC-006 Section 2.2 (schedule algorithm pseudocode)

---

### FINDING-10 [MEDIUM] — AGENT.md / SPEC-008 Phase 10 Mismatch

**Specs Affected:** AGENT.md Section 8, SPEC-008 Section 11
**The Problem:**

AGENT.md Phase 10 says:
```
| 10 | Polish (theme, responsive, a11y) | SPEC-009, SPEC-010 |
```

SPEC-008 Section 11 Phase 10 says:
```
| 10 | Polish: Dark theme, responsive, UX | SPEC-001 | Medium |
```

The manifest's `<phases>` section says:
```xml
<phase n="10" name="Polish" specs="SPEC-009, SPEC-010, SPEC-001">
```

So three sources define Phase 10 differently:
- AGENT.md: SPEC-009, SPEC-010
- SPEC-008: SPEC-001 only
- MANIFEST: SPEC-009, SPEC-010, SPEC-001

SPEC-008 is wrong — it references only SPEC-001 for a phase about theme, responsive design, and accessibility, which are defined in SPEC-009 and SPEC-010.

**Recommended Fix:** Update SPEC-008 Section 11, Phase 10 to:
```
| 10 | Polish: Theater theme, responsive, accessibility | SPEC-009, SPEC-010, SPEC-001 | Medium |
```

---

### FINDING-11 [MEDIUM] — Breached Password List Bundling Not Specified

**Spec Affected:** SPEC-002 Section 2.2
**The Problem:**

SPEC-002 says: "Password MUST be checked against a bundled list of the top 10,000 breached passwords." But:
- What format is the list? A text file? A JSON array? A Set in memory?
- Where does the file live in the project? `/src/lib/breached-passwords.txt`?
- Is it loaded at startup or on every check?
- Where does the developer GET this list? (The original source is Have I Been Pwned's password list, but the spec doesn't say this.)
- How is the check performed? Exact match? Case-insensitive?

**Recommended Fix:** Add to SPEC-002 Section 2.2:

```markdown
**Breached password list:** Ship a static text file at `src/lib/data/breached-passwords.txt` containing the 10,000 most common passwords (one per line, lowercase). Source: extract from the NCSC/Have I Been Pwned top passwords list. Load into a `Set<string>` at application startup. Check is case-insensitive: `breachedSet.has(password.toLowerCase())`. The file is committed to git (it contains no secrets — just common passwords).
```

---

### FINDING-12 [MEDIUM] — System-Generated Bulletin Posts Violate NOT NULL author_id

**Specs Affected:** SPEC-003 Section 6.2, SPEC-004 Section 4.4, SPEC-006 Section 5.1
**The Problem:**

Three features create "system-generated" bulletin posts:
1. SPEC-004 Sec 4.4: Conflict reset creates "Your conflicts have been reset by the director."
2. SPEC-006 Sec 5.1: Schedule change creates "Schedule updated: [description]"
3. Implied: Production archival could generate a notification post.

The `bulletin_posts` table has `author_id UUID NOT NULL REFERENCES users(id)`. A system-generated post has no human author. The NOT NULL constraint means the system cannot create a post without assigning an author.

**Recommended Fix:** Two options (pick one and specify in SPEC-003):

**Option A (Recommended):** System posts are attributed to the Director who triggered the action. The post body makes the automation clear (e.g., "Schedule updated by Director: [description]"). The `author_id` is the Director's user_id. No schema change needed.

**Option B:** Add a `is_system BOOLEAN DEFAULT FALSE` column to `bulletin_posts` and allow `author_id` to be NULL when `is_system = TRUE`. This requires a schema change: `author_id UUID REFERENCES users(id)` (remove NOT NULL) with a CHECK: `CHECK (is_system = TRUE OR author_id IS NOT NULL)`.

Recommended: **Option A** — simpler, no schema change, and the Director IS the person who triggered the action.

---

### FINDING-13 [MEDIUM] — Chat is_read Trigger Undefined

**Spec Affected:** SPEC-005 Section 5, Section 6
**The Problem:**

The `messages` table has `is_read BOOLEAN DEFAULT FALSE`. SPEC-005 Sec 4 says "Unread message count shown on the Chat nav item." SPEC-010 Sec 3.9 says "Unread badge count on conversations."

But no spec defines:
- **When** is `is_read` set to `true`? When the recipient opens the conversation? When the message scrolls into view? When an explicit "mark read" API is called?
- **How** is it set? A `PUT /api/messages/:id/read`? A batch `POST /api/conversations/:id/read`?
- Does the WebSocket notify the sender that the message was read? (SPEC-005 non-goals say "No read receipts beyond the is_read boolean" — so no notification to sender, but the recipient still needs a mechanism to mark messages read.)

**Recommended Fix:** Add to SPEC-005 Section 5:

```markdown
### 5.1 Read Status

Messages are marked as read when the recipient opens the conversation containing them. The client sends a `POST /api/conversations/:id/mark-read` request when the conversation view is opened or gains focus. This sets `is_read = TRUE` on all messages in that conversation where `sender_id != current_user_id` and `is_read = FALSE`. The unread count badge on the Chat nav item reflects the total number of messages across all conversations where `is_read = FALSE` and `sender_id != current_user_id`. No read receipt is sent to the sender (non-goal).
```

---

### FINDING-14 [MEDIUM] — Director Not Added to production_members on Creation

**Specs Affected:** SPEC-002 Section 6, SPEC-003 Section 4
**The Problem:**

The permission model (SPEC-002 Sec 3.3) says every protected route checks: "Does the user belong to this production?" via the `production_members` table. The permission matrix checks `production_members.role`.

But when a Director creates a production (SPEC-003 Sec 4), the spec says: "Director creates a production within a theater." The creation flow never mentions inserting a row into `production_members` with `role = 'director'`.

The theater ownership check (SPEC-003 Sec 8.1) uses `theaters.owner_id`, but production-level access uses `production_members`. Without a production_members row, the Director who created the production would fail their own membership check on the production dashboard.

**Recommended Fix:** Add to SPEC-003 Section 4 (Add Production):

```markdown
**On production creation:** The server inserts a `production_members` row with `production_id`, `user_id = Director's user_id`, and `role = 'director'`. This ensures the Director passes the standard RBAC middleware check (authenticate -> verify membership -> verify role) for all production endpoints.
```

---

### FINDING-15 [MEDIUM] — Dress Rehearsal Day Count Still Unresolved

**Spec Affected:** SPEC-003 Section 5
**The Problem:**

AUDIT-003 Finding F-08 flagged this as LOW: "Dress rehearsal count (1 or 2 days) not asked in wizard." It recommended adding a follow-up question or defining a fixed default.

This is not LOW — it is a **schedule generation blocker**. The algorithm cannot run without knowing how many days to mark as dress rehearsal. The spec says "last 1-2 days of tech week" which is a range, not a value. A builder implementing the pure function has to pick 1 or 2, and two builders will pick differently, violating the "byte-identical output" requirement.

**Recommended Fix:** Define a fixed default in SPEC-003 Section 5:

```markdown
**Dress rehearsal:** If dress rehearsal is enabled, exactly the last 1 day of tech week is marked as `dress` type. This is a fixed default — there is no wizard question for the dress rehearsal count. If the Director wants 2 dress rehearsal days, they can manually change the second-to-last tech day's type to `dress` after generation (via schedule editing, SPEC-003 Section 7).
```

---

### FINDING-16 [MEDIUM] — "New Message" Chat Flow Undefined

**Specs Affected:** SPEC-005, SPEC-010 Section 3.9
**The Problem:**

SPEC-010 Sec 3.9 wireframe shows a "+ New Message" button on the chat page. SPEC-005 Sec 3.3 defines the contact list per role. But no spec describes the flow for starting a new conversation:

1. User clicks "+ New Message"
2. What happens? A modal showing the contact list? A search field? An inline selector?
3. User selects a recipient. Is a conversation created immediately (empty)? Or only when the first message is sent?
4. What if a conversation already exists with that recipient? (Deduplication says reuse it — but the UI flow to get there is undefined.)

**Recommended Fix:** Add to SPEC-010 Section 3.9:

```markdown
**New Message Flow:**
1. User clicks "+ New Message"
2. A modal/overlay appears showing the user's contact list (filtered by role per SPEC-005 Sec 3.3)
3. User types to search/filter contacts by name
4. User selects a contact
5. If a conversation already exists with that contact, navigate to it
6. If no conversation exists, navigate to a new conversation view with the selected contact. The conversation record is created on the server when the first message is sent (not on contact selection)
```

---

### FINDING-17 [MEDIUM] — JetBrains Mono Font Not in Setup

**Spec Affected:** SPEC-009 Section 4.5
**The Problem:**

SPEC-009 Sec 4.5 (Typography) specifies `"JetBrains Mono", monospace` for schedule dates. Section 4.5 also says: "Playfair Display and Libre Franklin loaded via `next/font/google` with `display: swap`."

JetBrains Mono is NOT mentioned in the font loading instruction. A builder would load Playfair Display and Libre Franklin but forget JetBrains Mono, causing the schedule to fall back to the system monospace font.

**Recommended Fix:** Change SPEC-009 Section 4.5 font loading instruction to:

```markdown
**Font loading:** Playfair Display, Libre Franklin, and JetBrains Mono loaded via `next/font/google` with `display: swap`. System fallbacks ensure no FOIT.
```

---

### FINDING-18 [MEDIUM] — Unarchive Flow Has No UI

**Specs Affected:** SPEC-003 Section 6.5, SPEC-010 Section 3.13
**The Problem:**

SPEC-003 Sec 6.5 says: "Director can unarchive within the 90-day window if needed (restores full access)." This is a specified behavior with no UI to trigger it.

SPEC-010 Sec 3.13 (Production Settings) only defines: "Archive production" and "Delete production." There is no "Unarchive" button.

When a production is archived, it becomes read-only. The Director presumably cannot access the Settings page (or can they?). Even if they can, no unarchive button is defined.

**Recommended Fix:** Add to SPEC-010 Section 3.13:

```markdown
**Archived production view:** When a production is archived, the production dashboard shows a banner: "This production was archived on [date]. All data will be permanently deleted on [date + 90 days]." Below the banner, two buttons:
- **[Unarchive Production]** — Restores full access. Confirmation: "This will restore the production to active status. Are you sure?"
- **[Delete Now]** — Permanent delete with re-authentication.

The Settings page is accessible to the Director for archived productions (for unarchive and delete actions) but all other editing is disabled.
```

---

### FINDING-19 [MEDIUM] — Session Rolling Refresh Undefined

**Spec Affected:** SPEC-002 Section 4
**The Problem:**

SPEC-002 Sec 4 says: "Session expiry: 30 days (rolling — refreshed on activity)." But:
- What constitutes "activity"? Every HTTP request? Only authenticated requests? Page loads only? API calls?
- How is the refresh implemented? Update `sessions.expires_at` on every request? That's a DB write on every page load. Or only refresh when the session is within N days of expiry (sliding window)?
- What is the new expiry after refresh? Another 30 days from now?

**Recommended Fix:** Add to SPEC-002 Section 4:

```markdown
**Rolling refresh:** On each authenticated request, if the session's `expires_at` is less than 7 days away, update `expires_at` to `NOW() + 30 days`. This avoids a database write on every request while ensuring active users are never unexpectedly logged out. Sessions that are idle for more than 30 days expire naturally.
```

---

### FINDING-20 [LOW] — productions.archived_at Missing from Schema SQL

**Spec Affected:** SPEC-003 Section 8
**The Problem:**

AUDIT-003 Finding F-09 flagged this: "`archived_at` mentioned in text but absent from schema SQL." This has not been fixed. SPEC-003 Sec 6.5 references `archived_at` as the timestamp for the 90-day countdown. SPEC-003 Sec 8 schema has `is_archived BOOLEAN DEFAULT FALSE` but no `archived_at` column.

**Recommended Fix:** Add to SPEC-003 Section 8, productions table:

```sql
  archived_at         TIMESTAMPTZ,                  -- set on archive, used for 90-day PII deletion countdown
```

---

### FINDING-21 [LOW] — Re-clicking Invite Link When Already a Member

**Specs Affected:** SPEC-002 Section 2.4, SPEC-004 Section 2
**The Problem:**

What happens when a user who is already a member of a production clicks the invite link again? The `production_members` table has `UNIQUE(production_id, user_id)`, so a second INSERT would fail with a unique constraint violation.

The spec never addresses this case. Is it:
- A silent redirect to the production dashboard?
- An error: "You are already a member of this production"?
- An ignored duplicate (try insert, catch constraint violation, redirect)?

**Recommended Fix:** Add to SPEC-002 Section 2.4:

```markdown
**Already a member:** If an authenticated user clicks an invite link for a production they already belong to, the server silently redirects them to the production's bulletin board. No error is shown. No duplicate production_members row is created.
```

---

### FINDING-22 [LOW] — Conversation Deduplication Query Missing Index

**Spec Affected:** SPEC-005 Section 6
**The Problem:**

SPEC-005 says to use `SELECT ... FOR UPDATE` to find existing conversations between two participants. The schema has:
- `conversations` table with `production_id`
- `conversation_participants` table with `(conversation_id, user_id)` UNIQUE

But to find a conversation between user A and user B in production P, the query requires joining conversations and conversation_participants twice. There is no index to support this efficiently. With 50+ cast members and many conversations, this query will degrade.

**Recommended Fix:** Add to SPEC-005 Section 6:

```sql
CREATE INDEX idx_conversation_participants_user ON conversation_participants(user_id);
CREATE INDEX idx_conversations_production ON conversations(production_id);
```

---

### FINDING-23 [LOW] — Theater Edit/Delete Not Specified

**Spec Affected:** SPEC-003
**The Problem:**

SPEC-003 defines theater creation (Section 3) but never defines:
- Can a Director edit a theater's name, city, or state after creation?
- Can a Director delete a theater? What happens to its productions?
- No route exists in SPEC-010 for theater editing.

**Recommended Fix:** Add to SPEC-003 Section 3:

```markdown
**Theater editing:** The Director can edit the theater name, city, and state from the account dashboard. Changes are validated with the same constraints as creation. Theater deletion is not available in v1 — a theater with productions cannot be deleted (data integrity). An empty theater (no productions) can be removed with confirmation.
```

---

### FINDING-24 [LOW] — CI/CD Workflow Undefined

**Spec Affected:** SPEC-008 Section 10
**The Problem:**

SPEC-008 Sec 10 says: "Tests run on every push and PR via GitHub Actions (see `.github/workflows/ci.yml`)" and lists 6 steps. But no actual YAML content or structure is provided. SPEC-007 lists GitHub Actions in the Tech Stack table. A builder would have to create the CI workflow from scratch.

**Recommended Fix:** Add a reference CI structure to SPEC-008 Section 10:

```yaml
# .github/workflows/ci.yml (reference structure)
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16.6-alpine
        env:
          POSTGRES_USER: callboard
          POSTGRES_PASSWORD: test
          POSTGRES_DB: callboard_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run lint
      - run: npm test
        env:
          DATABASE_URL: postgresql://callboard:test@localhost:5432/callboard_test
      - run: npm run build
```

---

### FINDING-25 [LOW] — Account Settings OAuth Linking Undefined

**Spec Affected:** SPEC-010 Section 3.12
**The Problem:**

SPEC-010 Sec 3.12 (Account Settings) says: "Connected accounts: Link/unlink Google OAuth." SPEC-002 defines safe auto-linking at registration/login. But no spec describes:
- How does a user link Google OAuth from the account settings page?
- The flow: click "Link Google" -> OAuth redirect -> callback -> verify ownership -> link
- How does unlinking work? If the user has no password set (Google-only auth), can they unlink? (That would lock them out.)

**Recommended Fix:** Add to SPEC-010 Section 3.12:

```markdown
**Google OAuth linking:**
- **Link:** User clicks "Link Google Account" -> OAuth flow (same as login) -> on callback, server links the Google ID to the user record if the Google email matches and both sides are verified (same rules as SPEC-002 Sec 2.1)
- **Unlink:** User clicks "Unlink Google Account" -> confirmation dialog. If the user has no password set, they must set a password first before unlinking (otherwise they would have no way to log in)
- If both password and Google are linked, either can be used to log in independently
```

---

### FINDING-26 [LOW] — CSP + Data URI Texture Interaction

**Spec Affected:** SPEC-009 Section 4.3, SPEC-002 Section 5.1
**The Problem:**

SPEC-009 Sec 4.3 says the cork board texture uses `background-image: url("data:image/svg+xml,...")` — an inline SVG data URI. SPEC-002 Sec 5.1 defines CSP as: `img-src 'self' blob: data:`. The `data:` source is included, so the texture technically works.

However, `data:` in `img-src` combined with `style-src 'unsafe-inline'` (also in the CSP) creates a known bypass vector where attackers can inject SVG-via-data-URI payloads through inline styles. This is a defense-in-depth concern, not an active vulnerability (since the app already sanitizes all user input).

**Recommended Fix:** This is an accepted risk for v1. Add a comment to SPEC-002 Section 5.1:

```markdown
**Note:** `data:` in `img-src` is required for CSS texture effects (SPEC-009 Sec 4.3). This broadens the CSP slightly. User-supplied content is never rendered as data URIs — only hardcoded CSS textures use this path.
```

---

## Prototype Completeness Checklist

Every user flow traced step by step, verified against the specs for completeness.

### Flow 1: Director Registration and First Production

| Step | Action | Spec Coverage | Status |
|------|--------|--------------|--------|
| 1.1 | Director visits `/register` | SPEC-010 Sec 3.2, SPEC-002 Sec 2.3 | PASS |
| 1.2 | Enters name, email, DOB, password | SPEC-002 Sec 2.3, SPEC-010 Sec 3.2 | PASS |
| 1.3 | Age gate validates 13+ | SPEC-002 Sec 2.3, SPEC-001 Sec 7.1 | PASS |
| 1.4 | Password checked against breached list | SPEC-002 Sec 2.2 | **FAIL** — list format/location undefined (FINDING-11) |
| 1.5 | Privacy policy checkbox required | SPEC-010 Sec 3.2, SPEC-001 Sec 7.4 | PASS |
| 1.6 | Server creates user, sends verification email | SPEC-002 Sec 2.3.1 | **FAIL** — no email delivery mechanism (FINDING-01) |
| 1.7 | User clicks verification link | SPEC-002 Sec 2.3.1 | PASS (flow defined) |
| 1.8 | User logs in, sees empty dashboard | SPEC-010 Sec 3.3 | PASS |
| 1.9 | User clicks "Add Theater" | SPEC-003 Sec 3, SPEC-010 Sec 3.3 | PASS |
| 1.10 | Enters theater name, city, state | SPEC-003 Sec 3 | PASS |
| 1.11 | User clicks "Create Production" | SPEC-003 Sec 4, SPEC-010 Sec 3.4 | PASS |
| 1.12 | Enters production name, dates, cast size | SPEC-003 Sec 4 | PASS |
| 1.13 | Director added to production_members | Implicit in RBAC model | **FAIL** — creation flow never specifies this INSERT (FINDING-14) |
| 1.14 | Schedule wizard Step 1-6 | SPEC-003 Sec 5, SPEC-010 Sec 3.4 | PASS |
| 1.15 | Schedule wizard Step 7 (review + generate) | SPEC-003 Sec 5 | **FAIL** — no pseudocode, performance dates missing (FINDING-02, -07) |
| 1.16 | Production dashboard loads | SPEC-010 Sec 3.5 | PASS |
| 1.17 | Director copies invite link | SPEC-003 Sec 6.3, SPEC-010 Sec 3.8 | PASS |
| 1.18 | Director posts to bulletin board | SPEC-003 Sec 6.2, SPEC-010 Sec 3.7 | PASS |

### Flow 2: Cast Member Joining via Invite Link

| Step | Action | Spec Coverage | Status |
|------|--------|--------------|--------|
| 2.1 | Cast receives invite link | SPEC-002 Sec 2.4 | PASS |
| 2.2 | Clicks link: `/join?token=xxx` | SPEC-002 Sec 2.4, SPEC-004 Sec 2 | PASS |
| 2.3 | Token validated, stored in session | SPEC-002 Sec 2.4 | PASS |
| 2.4 | Not logged in: redirect to register | SPEC-004 Sec 2 | PASS |
| 2.5 | Registers with email/password, DOB, age gate | SPEC-002 Sec 2.3 | PASS |
| 2.6 | Verification email sent | SPEC-002 Sec 2.3.1 | **FAIL** — no email mechanism (FINDING-01) |
| 2.7 | Unverified user auto-joins production? | SPEC-002 Sec 2.3.1, SPEC-004 Sec 2 | **FAIL** — ambiguous (FINDING-06) |
| 2.8 | Redirect to cast profile setup | SPEC-004 Sec 3, SPEC-010 Sec 3.11 | PASS |
| 2.9 | Enters name, phone, role, optional headshot | SPEC-004 Sec 3 | PASS |
| 2.10 | Headshot uploaded, magic bytes checked, EXIF stripped | SPEC-004 Sec 3.1 | **FAIL** — storage path undefined (FINDING-04) |
| 2.11 | Profile saved to cast_profiles | SPEC-004 Sec 4.5 | PASS (table exists) |
| 2.12 | Redirect to conflict submission | SPEC-010 Sec 3.10 | PASS |
| 2.13 | Cast sees calendar, selects conflict dates | SPEC-004 Sec 4.1, SPEC-010 Sec 3.10 | PASS |
| 2.14 | Enters optional reasons (max 500 chars) | SPEC-004 Sec 4.1 | PASS |
| 2.15 | Submits conflicts (transaction, UNIQUE guard) | SPEC-004 Sec 4.3 | PASS |
| 2.16 | Redirect to bulletin board (poster tab) | SPEC-010 Sec 3.7, SPEC-004 Sec 5 | PASS |
| 2.17 | Cast views posts | SPEC-004 Sec 5.1 | PASS |
| 2.18 | Cast views schedule tab | SPEC-004 Sec 5.2 | PASS |
| 2.19 | Cast navigates to chat | SPEC-010 Sec 3.9 | PASS |
| 2.20 | Cast sees only Director/Staff in contacts | SPEC-005 Sec 3.3 | PASS |
| 2.21 | Cast clicks "+ New Message" to start chat | SPEC-010 Sec 3.9 | **FAIL** — new message flow undefined (FINDING-16) |

### Flow 3: Director Daily Use (Schedule + Conflicts + Chat)

| Step | Action | Spec Coverage | Status |
|------|--------|--------------|--------|
| 3.1 | Director logs in, goes to production dashboard | SPEC-010 Sec 3.5 | PASS |
| 3.2 | Views quick stats (cast count, conflict count) | SPEC-010 Sec 3.5 wireframe | PASS (wireframe shows it) |
| 3.3 | Views upcoming schedule with conflict counts | SPEC-006 Sec 4.1 | PASS |
| 3.4 | Clicks a date, sees conflict names + reasons | SPEC-006 Sec 4.1 | PASS |
| 3.5 | Edits a rehearsal time | SPEC-003 Sec 7 | PASS |
| 3.6 | System bulletin post created for schedule change | SPEC-006 Sec 5.1 | **FAIL** — system post author_id undefined (FINDING-12) |
| 3.7 | Views conflict summary table | SPEC-006 Sec 4.2 | PASS |
| 3.8 | Director promotes a Cast member to Staff | SPEC-003 Sec 6.4, SPEC-002 Sec 3.2 | PASS |
| 3.9 | Director demotes a Staff member | SPEC-003 Sec 6.4 | **FAIL** — side effects undefined (FINDING-05) |
| 3.10 | Director resets a cast member's conflicts | SPEC-004 Sec 4.4 | PASS |
| 3.11 | Director opens chat, sends message to Cast | SPEC-005, SPEC-010 Sec 3.9 | PASS |
| 3.12 | Director deletes an inappropriate message | SPEC-005 Sec 7 | PASS |
| 3.13 | Director archives production after closing | SPEC-003 Sec 6.5 | PASS |
| 3.14 | Director wants to unarchive | SPEC-003 Sec 6.5 | **FAIL** — no UI for unarchive (FINDING-18) |

### Flow 4: Account Management

| Step | Action | Spec Coverage | Status |
|------|--------|--------------|--------|
| 4.1 | User visits `/account` | SPEC-010 Sec 3.12 | PASS |
| 4.2 | Edits name, email | SPEC-010 Sec 3.12 | PASS (defined) |
| 4.3 | Changes password | SPEC-010 Sec 3.12 | PASS (defined) |
| 4.4 | Links Google OAuth from settings | SPEC-010 Sec 3.12 | **FAIL** — flow undefined (FINDING-25) |
| 4.5 | Logs out of all devices | SPEC-002 Sec 4 | PASS |
| 4.6 | Deletes account with re-auth | SPEC-010 Sec 3.12 | PASS |

### Flow 5: Password Reset

| Step | Action | Spec Coverage | Status |
|------|--------|--------------|--------|
| 5.1 | User clicks "Forgot password" | SPEC-010 Sec 3.1 | PASS |
| 5.2 | Enters email | SPEC-002 Sec 2.5 | PASS |
| 5.3 | Server sends reset email | SPEC-002 Sec 2.5 | **FAIL** — no email mechanism (FINDING-01) |
| 5.4 | User clicks reset link | SPEC-002 Sec 2.5 | PASS (flow defined) |
| 5.5 | Enters new password, all sessions invalidated | SPEC-002 Sec 2.5 | PASS |

---

## Summary

| Severity | Count | Items |
|----------|-------|-------|
| CRITICAL | 2 | FINDING-01 (email delivery), FINDING-02 (schedule algorithm) |
| HIGH | 6 | FINDING-03 (PII deletion job), FINDING-04 (upload storage), FINDING-05 (demotion effects), FINDING-06 (unverified cast flow), FINDING-07 (performance dates), FINDING-08 (route count constraint) |
| MEDIUM | 10 | FINDING-09 through FINDING-19 |
| LOW | 7 | FINDING-20 through FINDING-26 |
| **Total** | **26** | |

### Prototype Completeness Score

| Flow | Steps | Pass | Fail | Completion |
|------|-------|------|------|------------|
| Director Registration + First Production | 18 | 14 | 4 | 78% |
| Cast Joining via Invite | 21 | 17 | 4 | 81% |
| Director Daily Use | 14 | 10 | 4 | 71% |
| Account Management | 6 | 5 | 1 | 83% |
| Password Reset | 5 | 4 | 1 | 80% |
| **Total** | **64** | **50** | **14** | **78%** |

### Verdict

**NOT ready for implementation without fixes.** The two CRITICAL findings (email delivery and schedule algorithm) are day-1 blockers. The six HIGH findings will block specific phases. An AI builder handed these specs today would be stuck before completing Phase 2 (Auth) because they cannot send verification emails.

**Estimated fix time:** 2-3 hours of spec editing to resolve all 26 findings. The 2 CRITICALs and 6 HIGHs should be fixed before any code is written. The 10 MEDIUMs should be fixed before their respective implementation phases. The 7 LOWs can be addressed during implementation.
