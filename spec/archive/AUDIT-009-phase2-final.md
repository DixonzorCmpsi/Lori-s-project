# AUDIT-009: Phase 2 Final GAN Audit (Pre-Phase 3 Gate)

**Auditor:** GAN Round 9 (Adversarial Reviewer)
**Date:** 2026-03-21
**Scope:** All code after AUDIT-008 remediation — final gate check before Phase 3
**Method:** Source code review against specs, runtime path analysis, dependency inspection

---

## AUDIT-008 Remediation Verification

| AUDIT-008 Finding | Claimed Fix | Actual Status |
|-------------------|-------------|---------------|
| MI-01 (no adapter) | Added DrizzleAdapter | **BROKEN** — see A-01 below |
| MI-02 (no IP rate limit) | Added middleware | **PARTIAL** — see A-02 below |
| MI-03 (resend-verification) | Created endpoint | **OK** — endpoint exists, rate limited, anti-enumeration |
| MI-04 (CSRF) | Added origin validation | **BROKEN** — see A-03 below |
| MI-05 (updated_at triggers) | Created migration SQL | **OK** — `drizzle/0001_triggers.sql` has all 4 triggers |
| BG-01 (unused sessions import) | Claimed cleaned | **NOT FIXED** — `reset-password/route.ts` still imports sessions (but now it's used for deletion, which is a separate bug — see A-04) |
| BG-02 (unused imports in auth) | Claimed cleaned | **FIXED** — `auth/index.ts` no longer imports `sessions`, `and`, `gt` |
| BG-03 (lockout error) | Throws ACCOUNT_LOCKED | **FIXED** — `authorize()` throws, login page detects |
| SC-01 (session tokens) | Spec updated, switched to JWT | **OK** — spec amended, JWT strategy used |
| SC-02 (Google age gate) | Spec updated, age_range left NULL | **PARTIAL** — see A-05 |
| SC-03 (breached list) | Downloaded 10k list | **FIXED** — `breached-passwords.txt` has 10,000 entries |
| SC-04 (CSP blocks OAuth) | Updated CSP in next.config | **FIXED** — Google domains added |
| SC-05 (429 login handling) | Login page handles rate limit | **FIXED** — checks `result.error` and `result.status` |
| TC-01 (low test count) | Not claimed fixed | **STILL OPEN** — 14 unit tests, no integration tests |
| TC-02 (no security tests) | Not claimed fixed | **STILL OPEN** — deferred to later phase |
| IC-01 (.env production URLs) | Created .env.local | **FIXED** — local dev values override production .env |

---

## NEW FINDINGS

### A-01: DrizzleAdapter is fundamentally incompatible with our schema (HIGH — CRITICAL)

**Location:** `src/lib/auth/index.ts:12`

**Problem:** `DrizzleAdapter(db)` expects NextAuth-standard tables: `user` (text ID), `account`, `session`, `verificationToken`. Our schema has `users` (UUID ID), no `account` table, and different column types.

With JWT strategy, the adapter is still invoked for:
- `createUser()` on Google OAuth sign-in → tries to insert into a `user` table that doesn't exist
- `getUserByEmail()` → tries to query a `user` table that doesn't exist
- `linkAccount()` → tries to insert into an `account` table that doesn't exist

Meanwhile, our custom `signIn` callback ALSO manually inserts into our `users` table. This is a double-write race condition at best, a crash at worst.

**Evidence:** The adapter source (`node_modules/@auth/drizzle-adapter/lib/pg.js`) creates a default `pgTable("user", ...)` with `id: text("id")` — not UUID. If no custom tables are passed, it will attempt to use tables named `user`, `account`, `session`, `verificationToken` which DO NOT EXIST in our database.

**Fix:** **Remove `DrizzleAdapter(db)` entirely.** With JWT strategy + our custom `signIn` callback handling all user creation and account linking, the adapter serves no purpose and will crash at runtime. The Credentials provider returns a user object directly to the JWT callback — no adapter needed. Google OAuth user creation is handled in our `signIn` callback.

---

### A-02: IP rate limiting middleware may not intercept before NextAuth (MEDIUM)

**Location:** `src/middleware.ts:59`

**Problem:** The middleware intercepts `POST /api/auth/callback/credentials`. However, Next.js 16 shows a deprecation warning: "The middleware file convention is deprecated. Please use proxy instead." The middleware may still function in Next.js 16 but its execution order relative to the route handler needs verification.

Additionally, the in-memory `Map` resets on every serverless cold start in production (Vercel). Effective rate limiting requires a durable store.

**Fix:** For dev, the in-memory Map is acceptable. For production, add a database-backed rate limit table (similar to `chat_rate_limits`) or use Vercel KV. Document the limitation for now. The middleware deprecation warning should be monitored but is not yet breaking.

---

### A-03: CSRF origin check applies to NextAuth's own routes (MEDIUM)

**Location:** `src/middleware.ts:75`

**Problem:** The CSRF check condition is:
```js
pathname.startsWith("/api/auth/") && !pathname.includes("[...nextauth]")
```
At runtime, NextAuth routes are `/api/auth/callback/credentials`, `/api/auth/callback/google`, `/api/auth/signin`, `/api/auth/signout`. The string `[...nextauth]` is a file-system convention — it NEVER appears in the actual URL path. So `!pathname.includes("[...nextauth]")` is always `true`.

This means the CSRF origin check runs on ALL `/api/auth/*` POST requests, including NextAuth's own callback routes. Google OAuth callbacks from `accounts.google.com` will have `Origin: https://accounts.google.com` which will FAIL the origin check, blocking Google sign-in.

**Fix:** Change the CSRF check to only apply to our custom routes:
```js
const customAuthRoutes = ["/api/auth/register", "/api/auth/forgot-password",
  "/api/auth/reset-password", "/api/auth/verify-email", "/api/auth/resend-verification"];
if (method === "POST" && customAuthRoutes.some(r => pathname === r)) {
```

---

### A-04: Password reset session invalidation is broken with JWT strategy (HIGH)

**Location:** `src/app/api/auth/reset-password/route.ts:56`

**Problem:** The reset-password route does `db.delete(sessions).where(eq(sessions.userId, ...))` to invalidate all user sessions. But with `strategy: "jwt"`, NextAuth sessions are stored in JWT cookies on the client, NOT in the `sessions` database table. Deleting rows from the `sessions` table has zero effect on active JWT sessions.

After a password reset, the old JWT cookies remain valid until they expire (30 days). An attacker who stole a session cookie would retain access even after the victim resets their password. This is a security vulnerability that the spec explicitly calls out: "All existing sessions for the user are deleted on reset (forces re-login on all devices)".

**Fix:** Two options:
1. **Add a token version to the user record.** Add `tokenVersion INTEGER DEFAULT 0` to the `users` table. Increment it on password reset. In the `jwt` callback, store `tokenVersion` in the JWT. In the `session` callback (or a custom middleware), verify the JWT's `tokenVersion` matches the DB. If not, force re-login. This is the standard approach for JWT session invalidation.
2. **Switch back to database sessions.** Remove JWT strategy, use `strategy: "database"`, and properly configure the adapter or use custom session management. This is more aligned with the original spec but requires resolving the adapter schema conflict (A-01).

**Recommend option 1** — it's simpler and keeps the JWT benefits (no DB read on every request for session validation), while adding invalidation capability only on security-critical events (password reset, logout-all).

---

### A-05: Google OAuth users have no age gate enforcement (MEDIUM)

**Location:** `src/lib/auth/index.ts:116-124`

**Problem:** The `signIn` callback creates Google OAuth users with no `ageRange` value. The spec update says to redirect to `/complete-profile` for age collection. But the `redirect` callback in NextAuth (line 141-146) doesn't actually check for missing `ageRange` — it just does standard URL normalization. There is no `/complete-profile` page or API route. There is no middleware or layout guard that blocks access until `ageRange` is set.

**Fix:** Three things needed:
1. Create a `/complete-profile` page that collects DOB and derives age range
2. Create `POST /api/auth/complete-profile` that validates age gate and sets `ageRange`
3. Add a check in the dashboard layout: if `ageRange` is NULL, redirect to `/complete-profile`

This is a Phase 2.5 task — it can be deferred to Phase 3 since it only affects Google OAuth users and doesn't block credentials auth.

---

### A-06: `age_range` CHECK constraint blocks NULL but Google OAuth sets NULL (LOW)

**Location:** `src/lib/db/schema.ts:36`

**Problem:** The schema has `check("users_age_range_check", sql`${table.ageRange} IN ('13-17', '18+')`)`. This CHECK constraint only validates when a value is present (NULLs pass CHECK constraints in PostgreSQL). So NULL `ageRange` from Google OAuth will not be blocked at the DB level. This is actually correct behavior for the current design (NULL means "not yet collected"), but it should be documented.

**Fix:** No code change needed. Document that NULL `ageRange` means "age gate not yet completed (Google OAuth user needs to visit /complete-profile)".

---

### A-07: Register page redirects on success even when email already exists (LOW)

**Location:** `src/app/(auth)/register/page.tsx:82`

**Problem:** After `fetch("/api/auth/register")`, if `res.ok` (which includes the anti-enumeration 200 for existing emails), the page redirects to `/verify-email?pending=true`. The API returns 200 for both new registrations AND existing emails (anti-enumeration). But the register page checks `!res.ok && data.fields` and only shows errors for non-200 responses. For existing emails, it silently redirects to the verify page, which is actually correct behavior (anti-enumeration means the user sees the same flow regardless). So this is **working as intended** — marking OK.

**Status:** OK — anti-enumeration correctly implemented.

---

### A-08: No `next-env.d.ts` type augmentation for NextAuth session (LOW)

**Location:** Missing file

**Problem:** The `session` callback adds `session.user.id = token.id as string`, but TypeScript doesn't know that `session.user` has an `id` property. This will cause type errors when consuming the session in components.

**Fix:** Create `src/types/next-auth.d.ts`:
```ts
declare module "next-auth" {
  interface Session {
    user: { id: string; name?: string | null; email?: string | null; image?: string | null }
  }
}
```

---

## Summary by Severity

| Severity | Count | IDs |
|----------|-------|-----|
| HIGH | 2 | A-01, A-04 |
| MEDIUM | 3 | A-02, A-03, A-05 |
| LOW | 3 | A-06, A-07 (OK), A-08 |

---

## Verdict

**Two HIGH-severity issues must be fixed before Phase 3:**

1. **A-01: Remove DrizzleAdapter.** It will crash at runtime because our schema doesn't match NextAuth's expected tables. Since we use JWT strategy and handle all user CRUD in the `signIn` callback, the adapter is unnecessary.

2. **A-04: JWT session invalidation is broken.** Password reset deletes from a `sessions` table that isn't used. Add a `tokenVersion` column to `users` and validate it in the JWT callback.

**One MEDIUM should be fixed now:**

3. **A-03: CSRF middleware blocks Google OAuth.** The pathname check is wrong — needs to explicitly list custom routes instead of trying to exclude NextAuth routes.

**Remaining items can be deferred:**
- A-02 (rate limit durability): acceptable for MVP with in-memory
- A-05 (Google age gate page): defer to Phase 3 since it only affects OAuth and doesn't block credentials
- A-08 (TypeScript types): minor DX issue

**Fix order: A-01 → A-03 → A-04 → A-08**
