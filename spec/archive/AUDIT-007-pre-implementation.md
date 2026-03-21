# AUDIT-007: Pre-Implementation GAN Audit

**Auditor:** GAN Round 7 (Senior Engineer + Adversarial Reviewer)
**Date:** 2026-03-21
**Scope:** Full spec suite, AGENT.md, SPEC-MANIFEST.xml, README.md — final audit before implementation begins
**Trigger:** All prior audit findings (AUDIT-001 through AUDIT-006) were remediated. This is the gate check before writing code.

---

## Files Reviewed

| File | Scope |
|------|-------|
| SPEC-001-product-overview.md | Full |
| SPEC-002-auth.md | Full |
| SPEC-003-director-flow.md | Full |
| SPEC-004-cast-flow.md | Full |
| SPEC-005-chat.md | Full |
| SPEC-006-schedule.md | Full |
| SPEC-007-infrastructure.md | Full |
| SPEC-008-tdd.md | Full |
| SPEC-009-frontend-architecture.md | Full |
| SPEC-010-pages-and-screens.md | Full |
| SPEC-MANIFEST.xml | Full |
| AGENT.md | Full |
| README.md | Full |
| .env | Structure only (secrets not audited) |
| .gitignore | Full |

---

## AUDIT-006 Remediation Verification

| AUDIT-006 Finding | Status | Evidence |
|-------------------|--------|----------|
| C-01 (SPEC-001 stale Docker/Tunnel scope) | FIXED | Lines 129-131 now say "Supabase + Vercel production deployment", "Docker PostgreSQL for local development", "Custom domain via Cloudflare DNS (pointing to Vercel)" |
| C-02 (SPEC-001 "Hosted via Cloudflare Tunnel") | FIXED | Line 145 now says "Hosted 24/7 via Vercel (auto-deploy from GitHub, edge network)" |
| C-03 (SPEC-002 "HTTPS enforced by Tunnel") | FIXED | Line 293 now says "enforced by Vercel edge network + HSTS header" |
| C-04 (SPEC-008 Phase 1 description) | FIXED | Line 197 now says "Infrastructure (Supabase project, Vercel project, local dev DB, env config)" |
| C-05 (MANIFEST stale Tunnel section) | FIXED | SPEC-007 sections in manifest are updated, no Cloudflare Tunnel section remains |
| C-06 (MANIFEST SPEC-007 line numbers) | FIXED | Spot-checked 5 sections — line numbers now match actual file |
| C-07 (AGENT.md Dockerfile ref) | NOT VERIFIED | AGENT.md line 117 still says "SPEC-007 Sec 7.4" — the self-hosted fallback is Section 11 in SPEC-007. Low severity, does not block implementation. |
| D-05 (SPEC-009 Prisma reference) | FIXED | Grep for "Prisma" in SPEC-009 returns nothing. Line 127 now says "Database client (Drizzle)" |
| P-02 (Realtime auth bridge) | FIXED | SPEC-005 Section 4.1 now has separate Production and Development subsections with JWT token exchange endpoint specified |
| R-01 (WebSocket auth split) | FIXED | SPEC-005 Section 4.1 now clearly separates Supabase Realtime (JWT) from ws (cookie) auth |
| R-02 (Serverless rate limiting) | FIXED | SPEC-005 Section 4.2 now specifies database-backed `chat_rate_limits` table for production, in-memory for dev |
| R-03 (Deletion propagation) | FIXED | SPEC-005 Section 7 now includes `message:deleted` event broadcast |
| T-01 (SPEC-009 realtime tech stack) | FIXED | Line 66 now says "Supabase Realtime (prod) / ws (dev)" |
| I-01 (CI/CD ambiguity) | FIXED | SPEC-008 Section 10 now clarifies GitHub Actions for tests, Vercel for build+deploy |

---

## NEW FINDINGS

### Category 1: Schema Contradictions

| # | Severity | Location | Finding | Fix |
|---|----------|----------|---------|-----|
| S-01 | **HIGH** | SPEC-006:199 vs SPEC-003:291-300 | SPEC-006 Section 5.1 says system-generated schedule change posts use `is_system = TRUE` and `author_id = NULL`. But the `bulletin_posts` schema in SPEC-003 line 294 defines `author_id UUID NOT NULL REFERENCES users(id)`. NULL author_id would violate the NOT NULL constraint. SPEC-003 line 180 correctly says system posts use the Director's user_id as author_id. SPEC-006 contradicts this. | Fix SPEC-006 line 199: change to "Create a bulletin post with `author_id` set to the Director's user_id who triggered the action" and remove `is_system = TRUE` (no `is_system` column exists in the schema). Alternatively, add `is_system BOOLEAN DEFAULT FALSE` to the schema and make `author_id` nullable — but this is more invasive. The simpler fix is to align SPEC-006 with SPEC-003's existing approach. |
| S-02 | **MEDIUM** | SPEC-006:114 vs SPEC-003:283 | SPEC-006 Section 2.3 says `note` field max is 500 characters. SPEC-003 line 283 schema says `char_length(note) <= 1000`. SPEC-010 Section 3.6 says "note (text input, max 500 chars)". The DB allows 1000 but two specs say 500. | Decide one value. The DB CHECK is 1000 (SPEC-003:283) so the specs referencing 500 are wrong, or the DB CHECK should be 500. Recommend: keep DB at 1000 (more permissive), update SPEC-006 and SPEC-010 to say 1000, or tighten DB to 500. Pick one. |
| S-03 | **MEDIUM** | SPEC-010:438 vs SPEC-004:73-76 | SPEC-010 Section 3.11 cast profile validation says name is "1-100 chars" and role/character is "1-100 chars". SPEC-004 Section 3 and database schema say display_name max is 200 chars and role_character max is 200 chars. The Zod validation would reject valid input if set to 100. | Align SPEC-010 with SPEC-004: change "1-100 chars" to "1-200 chars" for both fields. |
| S-04 | **LOW** | SPEC-010:448 vs SPEC-004:73 | SPEC-010 account settings says name field is "1-100 chars" but `users.name` in SPEC-002:322 has `char_length(name) <= 200`. | Align to 200. |

### Category 2: Missing Schema Elements

| # | Severity | Location | Finding | Fix |
|---|----------|----------|---------|-----|
| M-01 | **MEDIUM** | SPEC-002:322 vs SPEC-010:137 | SPEC-010 registration page says password is checked against "HaveIBeenPwned k-anonymity API". SPEC-002 Section 2.2 says a bundled static file `src/lib/data/breached-passwords.txt` of top 10,000 passwords, loaded into a Set. These are different approaches. HaveIBeenPwned API requires a network call; the bundled file is local. | Decide one. SPEC-002 is more detailed and was written first. Recommend: fix SPEC-010 line 137 to say "validated against bundled breached password list (see SPEC-002 Section 2.2)" and remove the HaveIBeenPwned reference. |
| M-02 | **MEDIUM** | SPEC-005:190-196 | `chat_rate_limits` table is defined in SPEC-005 but not listed in the SPEC-MANIFEST.xml `<database>` section. An agent using the manifest to find all tables would miss it. | Add `<table name="chat_rate_limits" spec="SPEC-005" line="190" columns="id, user_id, window_start, message_count" />` to the manifest. |
| M-03 | **LOW** | SPEC-007:97-117 | Docker Compose only defines a `db` service. SPEC-007 Section 5.3 says "The ws server MUST be started automatically by npm run dev via a concurrently script". This means `package.json` needs a `concurrently` dev script, but no spec defines the exact script. | Add to SPEC-007 Section 4.2: `"dev": "concurrently \"next dev\" \"node src/lib/ws-server.ts\""` or equivalent. Minor — the developer will figure this out, but it should be specified. |
| M-04 | **LOW** | All specs | No spec defines the `NEXTAUTH_SECRET` generation or where NextAuth.js is configured. SPEC-007 mentions it as an env var, SPEC-002 describes auth flows, but the actual NextAuth config file (`src/lib/auth.ts`) and its provider setup are never specified. | Not blocking — NextAuth.js setup is well-documented externally. But consider adding a brief section to SPEC-002 or SPEC-007 specifying the NextAuth providers (Google + Credentials) and the session strategy (database sessions via Drizzle adapter, NOT JWT strategy). |

### Category 3: Logic Gaps

| # | Severity | Location | Finding | Fix |
|---|----------|----------|---------|-----|
| L-01 | **HIGH** | SPEC-003:67 vs SPEC-010:172 | SPEC-003 says "In v1, a Director MUST have exactly one theater." SPEC-010 dashboard empty state says "No theaters yet. Add your first theater." But nothing prevents a Director from navigating to `/theater/new` after already having a theater. The API must reject the second theater creation. Neither spec defines this rejection. | Add to SPEC-003 Section 3: "If the Director already has a theater, `POST /api/theaters` MUST return `409 Conflict` with message 'You already have a theater.' The '/theater/new' page MUST redirect to the dashboard if the Director already has a theater." |
| L-02 | **MEDIUM** | SPEC-003 vs SPEC-010 | Same issue for productions. SPEC-001:135 says "Multiple simultaneous productions per director" is out of scope. But no spec explicitly blocks creating a second production. The schedule wizard at `/production/new` has no guard. | Add to SPEC-003 Section 4 or SPEC-010 Section 3.4: "If the Director already has an active (non-archived) production, `POST /api/productions` MUST return `409 Conflict` with message 'You already have an active production. Archive your current production first.' The '/production/new' page MUST redirect to the existing production if one exists." |
| L-03 | **MEDIUM** | SPEC-004:56-57 vs SPEC-010:436 | SPEC-004 says after profile setup, redirect to bulletin board. SPEC-010 says after profile save, redirect to `/production/[id]/conflicts`. These are different destinations. | Decide one. SPEC-010 is more recent and more specific. Recommend: redirect to conflicts page (SPEC-010), then after conflict submission redirect to bulletin board. Update SPEC-004 to match. |
| L-04 | **MEDIUM** | SPEC-010:104 | Login page stores invite token in `sessionStorage` under `pendingInviteToken`, then after login calls `POST /api/join`. But SPEC-002 Section 2.4 says the server stores `production_id` in the session (server-side) during the invite flow. These are two different mechanisms for the same problem. If the server handles it, the client-side sessionStorage approach is redundant. | Pick one approach. Server-side session storage (SPEC-002) is more secure — the token never persists in the browser. Remove the `sessionStorage` approach from SPEC-010 and rely on the server-side flow from SPEC-002. |
| L-05 | **LOW** | SPEC-005:67 | Conversation deduplication uses `SELECT ... FOR UPDATE` to prevent duplicate conversations. But the schema has no unique constraint on (production_id, participant_pair). The FOR UPDATE lock works but a unique constraint would be a stronger guarantee. | Consider adding a composite unique constraint or a unique index on a canonical participant pair. This is an optimization, not a bug — the FOR UPDATE approach works. |
| L-06 | **LOW** | SPEC-003:177 | "Only one post MUST be pinned at a time; pinning a new post unpins the previous one." The DB doesn't enforce this — `is_pinned` is just a boolean on each row. Multiple rows could be TRUE. | Enforce in application logic: when pinning, first `UPDATE bulletin_posts SET is_pinned = FALSE WHERE production_id = X AND is_pinned = TRUE`, then set the target post. Or add a partial unique index: `CREATE UNIQUE INDEX ON bulletin_posts (production_id) WHERE is_pinned = TRUE`. |

### Category 4: Security Gaps

| # | Severity | Location | Finding | Fix |
|---|----------|----------|---------|-----|
| X-01 | **HIGH** | SPEC-007:258-284 | PII cleanup SQL job in Section 7.3 uses multiple separate DELETE statements, not a single transaction. If the job fails mid-way (e.g., after deleting cast_profiles but before deleting messages), partial PII remains. The `$$` block in pg_cron executes statements sequentially but NOT in an explicit transaction. | Wrap the entire cleanup in `BEGIN ... COMMIT` inside the `$$` block. pg_cron `$$` blocks execute as a single SQL string but each statement is auto-committed individually unless wrapped. |
| X-02 | **MEDIUM** | SPEC-007:287 | "A separate Supabase Edge Function runs after the SQL cleanup, listing and deleting orphaned files in the `headshots` bucket." This Edge Function is still not specified. What triggers it? How does it know which files are orphaned? What happens if it fails? | Define: (1) Trigger: pg_cron schedules a second job 30 minutes after the PII cleanup that calls the Edge Function via `net.http_post`. (2) Logic: list all files in `headshots` bucket, query `cast_profiles.headshot_url` for each, delete files not referenced. (3) Failure: log error, retry next day. OR simpler: during the PII SQL cleanup, collect headshot_urls into a temp table before deleting cast_profiles, then delete those specific files via `net.http_delete` calls to the Storage API. |
| X-03 | **MEDIUM** | SPEC-002 | Password reset and email verification tokens use SHA-256 hashing. The raw token is sent in the email link. If an attacker gains read access to the database (SQL injection, backup leak), they cannot reverse SHA-256 to get the token. Good. But: there is no rate limit on the password reset REQUEST endpoint itself (only on login). An attacker could flood a victim with reset emails. SPEC-002:179 says "Rate limit: max 3 reset requests per email per hour" — this is specified but the same rate limit is NOT mentioned for email verification resend (Section 2.3.1 line 121 says "rate limited: 3 per hour per email"). These should be in the same enforcement mechanism. | Ensure the implementation uses a single rate-limiting mechanism for all email-sending endpoints (reset, verification resend). This is a reminder, not a spec gap — the limits are specified, just in different sections. |
| X-04 | **LOW** | SPEC-002:71-74 | Google OAuth CSRF protection requires a `state` parameter. NextAuth.js handles this automatically when properly configured. But the spec doesn't mention whether the `state` value should be stored in a cookie or server-side session. NextAuth uses a cookie-based approach. | No action needed — NextAuth.js handles this correctly by default. Just don't disable it. |

### Category 5: Frontend/UX Gaps

| # | Severity | Location | Finding | Fix |
|---|----------|----------|---------|-----|
| U-01 | **MEDIUM** | SPEC-010 | No 404 page is defined. The route map has 19 routes, but what happens when a user navigates to `/production/[id]` with an invalid ID? Or `/production/[id]/roster` as a Cast member? SPEC-010 line 45 says "unauthorized access MUST return a redirect to `/login` or a `403` page" but no 403 page wireframe exists. | Add a simple 404 page spec ("Production not found" or "Page not found") and a 403 page spec ("You don't have permission to view this page. Return to dashboard."). These can be minimal — just route to `not-found.tsx` and `forbidden.tsx` in the App Router. |
| U-02 | **MEDIUM** | SPEC-010:350 | Chat message input says "Enter sends. Shift+Enter inserts a newline." This is standard for desktop but problematic on mobile where Enter is often expected to insert a newline. No mobile behavior is specified. | Add: "On mobile (< 768px), Enter inserts a newline. A dedicated Send button is the only way to send. On desktop, Enter sends and Shift+Enter inserts a newline." |
| U-03 | **LOW** | SPEC-009:62 | `react-day-picker` is specified for calendar, but `react-day-picker` is a date picker, not a full month calendar grid. For the schedule views (SPEC-010 Section 3.6), a more customizable calendar might be needed. | `react-day-picker` can render month grids with custom day content. It should work, but the developer may need to heavily customize the day rendering. Not blocking. |
| U-04 | **LOW** | SPEC-010 | No spec defines what happens when a Director clicks a production card on the dashboard. The wireframe shows an "[Open]" button but the destination URL is implied, not stated. | Clicking a production card or its "[Open]" button navigates to `/production/[id]` (the production dashboard). Add explicitly to SPEC-010 Section 3.3 behavior. |

### Category 6: Env / Infrastructure

| # | Severity | Location | Finding | Fix |
|---|----------|----------|---------|-----|
| E-01 | **MEDIUM** | .env | The `.env` file contains `SUPABASE_ACCESS_TOKEN` (management API token). This should NOT be in the app's `.env` — it's a one-time CLI tool credential, not a runtime env var. If it's loaded by Next.js, it becomes available in the server runtime unnecessarily. | Move `SUPABASE_ACCESS_TOKEN` out of `.env` to a separate file or export it only when needed for CLI operations. The app should never load this token. |
| E-02 | **LOW** | .env | `DATABASE_URL` (pooler) should include `?pgbouncer=true` query parameter for Supabase connection pooler compatibility with Drizzle ORM. SPEC-007 Section 5.1 line 145 shows this parameter but the actual `.env` doesn't have it. | Append `?pgbouncer=true` to DATABASE_URL. |
| E-03 | **LOW** | .gitignore | The `.gitignore` does not include `uploads/` (local dev headshot storage directory) or `coverage/` (test coverage output). SPEC-007 Section 8 specifies both. | Add `uploads/` and `coverage/` to `.gitignore`. |

---

## Summary by Severity

| Severity | Count | IDs |
|----------|-------|-----|
| HIGH | 3 | S-01, L-01, X-01 |
| MEDIUM | 12 | S-02, S-03, M-01, M-02, L-02, L-03, L-04, X-02, X-03, U-01, U-02, E-01 |
| LOW | 9 | S-04, M-03, M-04, L-05, L-06, X-04, U-03, U-04, E-02, E-03 |

---

## Verdict

**The specs are READY for implementation with 3 HIGH-severity fixes required first.**

The three HIGH findings are all fixable in under 5 minutes:

1. **S-01:** Fix SPEC-006 line 199 to use Director's author_id instead of NULL (aligns with SPEC-003's existing approach)
2. **L-01:** Add one-theater-per-director guard to SPEC-003 and SPEC-010 (API returns 409, page redirects)
3. **X-01:** Wrap PII cleanup SQL in BEGIN/COMMIT

The MEDIUM findings are real but do not block implementation — they can be resolved as each feature is built. The developer should reference this audit when implementing each phase.

**Recommended order:**
1. Fix S-01, L-01, X-01 in the specs (5 minutes)
2. Fix E-01 (move SUPABASE_ACCESS_TOKEN out of .env)
3. Fix E-03 (.gitignore additions)
4. Begin Phase 1 implementation
5. Resolve remaining MEDIUM findings as they become relevant per-phase
