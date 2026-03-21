# AUDIT-001: Full Spec Security & Architecture Review

**Auditor:** 20+ year Software/Security/DevOps Engineer
**Date:** 2026-03-21
**Scope:** All specs (SPEC-001 through SPEC-008), `.github/workflows/ci.yml`
**Severity Levels:** CRITICAL / HIGH / MEDIUM / LOW

---

## Findings Summary

| # | Severity | Spec | Finding |
|---|----------|------|---------|
| 1 | CRITICAL | 002 | OAuth account linking enables account takeover |
| 2 | CRITICAL | 004 | PII collection of minors (DOB) with no privacy/COPPA consideration |
| 3 | CRITICAL | 007 | PostgreSQL port 5432 exposed to host network |
| 4 | HIGH | 002 | Invite tokens never expire — leaked links grant permanent access |
| 5 | HIGH | 002 | No OAuth CSRF protection (state parameter) or PKCE specified |
| 6 | HIGH | 002 | Session IDs use UUID — insufficient entropy for session tokens |
| 7 | HIGH | 002 | No password reset flow exists |
| 8 | HIGH | 003 | Bulletin board "rich text" with no XSS sanitization strategy |
| 9 | HIGH | 004 | Image upload (headshot) with no validation, size limits, or storage strategy |
| 10 | HIGH | 005 | WebSocket authentication not specified |
| 11 | HIGH | 007 | App port 3000 exposed to host — bypasses Cloudflare |
| 12 | MEDIUM | 002 | No per-account lockout — only per-IP rate limiting |
| 13 | MEDIUM | 002 | Email enumeration possible via login/register responses |
| 14 | MEDIUM | 002 | Password policy too weak — only 8 chars, no breach check |
| 15 | MEDIUM | 002 | No "log out all devices" capability |
| 16 | MEDIUM | 002 | Invite token in URL path — logged in server/browser/CDN logs |
| 17 | MEDIUM | 002 | No Content-Security-Policy or security headers specified |
| 18 | MEDIUM | 002 | Missing `updated_at` auto-update mechanism |
| 19 | MEDIUM | 003 | No input length limits on any text fields |
| 20 | MEDIUM | 003 | No date validation (first rehearsal could be after opening night) |
| 21 | MEDIUM | 003 | Schedule generation edge cases unhandled (tech week vs blocked dates) |
| 22 | MEDIUM | 004 | Race condition on conflict submission (TOCTOU) |
| 23 | MEDIUM | 004 | No Director escape hatch to reset a cast member's conflicts |
| 24 | MEDIUM | 005 | No chat message rate limiting |
| 25 | MEDIUM | 005 | No conversation deduplication constraint |
| 26 | MEDIUM | 006 | Cascade-delete of conflicts when rehearsal removed destroys data |
| 27 | MEDIUM | 007 | No Docker restart policy — contradicts INFRA-04 test |
| 28 | MEDIUM | 007 | `cloudflared:latest` tag — non-deterministic builds |
| 29 | MEDIUM | 007 | No backup encryption |
| 30 | LOW | 003 | No authorization spec for theater ownership checks |
| 31 | LOW | 005 | No database-level constraint preventing duplicate conversations |
| 32 | LOW | 007 | No log management strategy (rotation, levels, PII scrubbing) |
| 33 | LOW | 007 | No SSL between app and database containers |
| 34 | LOW | 007 | No health check defined on db service (but `service_healthy` is referenced) |
| 35 | LOW | 008 | No security-focused test scenarios (injection, XSS, IDOR) |

---

## Detailed Findings

### FINDING-01 [CRITICAL] — OAuth Account Linking Enables Account Takeover

**Spec:** SPEC-002, Section 2.1
**Quote:** "If a user with the same email already exists (from email/password signup), link the accounts"

**Vulnerability:** An attacker who knows a victim's email can create a Google account with that email address, then use Google OAuth to silently take over the victim's existing account. Google does not guarantee email ownership of custom domain emails.

**Fix:** Only auto-link if the existing account's `email_verified = true` AND the Google OAuth email is marked as `email_verified` in the Google ID token. Otherwise, require the user to authenticate via the existing method first to prove ownership.

---

### FINDING-02 [CRITICAL] — PII of Minors With No Privacy Controls

**Spec:** SPEC-004, Section 3; SPEC-001, Section 6
**Issue:** The app targets high school students (minors) and collects Date of Birth, phone number, and headshot photos. There is no mention of:
- Privacy policy or terms of service
- COPPA/FERPA compliance considerations
- Data retention and deletion policies
- Right to deletion (GDPR if any EU users)
- Parental consent requirements for users under 13 (COPPA) or under 16 (some states)
- What happens to PII when a cast member is removed or production ends

**Fix:** Add a data privacy section to SPEC-001. Define data retention periods, deletion on production close, and age gating (must be 13+ to register, or 16+ to avoid COPPA entirely). Consider if DOB is truly needed — "grade level" or "age range" may suffice without storing an exact birthdate.

---

### FINDING-03 [CRITICAL] — PostgreSQL Exposed to Host Network

**Spec:** SPEC-007, Section 4.3
**Quote:** `ports: - "5432:5432"` on the db service

**Vulnerability:** This binds PostgreSQL to `0.0.0.0:5432` on the host. If the host has any public interface (which it does — Cloudflare tunnel implies internet connectivity), the database is directly accessible from the network. Password-only auth on a network-exposed PG is easily brute-forced.

**Fix:** Remove the `ports` mapping from the db service entirely. The app service connects via Docker's internal network (`db:5432`) and doesn't need host port exposure. For local dev access, bind to localhost only: `"127.0.0.1:5432:5432"`.

---

### FINDING-04 [HIGH] — Invite Tokens Never Expire

**Spec:** SPEC-002, Section 2.4
**Quote:** "Tokens do not expire by default"

**Risk:** Invite links can leak through email forwards, group chats, browser history, or Cloudflare access logs. A leaked link grants anyone Cast-level access to the production indefinitely. For high school productions involving minors, this is a safeguarding concern.

**Fix:** Add a default expiry (e.g., 30 days from creation). Add `expires_at TIMESTAMPTZ` to `invite_tokens` table. Director can regenerate to extend. Also add a max-uses cap (e.g., `max_uses INTEGER` + `use_count INTEGER DEFAULT 0`).

---

### FINDING-05 [HIGH] — No OAuth CSRF or PKCE

**Spec:** SPEC-002, Section 2.1
**Issue:** The Google OAuth flow doesn't specify:
- A `state` parameter for CSRF protection on the callback
- PKCE (Proof Key for Code Exchange) to prevent authorization code interception

Without `state`, an attacker can CSRF the OAuth callback to link their Google account to a victim's active session. Without PKCE, an intercepted auth code can be replayed.

**Fix:** Require `state` parameter (cryptographically random, tied to user's session, validated on callback). Require PKCE with S256 challenge method. Note: if using NextAuth.js, both are handled automatically — spec should state this as a requirement and verify the auth library provides them.

---

### FINDING-06 [HIGH] — Session Tokens Use UUID

**Spec:** SPEC-002, Section 6
**Issue:** `sessions.id` is `UUID PRIMARY KEY DEFAULT gen_random_uuid()`. UUIDs have 122 bits of randomness in a predictable format (8-4-4-4-12 hex). Session tokens should be opaque, high-entropy random strings.

**Fix:** Use a separate `token` column with `encode(gen_random_bytes(32), 'hex')` (256 bits). The cookie carries the token, not the UUID primary key. This prevents session prediction and makes brute-force computationally infeasible.

---

### FINDING-07 [HIGH] — No Password Reset Flow

**Spec:** SPEC-002
**Issue:** There is registration and login but no "forgot password" mechanism. Users who forget their password are locked out permanently (unless they have Google OAuth linked).

**Fix:** Add a password reset flow: email-based reset link with a time-limited token (1 hour), single-use, invalidated on use or expiry. Add test scenarios AUTH-13 and AUTH-14 for happy/error paths.

---

### FINDING-08 [HIGH] — Rich Text XSS Vector

**Spec:** SPEC-003, Section 6.2
**Quote:** "Director can create posts (title + body, rich text)"

**Vulnerability:** "Rich text" implies HTML content. Without server-side sanitization, a Director (or compromised Director account) can inject `<script>` tags or event handlers that execute in every cast member's browser.

**Fix:** Either (a) use Markdown instead of HTML and render with a safe Markdown library, or (b) sanitize all HTML with a strict allowlist (DOMPurify with allowlisted tags: `p, b, i, ul, ol, li, a, h1-h3, br`). Sanitization MUST happen server-side before storage, not just on render.

---

### FINDING-09 [HIGH] — Image Upload Without Validation

**Spec:** SPEC-004, Section 3
**Issue:** Headshot/photo upload is specified with no:
- File type validation (SVG can contain JavaScript = XSS)
- File size limit (could be used for storage DoS)
- Filename sanitization (path traversal via `../../etc/passwd.jpg`)
- Content-Type verification (check magic bytes, not just extension)
- Storage location specification (local? S3? public or signed URLs?)

**Fix:** Add image upload requirements: max 5MB, JPEG/PNG only (verify magic bytes), strip EXIF data (can contain GPS/PII), generate random filename on server, serve from a separate subdomain or signed URL. No SVG, no GIF (animation can be used for abuse).

---

### FINDING-10 [HIGH] — WebSocket Auth Not Specified

**Spec:** SPEC-005, Section 4
**Issue:** WebSocket connections don't automatically inherit HTTP cookies in all environments. The spec doesn't define how WS connections are authenticated. An unauthenticated WebSocket would allow anyone to read messages.

**Fix:** Specify that WebSocket upgrade must validate the session cookie (or a short-lived WS ticket issued after HTTP auth). Reject unauthenticated upgrade requests with 401. Re-validate session periodically (or on every message) since sessions can expire mid-connection.

---

### FINDING-11 [HIGH] — App Port Exposed to Host

**Spec:** SPEC-007, Section 4.3
**Quote:** `ports: - "3000:3000"` on the app service

**Risk:** Port 3000 is accessible on the host's public interface, bypassing Cloudflare entirely. This means no DDoS protection, no HTTPS, no WAF — and direct access to the app.

**Fix:** Remove `ports` from the app service. Cloudflare Tunnel connects via Docker's internal network. For local dev, bind to localhost: `"127.0.0.1:3000:3000"`.

---

### FINDING-12 [MEDIUM] — No Per-Account Lockout

**Spec:** SPEC-002, Section 2.2
**Issue:** Rate limit is "5 per minute per IP." A distributed attacker using multiple IPs (botnets, rotating proxies) bypasses this entirely. No per-account lockout exists.

**Fix:** Add per-account lockout: after 10 failed attempts within 15 minutes, lock the account for 30 minutes. Send email notification on lockout. Add test scenario AUTH-15.

---

### FINDING-13 [MEDIUM] — Email Enumeration

**Spec:** SPEC-002, Section 2.2-2.3
**Issue:** Different responses for "email not found" vs "wrong password" allow an attacker to enumerate valid email addresses.

**Fix:** Return identical error messages for both cases: "Invalid email or password." Registration should also not reveal whether an email is taken — instead say "If this email is registered, you'll receive a verification email."

---

### FINDING-14 [MEDIUM] — Weak Password Policy

**Spec:** SPEC-002, Section 2.2
**Issue:** 8-character minimum with no other requirements. "password1" and "12345678" would pass.

**Fix:** Add: minimum 8 chars AND check against top 10,000 breached passwords list (ship a static list, no external API needed). No complexity rules (they don't help and annoy users). Add a password strength meter on the UI.

---

### FINDING-15 [MEDIUM] — No "Log Out All Devices"

**Spec:** SPEC-002, Section 4
**Issue:** Only single-session logout is specified. If an account is compromised, there's no way to invalidate all sessions.

**Fix:** Add a "Log out of all devices" action that deletes all rows from `sessions` where `user_id` matches. Director should have this on their account settings page.

---

### FINDING-16 [MEDIUM] — Invite Token Logged in URLs

**Spec:** SPEC-002, Section 2.4
**Issue:** `/join/{invite_token}` puts the secret token in the URL path. This is logged in: server access logs, browser history, Cloudflare analytics, any intermediate proxies, and the `Referer` header if the page loads external resources.

**Fix:** Use the token as a query parameter with immediate server-side redirect: `GET /join?token=xxx` validates the token, sets a session flag, then redirects to `/join` (clean URL). The token never appears in subsequent page loads or Referer headers.

---

### FINDING-17 [MEDIUM] — No Security Headers

**Spec:** SPEC-002, SPEC-007
**Issue:** No mention of HTTP security headers anywhere. Missing: Content-Security-Policy, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Strict-Transport-Security, Permissions-Policy.

**Fix:** Add a security headers section to SPEC-007. Specify Next.js `headers()` config in `next.config.js` with at minimum: CSP (script-src 'self'), X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy: strict-origin-when-cross-origin.

---

### FINDING-18 [MEDIUM] — No `updated_at` Auto-Update

**Spec:** SPEC-002, Section 6
**Issue:** `users.updated_at` defaults to `NOW()` but has no trigger or application-level mechanism to update on modification. It will always show the creation time.

**Fix:** Either add a PostgreSQL trigger (`CREATE TRIGGER ... BEFORE UPDATE ... SET NEW.updated_at = NOW()`) or specify that the ORM (Prisma/Drizzle) handles this via `@updatedAt` annotation. Same applies to `productions.updated_at` and `bulletin_posts.updated_at`.

---

### FINDING-19 [MEDIUM] — No Input Length Limits

**Spec:** SPEC-003, SPEC-004
**Issue:** No max lengths on: theater name, production name, city, state, bulletin post title, bulletin post body, cast profile name, conflict reasons, rehearsal notes. A malicious user could submit megabytes of text.

**Fix:** Add explicit max lengths to every text field in every schema. Suggested: names 200 chars, city/state 100 chars, post title 200 chars, post body 10,000 chars, notes 1,000 chars, reasons 500 chars. Enforce at both DB level (CHECK constraints) and API validation.

---

### FINDING-20 [MEDIUM] — No Production Date Validation

**Spec:** SPEC-003, Section 4
**Issue:** No validation that `first_rehearsal < opening_night < closing_night`. A Director could set opening night before first rehearsal, creating an impossible schedule.

**Fix:** Add CHECK constraints: `first_rehearsal <= opening_night` and `opening_night <= closing_night`. Also validate at the API level with clear error messages. Add test scenario DIR-14 for invalid date ordering.

---

### FINDING-21 [MEDIUM] — Schedule Generation Edge Cases

**Spec:** SPEC-003, Section 5
**Issue:** Undefined behavior when: (a) tech week days fall on blocked dates, (b) tech week extends before first_rehearsal, (c) dress rehearsal and tech week overlap, (d) no valid days exist after filtering.

**Fix:** Define precedence rules: tech week overrides day-of-week filter (rehearsals happen every day during tech week), blocked dates override tech week (if a blocked date falls in tech week, skip it with a warning), dress rehearsals are a subset of tech week (last 1-2 days). Add edge case test scenarios.

---

### FINDING-22 [MEDIUM] — Race Condition on Conflict Submission

**Spec:** SPEC-004, Section 4; SPEC-006, Section 3.3
**Issue:** The flow is check `conflict_submissions` then insert. Two simultaneous requests can both pass the check. The UNIQUE constraint catches it at the DB level, but the spec doesn't specify error handling for the constraint violation.

**Fix:** Specify that the INSERT into `conflict_submissions` is the authoritative guard. If it raises a unique violation, return 409 Conflict with message "Conflicts already submitted." The check is an optimization, not the lock. Wrap the entire conflict submission in a transaction.

---

### FINDING-23 [MEDIUM] — No Director Reset of Cast Conflicts

**Spec:** SPEC-004, Section 4.2
**Issue:** If a cast member submits with errors, there is zero recourse. The Director cannot reset their conflicts. This will cause real-world friction.

**Fix:** Add a Director action: "Reset conflicts for [cast member]" which deletes their `conflict_submissions` row and all `cast_conflicts` rows, allowing re-submission. Add test scenario CAST-13. This is a v1 necessity, not a nice-to-have.

---

### FINDING-24 [MEDIUM] — No Chat Rate Limiting

**Spec:** SPEC-005
**Issue:** No rate limit on message sending. A user (or bot hitting the API) could flood a conversation with thousands of messages.

**Fix:** Add rate limiting: max 30 messages per minute per user. Return 429 on excess. Add test scenario CHAT-11.

---

### FINDING-25 [MEDIUM] — No Conversation Deduplication

**Spec:** SPEC-005, Section 3.1
**Issue:** "A conversation is created on first message between two users" — but no mechanism prevents creating duplicate conversations between the same pair. Multiple API calls could race.

**Fix:** Add a unique composite index on the conversation_participants table — or better, use a deterministic conversation lookup: `SELECT` existing conversation with both participants before creating. Wrap in a transaction with a lock.

---

### FINDING-26 [MEDIUM] — Cascade Delete Destroys Conflict Data

**Spec:** SPEC-006, Section 5
**Issue:** "Remove rehearsal date → Associated conflicts are cascade-deleted." The Director loses visibility into the fact that cast had conflicts on that date. This historical data may matter for scheduling decisions.

**Fix:** Soft-delete rehearsal dates instead of hard-delete. Add `is_deleted BOOLEAN DEFAULT FALSE` to `rehearsal_dates`. Deleted dates are hidden from cast views but conflicts remain queryable by the Director. Alternatively, archive conflicts before deletion.

---

### FINDING-27 [MEDIUM] — No Docker Restart Policy

**Spec:** SPEC-007, Section 4.3
**Issue:** No `restart:` policy specified on any service. Test INFRA-04 expects auto-restart after crash, but Docker won't restart containers without an explicit policy.

**Fix:** Add `restart: unless-stopped` to all three services in docker-compose.yml.

---

### FINDING-28 [MEDIUM] — Non-Deterministic Docker Tags

**Spec:** SPEC-007, Section 4.3
**Issue:** `cloudflare/cloudflared:latest` can change at any time, potentially breaking the tunnel.

**Fix:** Pin to a specific version (e.g., `cloudflare/cloudflared:2024.12.0`). Same principle: pin `postgres:16-alpine` to a specific patch (e.g., `postgres:16.6-alpine`). Document the upgrade process.

---

### FINDING-29 [MEDIUM] — Unencrypted Backups

**Spec:** SPEC-007, Section 6.2
**Issue:** Backups are plaintext pg_dump files containing user emails, password hashes, DOB, and messages. If the host is compromised or a backup is accidentally exposed, all data is leaked.

**Fix:** Encrypt backups with GPG or age: `pg_dump | gpg --encrypt --recipient backup@... > backup.sql.gpg`. Store the decryption key separately from the backup location.

---

### FINDING-30 [LOW] — No Theater Ownership Authorization

**Spec:** SPEC-003
**Issue:** The spec says Director creates a theater but doesn't explicitly state that API endpoints must verify `theaters.owner_id = current_user.id` before allowing modifications. An authenticated user could potentially modify another Director's theater via direct API calls.

**Fix:** Add explicit ownership check to all theater/production modification endpoints. Test scenario DIR-15: "Non-owner tries to modify theater → 403 Forbidden."

---

### FINDING-31 [LOW] — Duplicate Conversation Potential

**Spec:** SPEC-005, Section 6
**Issue:** The `conversation_participants` table has a UNIQUE on `(conversation_id, user_id)` but nothing prevents two separate conversations being created between the same pair.

**Fix:** Add a function or query pattern to find-or-create conversations by participant set. Document the expected lookup pattern in the spec.

---

### FINDING-32 [LOW] — No Log Management

**Spec:** SPEC-007
**Issue:** No logging strategy defined. No log rotation, no log levels, no PII scrubbing. Server logs will contain user IPs, emails (from error messages), and request paths (with invite tokens).

**Fix:** Add logging requirements: structured JSON logs, log levels (info/warn/error), PII scrubbing (mask emails, redact tokens), Docker log driver with rotation (`max-size: 10m, max-file: 3`).

---

### FINDING-33 [LOW] — No TLS Between App and Database

**Spec:** SPEC-007, Section 4.3
**Issue:** DATABASE_URL has no `?sslmode=require`. Traffic between app and db containers traverses Docker's bridge network unencrypted. While this is internal, defense-in-depth suggests encrypting.

**Fix:** For v1 on a single host, document this as an accepted risk: "App and DB communicate over Docker internal network. No TLS configured. Acceptable for single-host deployment. If services are ever split across hosts, add sslmode=require."

---

### FINDING-34 [LOW] — Missing DB Health Check Definition

**Spec:** SPEC-007, Section 4.3
**Issue:** `depends_on: db: condition: service_healthy` is specified but no `healthcheck:` block is defined on the db service. Docker will consider it immediately healthy.

**Fix:** Add healthcheck to db service:
```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U callboard"]
  interval: 10s
  timeout: 5s
  retries: 5
```

---

### FINDING-35 [LOW] — No Security Test Scenarios

**Spec:** SPEC-008
**Issue:** The TDD plan has no security-focused test category. Missing: SQL injection tests, XSS in bulletin posts, IDOR (accessing other productions' data), CSRF on state-changing endpoints, path traversal in image uploads.

**Fix:** Add a `tests/security/` directory with test scenarios: SEC-01 through SEC-10 covering OWASP Top 10 relevant to this app. Add to the test-to-spec mapping table.

---

## Risk Summary

- **3 CRITICAL** findings that must be fixed before any code is written
- **8 HIGH** findings that must be fixed before deployment
- **17 MEDIUM** findings that should be addressed during implementation
- **6 LOW** findings that should be addressed before production release
- **Total: 35 findings**
