# Implementation Prompt — Digital Call Board

You are building the **Digital Call Board**, a web application that replaces the physical backstage call board for theater productions. You are implementing the ENTIRE application from an empty `src/` directory to a fully functional, deployable product.

---

## Ground Rules

1. **Specs are the source of truth.** Read `spec/SPEC-MANIFEST.xml` first. It tells you which spec sections to read for every task. Never implement from memory — always read the spec section first.
2. **Follow TDD.** Every feature: write the test, observe RED, write minimum code, observe GREEN, refactor. No exceptions. See SPEC-008.
3. **Follow AGENT.md.** It defines commit rules, verification integrity, security rules, and theme rules. Read it before starting.
4. **Follow the implementation phases in order.** Do not skip ahead. Each phase builds on the previous one.
5. **Fix AUDIT-007 HIGH findings first** (see `spec/archive/AUDIT-007-pre-implementation.md`). Three fixes are required before coding begins.

---

## Pre-Implementation: Fix 3 Spec Issues (5 minutes)

Before writing any application code, fix these spec contradictions identified in AUDIT-007:

### Fix 1: SPEC-006 system post author (S-01 — HIGH)
In `spec/SPEC-006-schedule.md` line 199, change:
```
1. Create a bulletin post with `is_system = TRUE` and `author_id = NULL`
```
To:
```
1. Create a bulletin post with `author_id` set to the Director's user_id who triggered the action
```
There is no `is_system` column in the bulletin_posts schema. System posts are attributed to the Director per SPEC-003 Section 6.2 line 180.

### Fix 2: One-theater and one-production guard (L-01, L-02 — HIGH/MEDIUM)
In `spec/SPEC-003-director-flow.md`, add after line 68:
```
- If the Director already has a theater, `POST /api/theaters` MUST return `409 Conflict` with message "You already have a theater." The `/theater/new` page MUST redirect to the dashboard if the Director already has a theater.
```
And add after line 86:
```
- If the Director already has an active (non-archived) production, `POST /api/productions` MUST return `409 Conflict` with message "You already have an active production." The `/production/new` page MUST redirect to the existing production if one exists.
```

### Fix 3: PII cleanup transaction (X-01 — HIGH)
In `spec/SPEC-007-infrastructure.md` Section 7.3, wrap the cleanup SQL in an explicit transaction:
```sql
SELECT cron.schedule(
  'pii-cleanup',
  '0 3 * * *',
  $$
    BEGIN;
    WITH expired AS (
      SELECT id FROM productions
      WHERE is_archived = TRUE
      AND archived_at < NOW() - INTERVAL '90 days'
      AND archived_at IS NOT NULL
    )
    -- ... (existing DELETE statements) ...
    COMMIT;
  $$
);
```

---

## Phase 1: Project Scaffolding & Infrastructure

**Goal:** Developer can run `docker compose up db -d && npm install && npm run dev` and see a running app at localhost:3000 with a health check endpoint.

**Read:** SPEC-007 (full), SPEC-009 Section 3 (project structure), SPEC-008 Section 5 (test tooling)

### Tasks:

1. **Initialize Next.js project**
   ```bash
   npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
   ```

2. **Install all dependencies** (one command, do not add anything not in the specs):
   ```
   # Core
   drizzle-orm pg @types/pg drizzle-kit
   next-auth @auth/drizzle-adapter
   zod react-hook-form @hookform/resolvers
   bcryptjs @types/bcryptjs
   nodemailer @types/nodemailer
   sharp (EXIF stripping)
   react-markdown rehype-sanitize remark-gfm
   react-day-picker date-fns
   lucide-react sonner
   ws @types/ws (dev WebSocket server)

   # shadcn/ui (init then add components as needed)
   npx shadcn-ui@latest init

   # Dev/Test
   vitest @vitejs/plugin-react
   @testing-library/react @testing-library/jest-dom
   next-test-api-route-handler
   @faker-js/faker
   concurrently
   ```

3. **Configure fonts** in `src/app/layout.tsx`:
   - Playfair Display (serif, headings)
   - Libre Franklin (sans-serif, body)
   - JetBrains Mono (monospace, schedule dates)
   - All via `next/font/google` with `display: swap`

4. **Set up Tailwind theme** in `src/styles/globals.css`:
   - All color tokens from SPEC-009 Section 4.2 as CSS custom properties
   - Dark theme only (no light mode classes)
   - Extend `tailwind.config.ts` with the custom color tokens

5. **Create `docker-compose.yml`** per SPEC-007 Section 4.1 (PostgreSQL 16 Alpine)

6. **Create `.env.example`** with all variables from SPEC-007 Sections 6.1-6.4 with placeholder values and comments

7. **Set up Drizzle ORM:**
   - `src/lib/db/index.ts` — database client using `DATABASE_URL`
   - `src/lib/db/schema.ts` — ALL tables from ALL specs (users, sessions, password_reset_tokens, email_verification_tokens, production_members, invite_tokens, theaters, productions, rehearsal_dates, bulletin_posts, cast_profiles, cast_conflicts, conflict_submissions, conversations, conversation_participants, messages, chat_rate_limits)
   - `drizzle.config.ts` — pointing to schema file, using `DATABASE_URL_DIRECT` for migrations
   - Add npm scripts: `db:push`, `db:generate`, `db:migrate`, `db:studio`

8. **Create health check:** `src/app/api/health/route.ts`
   - `GET /api/health` returns `{ status: "ok", db: "connected" }` (200) or `{ status: "error", db: "disconnected" }` (503)
   - Executes `SELECT 1` with 3-second timeout

9. **Set up Vitest:**
   - `vitest.config.ts` with global setup that runs migrations on `callboard_test`
   - `tests/helpers/db.ts` — test database client, transaction wrapper for test isolation
   - `tests/helpers/fixtures.ts` — factory functions for creating test users, productions, etc.

10. **Create project file structure** per SPEC-009 Section 3 (empty placeholder files for all directories)

11. **Set up `npm run dev`** with concurrently: Next.js dev server + ws WebSocket server on port 3001

12. **Configure security headers** in `next.config.js` per SPEC-002 Section 5.1

13. **Fix .gitignore:** Add `uploads/` and `coverage/` per SPEC-007 Section 8

14. **Fix .env:** Move `SUPABASE_ACCESS_TOKEN` to a separate `.env.supabase` file (not loaded by Next.js). Add `?pgbouncer=true` to DATABASE_URL.

### Tests for Phase 1:
- INFRA-01: Docker PostgreSQL starts and is accessible
- INFRA-02: Health check returns db: connected
- INFRA-09: .env.local not in git

### Commit: `infra: project scaffolding, database schema, health check, test setup`

---

## Phase 2: Authentication

**Goal:** Users can register (email/password + Google OAuth), log in, log out, reset passwords, and verify email. Sessions are server-side in PostgreSQL. RBAC middleware protects routes.

**Read:** SPEC-002 (full), SPEC-001 Sections 7.1-7.2 (age gate, PII), SPEC-010 Sections 3.1-3.2 (login/register pages)

### Tasks:

1. **NextAuth.js configuration** (`src/lib/auth.ts`):
   - Google OAuth provider (Authorization Code + PKCE)
   - Credentials provider (email/password)
   - Drizzle adapter for database sessions (NOT JWT strategy)
   - Session callback that includes user role and production memberships
   - 30-day session expiry with 7-day rolling refresh

2. **Password utilities** (`src/lib/auth/password.ts`):
   - `hashPassword(plain)` — bcrypt cost factor 12
   - `verifyPassword(plain, hash)` — bcrypt compare
   - `isBreachedPassword(plain)` — check against `src/lib/data/breached-passwords.txt` (10k passwords, loaded into Set at startup, case-insensitive)
   - Minimum 8 characters validation

3. **Registration API** (`src/app/api/auth/register/route.ts`):
   - POST: validate name, email, DOB, password with Zod
   - Age gate: compute age from DOB, block under 13, derive age_range ("13-17" or "18+"), discard raw DOB
   - Anti-enumeration: always return "Check your email for verification" regardless of email existence
   - Hash password, create user, send verification email
   - Breached password check

4. **Email verification:**
   - `POST /api/auth/verify-email` — validate token (SHA-256 hash lookup), set `email_verified = true`
   - `POST /api/auth/resend-verification` — rate limited 3/hour/email
   - Token: 256-bit random, SHA-256 hashed before storage, 24-hour expiry, single-use

5. **Password reset:**
   - `POST /api/auth/forgot-password` — anti-enumeration (always says "check email")
   - `POST /api/auth/reset-password` — validate token, update password hash, delete ALL sessions for user
   - Token: 256-bit random, SHA-256 hashed, 1-hour expiry, single-use
   - Rate limit: 3 per email per hour

6. **Login rate limiting and lockout:**
   - 5 attempts per minute per IP → 429
   - 10 failed attempts in 15 minutes → 30-minute lockout + email notification
   - `failed_login_attempts` counter resets on successful login

7. **RBAC middleware** (`src/lib/middleware/auth.ts`):
   - `requireAuth()` — validate session cookie, return 401 if invalid
   - `requireMember(productionId)` — verify production_members row, return 403 if not member
   - `requireRole(productionId, roles[])` — verify role is in allowed list, return 403 if not
   - Chain: authenticate → verify membership → verify role

8. **Email delivery** (`src/lib/email.ts`):
   - Nodemailer with SMTP transport (TLS, port 587)
   - Templates: verification, password reset, lockout notification
   - Failures logged at error level but do NOT block the user action

9. **Auth UI pages:**
   - `/login` — Google OAuth button + email/password form (SPEC-010 Section 3.1 wireframe)
   - `/register` — age gate + Google OAuth + email/password form (SPEC-010 Section 3.2)
   - `/forgot-password` — email input form
   - `/reset-password` — new password form (from email link)
   - `/verify-email` — token handler + pending state
   - All forms: Zod validation on blur + submit, inline errors, disabled submit while invalid

10. **API error format:** All API routes return errors per SPEC-002 Section 3.4 (`{ error: "ERROR_CODE", message: "..." }`). Implement a shared `apiError()` helper.

### Tests for Phase 2:
Write tests for ALL of AUTH-01 through AUTH-29, SEC-01, SEC-04, SEC-07, SEC-08, SEC-09, SEC-10.

### Commits (split by sub-feature):
- `feat: user registration with age gate and breached password check`
- `feat: email/password login with rate limiting and lockout`
- `feat: Google OAuth with PKCE and safe account linking`
- `feat: email verification flow`
- `feat: password reset flow with session invalidation`
- `feat: RBAC middleware (authenticate, membership, role)`
- `feat: login and registration UI pages`

---

## Phase 3: Director — Theater & Production CRUD

**Goal:** Director can create a theater, create a production, and land on an empty production dashboard.

**Read:** SPEC-003 Sections 2-4, 8 (theater + production CRUD, schema, auth rules), SPEC-010 Sections 3.3-3.5 (dashboard, create production, production dashboard)

### Tasks:

1. **Theater API:**
   - `POST /api/theaters` — create theater (validate name/city/state max lengths). Guard: one theater per Director (409 if exists). Verify owner.
   - `GET /api/theaters` — list Director's theaters
   - Owner verified on all theater endpoints

2. **Production API:**
   - `POST /api/productions` — create production within theater. Validate date ordering (`first_rehearsal <= opening_night <= closing_night`). Guard: one active production per Director (409 if exists). Auto-insert `production_members` row with `role = 'director'`.
   - `GET /api/productions/[id]` — get production details (require membership)
   - `PATCH /api/productions/[id]` — update details (require Director/Staff role)

3. **Dashboard pages:**
   - `/` (dashboard) — list productions, empty states per SPEC-010 Section 3.3
   - `/theater/new` — form with name/city/state. Redirect to dashboard if theater exists.
   - `/production/new` — placeholder for wizard (built in Phase 4). Redirect to existing production if one exists.
   - `/production/[id]` — production dashboard layout with sidebar nav

4. **Shared layout** (`src/app/(dashboard)/layout.tsx`):
   - Sidebar with navigation items per SPEC-009 Section 6
   - Role-aware: Cast sees only Bulletin Board + Chat
   - Mobile: bottom nav with 3 items

### Tests for Phase 3:
DIR-01, DIR-02, DIR-14, DIR-15, DIR-19

### Commit: `feat: theater and production CRUD with dashboard UI`

---

## Phase 4: Schedule Builder Wizard

**Goal:** Director answers 7 questions and gets a generated rehearsal calendar.

**Read:** SPEC-003 Section 5 (wizard questions + pseudocode), SPEC-006 Sections 2.1-2.3 (algorithm, types), SPEC-010 Section 3.4 (wizard UI)

### Tasks:

1. **Schedule generation pure function** (`src/lib/schedule/generator.ts`):
   - Input: 7 wizard answers + production dates
   - Output: array of `{ date, startTime, endTime, type }` records
   - Implement the exact algorithm from SPEC-006 Section 2.2
   - Handle ALL edge cases: tech week override, blocked date override, tech week clamped to first rehearsal, dress rehearsal as subset of tech week, performance dates, empty schedule error

2. **Schedule wizard UI** (`/production/new`):
   - 7-step form with horizontal stepper (SPEC-010 Section 3.4)
   - Step 7: preview generated calendar using react-day-picker with color-coded dates
   - Zod validation per step before advancing
   - "Create Production" button on step 7 sends ALL data (production details + wizard answers)
   - Mobile: full-screen steps with progress bar "{N}/7"

3. **Schedule API:**
   - `POST /api/productions` extended to accept wizard data and generate schedule in the same transaction (create production + insert rehearsal_dates)
   - `GET /api/productions/[id]/schedule` — return all rehearsal dates for a production (non-deleted)

4. **Schedule view page** (`/production/[id]/schedule`):
   - Month calendar grid with color-coded dates per SPEC-009 Section 4.4
   - Director: click date opens edit panel (time, note, cancel, remove, delete)
   - Cast: read-only view (built in Phase 6 when cast flow exists)
   - Color legend at top

5. **Schedule manipulation APIs:**
   - `POST /api/productions/[id]/schedule/dates` — add a rehearsal date
   - `PATCH /api/productions/[id]/schedule/dates/[dateId]` — update time, note, cancel
   - `DELETE /api/productions/[id]/schedule/dates/[dateId]` — soft-delete (default) or hard-delete (with `?permanent=true`)
   - All modifications create a system bulletin post attributed to the Director

### Tests for Phase 4:
DIR-03, DIR-04, DIR-05, DIR-06, DIR-07, DIR-16, DIR-17, DIR-18, DIR-22, SCHED-01, SCHED-02, SCHED-03, SCHED-07, SCHED-08, SCHED-09, SCHED-11, SCHED-13

### Commits:
- `feat: deterministic schedule generation algorithm with edge cases`
- `feat: 7-step schedule wizard UI`
- `feat: schedule view and manipulation APIs`

---

## Phase 5: Invite Link & Cast Onboarding

**Goal:** Director generates an invite link. Cast members click it, register/login, join the production, set up their profile.

**Read:** SPEC-002 Section 2.4 (invite flow), SPEC-004 Sections 2-3 (onboarding, profile), SPEC-010 Sections 3.8 (roster), 3.11 (profile setup)

### Tasks:

1. **Invite token API:**
   - `POST /api/productions/[id]/invite` — generate cryptographically random token (min 32 chars), 30-day expiry, max 100 uses. Only Director/Staff can generate. Invalidates previous token.
   - Token stored in `invite_tokens` table

2. **Join flow:**
   - `/join?token=X` page — validate token server-side, store production_id in session, redirect to clean `/join` URL
   - If not authenticated: show login/register page
   - After auth: auto-insert `production_members` row with `role = 'cast'`, increment `use_count`
   - Redirect to profile setup if no `cast_profiles` row exists, else redirect to bulletin board
   - Handle: expired token, max uses reached, already a member

3. **Cast profile API:**
   - `POST /api/productions/[id]/profile` — create cast profile (display_name, phone, role_character)
   - `PATCH /api/productions/[id]/profile` — update profile
   - `GET /api/productions/[id]/profile` — get own profile

4. **Image upload:**
   - `POST /api/productions/[id]/profile/headshot` — accept multipart upload
   - Validate magic bytes (JPEG: `FF D8 FF`, PNG: `89 50 4E 47`). Reject all others.
   - Max 5MB (return 413 if exceeded)
   - Strip EXIF with `sharp`
   - Generate UUID filename, store via STORAGE_PROVIDER (Supabase Storage or local `uploads/`)
   - `DELETE /api/productions/[id]/profile/headshot` — remove photo from storage + set headshot_url to NULL
   - `GET /api/uploads/[filename]` — auth-gated proxy that serves files from Supabase Storage or local disk

5. **Cast profile page** (`/production/[id]/profile`) per SPEC-010 Section 3.11

6. **Member roster page** (`/production/[id]/roster`) per SPEC-010 Section 3.8:
   - Invite link display with copy button, expiry, usage count, regenerate button
   - Members table with name, role, conflict status, actions dropdown
   - Director actions: promote, demote, remove, reset conflicts

7. **Roster management APIs:**
   - `PATCH /api/productions/[id]/members/[userId]` — change role (Director only)
   - `DELETE /api/productions/[id]/members/[userId]` — remove member (Director only, also deletes headshot from storage)

### Tests for Phase 5:
AUTH-07, AUTH-08, AUTH-09, AUTH-21, AUTH-22, AUTH-23, AUTH-24, AUTH-25, AUTH-27, CAST-01, CAST-02, CAST-03, CAST-12, CAST-16, CAST-17, CAST-18, CAST-20, DIR-10, DIR-11, DIR-12, DIR-13, DIR-21, SEC-05, SEC-06

### Commits:
- `feat: invite link generation and join flow`
- `feat: cast profile setup with headshot upload`
- `feat: member roster with promote/demote/remove`

---

## Phase 6: Cast Conflict Submission

**Goal:** Cast members select unavailable dates and submit conflicts one time. Director sees aggregated view.

**Read:** SPEC-004 Sections 4.1-4.4 (conflict flow, rules, race condition, reset), SPEC-006 Sections 3-4 (conflict management, aggregated view), SPEC-010 Sections 3.6 (schedule page cast view), 3.10 (conflict page)

### Tasks:

1. **Conflict submission API** (`POST /api/productions/[id]/conflicts`):
   - Validate: authenticated, is Cast member, not already submitted (query conflict_submissions)
   - Validate: all rehearsalDateIds belong to this production and are not deleted
   - Single transaction: INSERT conflict_submissions + INSERT cast_conflicts for each date
   - On unique constraint violation: return 409 "Conflicts already submitted"
   - Empty submission (zero conflicts) is valid — records the submission

2. **Director conflict reset API** (`DELETE /api/productions/[id]/members/[userId]/conflicts`):
   - Director only
   - Single transaction: delete conflict_submissions row + all cast_conflicts rows for that user+production
   - Create system bulletin post: "Your conflicts have been reset by the director."

3. **Conflict submission page** (`/production/[id]/conflicts`) per SPEC-010 Section 3.10:
   - State 1 (not submitted): calendar with clickable dates, reason fields, submit button with confirmation dialog
   - State 2 (submitted): read-only view of submitted conflicts
   - react-day-picker calendar with custom day rendering (red background for selected conflicts)

4. **Cast schedule view** (`/production/[id]/schedule` for Cast role):
   - Read-only calendar, own conflicts overlaid (red background + "You're unavailable")
   - Soft-deleted dates filtered out
   - Director's notes visible
   - Cancelled dates with strikethrough
   - NO edit controls, NO other cast members' conflicts

5. **Director aggregated conflict view** on schedule page:
   - Per-date conflict count badges with severity colors (0=green, 1-2=amber, 3-4=orange, 5+=red)
   - Click badge to expand inline panel listing cast names + reasons
   - Conflict summary table (sortable by date or conflict count)

### Tests for Phase 6:
CAST-04, CAST-05, CAST-07, CAST-08, CAST-10, CAST-13, CAST-14, CAST-15, CAST-19, SCHED-04, SCHED-05, SCHED-06, SCHED-10, SCHED-12, SCHED-14, SEC-03

### Commits:
- `feat: one-time conflict submission with race condition handling`
- `feat: cast schedule view with personal conflict overlay`
- `feat: director aggregated conflict view with severity badges`

---

## Phase 7: Bulletin Board

**Goal:** Director/Staff can post Markdown announcements. Cast sees a read-only bulletin board as their home screen.

**Read:** SPEC-003 Section 6.2 (bulletin board), SPEC-004 Section 5 (cast view), SPEC-010 Section 3.7 (bulletin page)

### Tasks:

1. **Bulletin post API:**
   - `POST /api/productions/[id]/bulletin` — create post (Director/Staff only). Sanitize Markdown server-side before storage (strip raw HTML, scripts, iframes, event handlers). Allowed: bold, italic, h1-h3, lists, links (with `rel="noopener noreferrer" target="_blank"`), line breaks.
   - `GET /api/productions/[id]/bulletin` — list posts (all members). Pinned first, then newest-first.
   - `PATCH /api/productions/[id]/bulletin/[postId]` — edit post. Re-sanitize Markdown. Director can edit any post; Staff can edit their own only.
   - `DELETE /api/productions/[id]/bulletin/[postId]` — delete post. Director can delete any; Staff can delete their own only.
   - `PATCH /api/productions/[id]/bulletin/[postId]/pin` — pin/unpin. When pinning, unpin any currently pinned post first (only one pinned at a time).

2. **Bulletin board page** (`/production/[id]/bulletin`) per SPEC-010 Section 3.7:
   - Two tabs: Posters (default) and Schedule
   - Posters tab: new post form (Director/Staff), post list with paper-card styling
   - Schedule tab: cast schedule view (read-only calendar)
   - Post display: rendered Markdown, author name, relative timestamp, "(edited)" indicator
   - Theater backstage styling: cork board background, paper cards with rotation + pin dot + drop shadow per SPEC-009 Section 4.3

3. **Markdown editor component:**
   - Textarea with live preview panel (desktop: side by side, mobile: below)
   - Render with `react-markdown` + `rehype-sanitize` + `remark-gfm`
   - Character count for body (max 10,000)

### Tests for Phase 7:
DIR-08, DIR-09, DIR-20, DIR-23, CAST-06, SEC-02

### Commit: `feat: bulletin board with Markdown posts and theater-styled cards`

---

## Phase 8: Chat System

**Goal:** 1-on-1 direct messages with role-based boundaries and real-time delivery.

**Read:** SPEC-005 (full), SPEC-010 Section 3.9 (chat page)

### Tasks:

1. **Conversation API:**
   - `GET /api/productions/[id]/chat/contacts` — filtered by role (Cast sees only Director/Staff)
   - `POST /api/productions/[id]/chat/conversations` — create or find existing conversation. Deduplication via SELECT...FOR UPDATE. Validate role boundaries (Cast cannot message Cast → 403).
   - `GET /api/productions/[id]/chat/conversations` — list conversations sorted by most recent message
   - `GET /api/productions/[id]/chat/conversations/[convId]/messages` — paginated (50 per page), ordered by created_at ASC

2. **Message API:**
   - `POST /api/productions/[id]/chat/conversations/[convId]/messages` — send message. Validate: member of conversation, body <= 2000 chars, rate limit (30/min/user via chat_rate_limits table). Role boundary check on every send.
   - `POST /api/productions/[id]/chat/conversations/[convId]/mark-read` — mark all messages as read
   - `DELETE /api/productions/[id]/chat/messages/[msgId]` — Director: any message anytime. User: own message within 5 minutes. Replace body with "[Message removed by director]" or "[Message deleted]", set is_deleted = TRUE.

3. **Realtime delivery:**
   - `src/lib/realtime/provider.ts` — abstraction over Supabase Realtime and ws based on `NEXT_PUBLIC_REALTIME_PROVIDER`
   - `POST /api/realtime/token` — generate short-lived JWT (5-min expiry) for Supabase Realtime auth
   - `src/lib/realtime/ws-server.ts` — local dev WebSocket server (port 3001). Auth on upgrade (validate session cookie). Re-validate every 5 minutes. Close with code 4401 if session expired.
   - Broadcast `message:new` and `message:deleted` events on conversation channels
   - Fallback: poll every 10 seconds if realtime connection drops

4. **Chat UI** (`/production/[id]/chat`) per SPEC-010 Section 3.9:
   - Desktop: split view (conversation list + messages)
   - Mobile: conversation list → full-screen conversation
   - Message input: Enter sends (desktop), Send button (mobile), Shift+Enter newline, 2000 char counter
   - Unread badge on Chat nav item (exact count 1-99, "99+" for 100+)
   - Connection status indicator (green = connected, yellow = reconnecting)
   - Delete button: hover on desktop, long-press on mobile. Director: all messages. Others: own messages < 5 min old.

5. **Chat rate limiting:**
   - Production: database-backed `chat_rate_limits` table. Increment per 60-second window. Reject at 30.
   - Development: in-memory counter.

### Tests for Phase 8:
ALL of CHAT-01 through CHAT-20, SEC-03 (IDOR for chat)

### Commits:
- `feat: chat conversations with role-based contact filtering`
- `feat: message sending with rate limiting and moderation`
- `feat: realtime delivery with Supabase Realtime and ws fallback`
- `feat: chat UI with unread badges and connection status`

---

## Phase 9: Production Lifecycle & Account Management

**Goal:** Director can archive/unarchive/delete productions. Users can manage their accounts. PII cleanup runs on schedule.

**Read:** SPEC-003 Section 6.5 (archival), SPEC-001 Section 7 (data privacy), SPEC-007 Section 7.3 (PII cleanup), SPEC-010 Sections 3.12-3.13 (account/production settings)

### Tasks:

1. **Production archival API:**
   - `PATCH /api/productions/[id]` with `{ is_archived: true }` — set archived, deactivate invite link
   - `PATCH /api/productions/[id]` with `{ is_archived: false }` — unarchive (only within 90 days)
   - Archived productions: read-only access for all members (no posting, chatting, or modifying)

2. **Production deletion API:**
   - `DELETE /api/productions/[id]` — requires re-authentication. Hard-delete production + all associated data (cascade). Delete headshot files from storage.

3. **Account settings page** (`/account`) per SPEC-010 Section 3.12:
   - Profile edit (name, photo)
   - Password change (email/password users only)
   - Connected accounts (link/unlink Google)
   - Log out all devices
   - Account deletion (re-authentication required, cascade delete all data + headshots)

4. **Production settings page** (`/production/[id]/settings`) per SPEC-010 Section 3.13:
   - Edit production details (name, dates with validation)
   - Danger zone: archive, restore, delete

5. **PII cleanup job:**
   - SQL function in Supabase (pg_cron) per SPEC-007 Section 7.3
   - Wrapped in explicit BEGIN/COMMIT transaction
   - Runs daily at 3:00 AM UTC
   - Deletes: cast_profiles, cast_conflicts, conflict_submissions, messages, conversation_participants, conversations, bulletin_posts, invite_tokens for productions archived > 90 days

6. **Headshot orphan cleanup:**
   - After PII SQL cleanup, a separate scheduled function lists files in `headshots` bucket and deletes those not referenced in any `cast_profiles.headshot_url`

### Tests for Phase 9:
DIR-13 (delete), PAGE-11, PAGE-12, INFRA-11

### Commits:
- `feat: production archival with read-only mode and unarchive`
- `feat: account settings with deletion and session management`
- `feat: PII cleanup scheduled job`

---

## Phase 10: Polish — Theater Theme, Responsive, Accessibility

**Goal:** The app looks and feels like a backstage theater, works on phones, and is keyboard-accessible.

**Read:** SPEC-009 (full — design system, responsive, accessibility), SPEC-010 (all wireframes)

### Tasks:

1. **Theater backstage surfaces:**
   - Wood grain CSS gradient on sidebar and cards (SPEC-009 Section 4.3)
   - Cork board SVG noise texture on bulletin board background
   - Paper cards with rotation, drop shadow, pin dot on bulletin posts
   - Spotlight radial gradient on empty states
   - Stage curtain border on sidebar

2. **Responsive layouts:**
   - Mobile (< 768px): bottom nav (Bulletin, Schedule, Chat), single column, full-screen chat
   - Tablet (768-1024px): collapsible sidebar, 2-column where appropriate
   - Desktop (> 1024px): full sidebar, multi-column
   - Calendar: list view on mobile, grid on desktop

3. **Accessibility:**
   - All interactive elements keyboard-navigable
   - Focus indicators: 2px ring in accent color
   - Icon-only buttons: aria-label
   - Color never sole indicator (always text label + icon)
   - Form errors: aria-live="polite"
   - All text: 4.5:1 contrast minimum
   - All images: alt text ("Photo of [name]")
   - Touch targets: 44x44px minimum

4. **Loading states:**
   - Skeleton placeholders on every async boundary (no spinners anywhere)
   - animate-pulse with surface-raised color

5. **Error states:**
   - Red-bordered card with human-readable message and "Try Again" button
   - Never show raw error objects, stack traces, or status codes

6. **Empty states:**
   - Centered text with CTA button on every list/page that can be empty
   - Spotlight gradient behind text

7. **404 and 403 pages:**
   - `src/app/not-found.tsx` — "Page not found. Return to dashboard."
   - Forbidden component — "You don't have permission to view this page."

8. **Client-side validation refinement:**
   - All forms validate on blur + submit with Zod
   - Inline errors below fields in destructive color
   - Disabled submit while invalid or submitting
   - Server error mapping (400 → field errors, 401 → redirect, 403 → toast, 500 → toast)

### Tests for Phase 10:
FE-01 through FE-10, PAGE-10

### Commit: `feat: theater backstage theme, responsive layouts, accessibility`

---

## Phase 11: Production Deployment

**Goal:** The app is live on Vercel with Supabase, accessible via custom domain.

**Read:** SPEC-007 Sections 5.1-5.2 (Supabase + Vercel setup)

### Tasks:

1. **Vercel setup:**
   - Import GitHub repo
   - Set framework to Next.js
   - Configure ALL environment variables in Vercel dashboard (copy from .env but use production Supabase values)
   - Set `STORAGE_PROVIDER=supabase` and `NEXT_PUBLIC_REALTIME_PROVIDER=supabase`

2. **Database migration:**
   - Run `npm run db:migrate` against Supabase direct connection (port 5432)
   - Verify all tables created

3. **Supabase configuration:**
   - Enable Realtime on `messages` table (for change detection)
   - Configure RLS policies for Realtime channel access
   - Create pg_cron job for PII cleanup (SPEC-007 Section 7.3)

4. **Google OAuth:**
   - Update authorized redirect URIs in Google Cloud Console to include production domain
   - Set `NEXTAUTH_URL` to production domain

5. **Custom domain:**
   - Add CNAME record in Cloudflare DNS pointing to `cname.vercel-dns.com`
   - Configure domain in Vercel dashboard
   - Verify HTTPS is working

6. **Smoke test:**
   - Health check returns 200
   - Registration flow works
   - Google OAuth redirects correctly
   - Create a test production and schedule
   - Send invite link, join as Cast, submit conflicts
   - Post to bulletin board
   - Send a chat message

### Tests: INFRA-03, INFRA-04, INFRA-05, INFRA-07, INFRA-08

### Commit: `infra: production deployment configuration`

---

## Cross-Cutting Concerns (Apply Throughout All Phases)

### API Error Format (SPEC-002 Section 3.4)
Every API route returns:
```json
{ "error": "ERROR_CODE", "message": "Human-readable" }
```
Validation errors include `fields` array. Use a shared `apiError(status, code, message, fields?)` helper.

### Logging (SPEC-007 Section 10)
- Structured JSON: `{ timestamp, level, message, ... }`
- Levels: info, warn, error
- PII scrubbing: no passwords, mask emails (`d***@example.com`), redact tokens to first 8 chars

### CSRF Protection (SPEC-002 Section 5)
CSRF tokens on all state-changing POST/PUT/DELETE requests. NextAuth.js provides CSRF protection for its own routes; implement for custom API routes.

### Demotion Side Effects (SPEC-003 Section 6.4.1)
When Staff is demoted to Cast:
- Bulletin posts remain but user can no longer edit/delete them
- Loses access to aggregated conflict view (next API request returns 403)
- Can no longer message Cast members (API enforces on every send)
- WebSocket closed on next 5-minute revalidation (code 4401)

---

## Test Coverage Requirements (SPEC-008)

- **80%+ line coverage** on business logic
- **100% coverage** on: auth middleware, role permissions, chat boundaries, conflict submission guards
- **Every scenario ID** (AUTH-XX, DIR-XX, CAST-XX, CHAT-XX, SCHED-XX, SEC-XX, FE-XX, PAGE-XX) has a corresponding test function
- Security tests run in every CI pipeline — never skipped
- Integration tests use real PostgreSQL, never mocks

---

## Final Checklist Before Declaring Done

- [ ] All 10 spec test scenario tables have corresponding test functions
- [ ] All tests pass (`npm test` exits 0)
- [ ] Health check returns 200 in production
- [ ] Google OAuth works in production
- [ ] A Cast member can complete the full flow: invite link → register → profile → conflicts → bulletin → chat
- [ ] A Director can complete the full flow: register → theater → production → schedule → invite → roster → bulletin → chat → archive
- [ ] The app feels like backstage at a theater, not a generic SaaS tool
- [ ] Every page loads in under 2 seconds with 100 cast members
- [ ] Every interactive element is keyboard-navigable
- [ ] `.env` is not in git, secrets are not in code
- [ ] PII cleanup job is scheduled in Supabase
