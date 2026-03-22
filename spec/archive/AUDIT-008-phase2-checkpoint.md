# AUDIT-008: Phase 1+2 Implementation Checkpoint

**Auditor:** GAN Round 8 (Adversarial Reviewer)
**Date:** 2026-03-21
**Scope:** All code written in Phase 1 (Infrastructure) and Phase 2 (Authentication)
**Method:** Code reviewed against specs, cross-referenced with AUDIT-007 findings

---

## Files Reviewed

| Directory | Files | Status |
|-----------|-------|--------|
| `src/lib/db/schema.ts` | Full schema (17 tables) | Reviewed |
| `src/lib/db/index.ts` | DB client | Reviewed |
| `src/lib/auth/` | index.ts, password.ts, tokens.ts, age-gate.ts, rbac.ts | Reviewed |
| `src/lib/email.ts` | Email delivery | Reviewed |
| `src/lib/api-error.ts` | Error helpers | Reviewed |
| `src/lib/validators.ts` | Zod schemas | Reviewed |
| `src/app/api/auth/` | register, verify-email, forgot-password, reset-password, [...nextauth] | Reviewed |
| `src/app/(auth)/` | login, register, forgot-password, reset-password, verify-email pages | Reviewed |
| `src/app/globals.css` | Theme tokens | Reviewed |
| `src/app/layout.tsx` | Root layout with fonts | Reviewed |
| `next.config.ts` | Security headers | Reviewed |
| `docker-compose.yml` | Dev DB | Reviewed |
| `drizzle.config.ts` | ORM config | Reviewed |
| `vitest.config.ts` | Test config | Reviewed |
| `tests/` | All test files | Reviewed |

---

## Findings

### Category 1: Missing Implementations (spec-required but not built)

| # | Severity | Finding | Spec Reference | Fix |
|---|----------|---------|----------------|-----|
| MI-01 | **HIGH** | **NextAuth.js has no Drizzle adapter configured.** The `auth/index.ts` file uses `strategy: "database"` for sessions but never passes an `adapter` to NextAuth. Without the adapter, NextAuth cannot persist sessions to PostgreSQL. The sessions table exists in the schema but NextAuth will error at runtime trying to create/read sessions. | SPEC-002 Section 4, SPEC-007 immutable constraint "Database queries use Drizzle ORM only" | Add `import { DrizzleAdapter } from "@auth/drizzle-adapter"` and pass `adapter: DrizzleAdapter(db)` in the NextAuth config. Note: The Drizzle adapter expects NextAuth-standard table names (`user`, `session`, `account`, `verificationToken`). Our custom schema uses different names (`users`, `sessions`, etc.). Either: (a) create NextAuth-compatible table aliases in the adapter config, or (b) switch to a custom session strategy that reads/writes our existing `sessions` table directly. Option (b) is more aligned with the spec since we want 256-bit random tokens in cookies, not NextAuth's default UUID session tokens. |
| MI-02 | **HIGH** | **No per-IP rate limiting on login.** SPEC-002 requires "5 login attempts per minute per IP → 429". The lockout logic (10 failed attempts per account) is implemented in `auth/index.ts`, but per-IP rate limiting is completely missing. NextAuth's Credentials `authorize` function doesn't have access to the request IP. | SPEC-002 immutable constraint: "Rate limit: 5 login attempts per minute per IP. Returns 429" | Implement IP rate limiting as Next.js middleware (`src/middleware.ts`) that intercepts `POST /api/auth/callback/credentials` and tracks attempts per IP. Use an in-memory Map with TTL for dev, or a database table for production. |
| MI-03 | **MEDIUM** | **No resend-verification API endpoint.** SPEC-002 Section 2.3.1 specifies "Users can request a new verification email from the login page (rate limited: 3 per hour per email)". The `src/app/api/auth/resend-verification/` directory exists but has no `route.ts`. | SPEC-002 Section 2.3.1 | Create `POST /api/auth/resend-verification` that takes an email, looks up the user, generates a new verification token, and sends the email. Rate limit: 3 per hour per email. |
| MI-04 | **MEDIUM** | **No CSRF protection on custom API routes.** SPEC-002 requires "CSRF protection on all state-changing POST/PUT/DELETE requests". NextAuth handles CSRF for its own routes, but our custom routes (`/api/auth/register`, `/api/auth/verify-email`, `/api/auth/forgot-password`, `/api/auth/reset-password`) have no CSRF token validation. | SPEC-002 immutable constraint | Either: (a) implement a custom CSRF middleware that generates/validates tokens via a cookie + header pattern, or (b) use NextAuth's CSRF token (available via `getCsrfToken()`) and validate it in custom routes. Option (b) is simpler. |
| MI-05 | **LOW** | **No `updated_at` auto-update triggers.** The schema defines `updatedAt` columns on `users`, `productions`, `bulletinPosts`, and `castProfiles`, but Drizzle doesn't generate PostgreSQL triggers. The `set_updated_at()` trigger function from SPEC-002 Section 6 is not created. `updatedAt` will remain at the initial value unless manually set in every UPDATE query. | SPEC-002 Section 6 | Create a migration SQL file that adds the `set_updated_at()` function and triggers on all tables with `updated_at` columns. Run this as part of `db:migrate`. |

### Category 2: Bugs and Logic Errors

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| BG-01 | **HIGH** | **`sessions` import is unused in `auth/index.ts`.** Line 5 imports `sessions` from schema but it's never used. More importantly, the NextAuth config doesn't interact with our `sessions` table at all — because no adapter is configured (see MI-01). This means sessions are not being persisted. | Fix via MI-01 (add adapter). Remove unused import after. |
| BG-02 | **MEDIUM** | **`and`, `gt` imported but unused in `auth/index.ts`.** Line 6 imports `and` and `gt` from drizzle-orm but only `eq` is used. These are dead imports. | Remove `and, gt` from the import. |
| BG-03 | **MEDIUM** | **Lockout check doesn't distinguish lockout from wrong credentials.** When a user is locked out, the `authorize` function returns `null` — the same return value as wrong password. The login page shows "Invalid email or password" for both cases. SPEC-002 says lockout should return status `423` and the login page should show "Account locked. Check your email." SPEC-010 Section 3.1 line 103 confirms this. | NextAuth's Credentials authorize can't return custom HTTP status codes — it only returns `null` (failure) or a user object (success). To handle lockout distinctly, either: (a) throw an error with a specific message that the signIn callback catches, or (b) check lockout status BEFORE calling signIn (a pre-flight API call from the login page). Option (b) is cleaner. |
| BG-04 | **LOW** | **`age_range` CHECK constraint allows NULL.** The schema defines `ageRange: text("age_range")` without `.notNull()`, and the CHECK constraint only validates when a value is present (`IN ('13-17', '18+')`). Google OAuth users get `ageRange: "18+"` hardcoded, but the column technically allows NULL. If a code path bypasses the age gate, a user without an age range could exist. | Add `.notNull()` to the `ageRange` column, or keep it nullable and add application-level enforcement. The spec says age range is always derived — NULL should only happen for legacy data. Keep as-is for now but document. |

### Category 3: Spec Compliance Gaps

| # | Severity | Finding | Spec Reference | Fix |
|---|----------|---------|----------------|-----|
| SC-01 | **HIGH** | **NextAuth session tokens are UUIDs, not 256-bit random.** SPEC-002 Section 4 explicitly requires: "Session token is a 256-bit cryptographically random string (`encode(gen_random_bytes(32), 'hex')`)". NextAuth's database strategy generates UUIDs for session tokens, not 256-bit random hex strings. Our schema defines `token` with a 256-bit default, but NextAuth won't use it — it manages its own session table structure. | SPEC-002 immutable constraint: "Session tokens are 256-bit cryptographically random" | This is a fundamental conflict between NextAuth's session model and the spec. Options: (a) Use NextAuth with JWT strategy + custom session management on top for the 256-bit tokens (complex, fragile). (b) Don't use NextAuth for session management — only use it for the OAuth provider flow, then manage sessions manually using our `sessions` table with 256-bit tokens. (c) Accept NextAuth's UUID tokens as "good enough" (they're still cryptographically random, just 128-bit UUIDs). Option (c) is pragmatic but violates the immutable constraint. Option (b) is spec-compliant but requires more custom code. **Recommend: option (b) for the production build, option (c) for the MVP to unblock development.** |
| SC-02 | **MEDIUM** | **Google OAuth users skip the age gate.** The `signIn` callback for Google hardcodes `ageRange: "18+"` with the comment "Google accounts assumed 18+ (Google enforces age requirements)". But SPEC-001 Section 7.1 says "Users MUST be at minimum 13 years of age to create an account" — not 18+. Google allows accounts for users 13+ (with parental consent for under 18 in some regions). The age range should be collected after OAuth, not assumed. | SPEC-001 Section 7.1, SPEC-002 Section 2.3 | After Google OAuth sign-in, if the user is new (just created), redirect to an age collection page that asks for DOB, validates the age gate, and stores the derived `age_range`. Until this is completed, block access to production features. |
| SC-03 | **MEDIUM** | **Breached password list is only 109 entries.** SPEC-002 Section 2.2 requires "a bundled list of the top 10,000 breached passwords". The current `breached-passwords.txt` has only 109 entries (top ~100). | SPEC-002 Section 2.2 | Download and bundle the full NCSC/HaveIBeenPwned top 10,000 passwords list. Available at: https://github.com/danielmiessler/SecLists/blob/master/Passwords/Common-Credentials/10k-most-common.txt |
| SC-04 | **MEDIUM** | **CSP header blocks Google OAuth.** The CSP in `next.config.ts` is `default-src 'self'; script-src 'self'`. Google OAuth requires loading scripts and making connections to `accounts.google.com` and `oauth2.googleapis.com`. The current CSP will block the OAuth redirect flow. | SPEC-002 Section 5.1 | Add Google domains to CSP: `connect-src 'self' wss: https://accounts.google.com https://oauth2.googleapis.com; form-action 'self' https://accounts.google.com`. Also add `https://accounts.google.com` to `frame-src` if Google uses iframes. |
| SC-05 | **LOW** | **Login page doesn't handle the `429` rate limit response.** SPEC-010 Section 3.1 says: "On `429`: display 'Too many attempts. Try again in {retryAfterSeconds} minutes.'" The login page only handles the generic "CredentialsSignin" error from NextAuth, not a 429. | SPEC-010 Section 3.1 | The login page needs to detect rate limiting. Since NextAuth's signIn doesn't expose HTTP status codes, this needs a pre-flight check or custom login API route that wraps the NextAuth call and returns proper status codes. |

### Category 4: Test Coverage Gaps

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| TC-01 | **MEDIUM** | **Only 14 unit tests exist, covering 3 utility modules.** No integration tests exist yet (no database tests). The test-to-spec mapping requires tests for AUTH-01 through AUTH-29, but only AUTH-20 (breached password) and AUTH-26 (age gate) are covered indirectly via unit tests. | Write integration tests for the registration, verification, and reset APIs. These require a running test database (Docker PostgreSQL + `callboard_test`). |
| TC-02 | **MEDIUM** | **No security tests exist.** SPEC-008 requires security tests in `tests/security/`. SEC-01 (SQL injection), SEC-04 (CSRF), SEC-07 (expired session), SEC-08 (tampered cookie), SEC-09 (rate limiting), SEC-10 (email enumeration) are all pending. | Create security test stubs in `tests/security/` and implement as integration tests become available. |
| TC-03 | **LOW** | **Test fixtures (`tests/helpers/fixtures.ts`) don't include session, token, or membership factories.** These will be needed for integration tests in Phase 3+. | Add `buildSession()`, `buildInviteToken()`, `buildProductionMember()` factories. |

### Category 5: Infrastructure & Config

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| IC-01 | **MEDIUM** | **`drizzle.config.ts` uses `DATABASE_URL_DIRECT` for migrations, but the `.env` file sets `DATABASE_URL_DIRECT` to the Supabase production direct URL.** Running `npm run db:migrate` locally would attempt to migrate the production database. The `.env.example` correctly shows local Docker values, but the actual `.env` has production credentials. | The `.env` file should use local Docker values for `DATABASE_URL` and `DATABASE_URL_DIRECT` when developing locally. Production values should only be in Vercel dashboard. Add a comment in `.env` or create a separate `.env.local` for local dev overrides. |
| IC-02 | **LOW** | **`npm run dev` will fail if port 3001 is in use.** The ws-server starts on a hardcoded port 3001. No error handling for EADDRINUSE. | Add try/catch in `ws-server.ts` to handle port conflicts gracefully. |
| IC-03 | **LOW** | **No `.env.local` file exists for local development overrides.** The `.env` file contains production Supabase credentials. Next.js loads `.env` first, then `.env.local` (which overrides). A `.env.local` with Docker DB values should exist for local dev. | Create `.env.local` with `DATABASE_URL=postgresql://callboard:callboard_dev@localhost:5432/callboard` and `DATABASE_URL_DIRECT` pointing to the same. |

---

## Summary by Severity

| Severity | Count | IDs |
|----------|-------|-----|
| HIGH | 4 | MI-01, MI-02, BG-01, SC-01 |
| MEDIUM | 9 | MI-03, MI-04, BG-02, BG-03, SC-02, SC-03, SC-04, TC-01, TC-02, IC-01 |
| LOW | 5 | MI-05, BG-04, SC-05, TC-03, IC-02, IC-03 |

---

## Verdict

**Phase 1 (Infrastructure) is solid.** Schema is complete and correct, theme tokens match SPEC-009, Docker/Vitest/security headers are all in place.

**Phase 2 (Authentication) has 4 HIGH-severity issues that need resolution before Phase 3:**

1. **MI-01 / BG-01: No Drizzle adapter in NextAuth.** Sessions are not being persisted to the database. This is a runtime failure — the app will crash on login.

2. **MI-02: No per-IP login rate limiting.** The spec's immutable constraint requires 5/min/IP. This is completely missing.

3. **SC-01: Session tokens are UUIDs, not 256-bit random.** This is a spec immutable constraint violation. The pragmatic fix is to accept NextAuth UUIDs for now and document the deviation, or switch to custom session management.

**Recommended fix order:**
1. Fix MI-01 first (adapter — blocks all auth functionality)
2. Fix SC-04 (CSP blocks Google OAuth — blocks testing)
3. Fix MI-02 (IP rate limiting)
4. Create `.env.local` for local dev (IC-01/IC-03)
5. Fix SC-01 pragmatically (accept UUIDs or implement custom sessions)
6. Address MEDIUM findings as Phase 3 begins

**The MEDIUM findings (missing resend-verification, CSRF, Google age gate, breached list size, test coverage) are real but do not block Phase 3 development.** They should be addressed before Phase 5 (Cast Onboarding) when the full auth flow is exercised end-to-end.
