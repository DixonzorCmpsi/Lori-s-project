# AUDIT-002: Post-Fix GAN Analysis (Second Pass)

**Auditor:** 20+ year Software/Security/DevOps Engineer
**Date:** 2026-03-21
**Scope:** All specs (SPEC-001 through SPEC-008) after AUDIT-001 fixes applied
**Purpose:** Verify all 35 AUDIT-001 findings are resolved, identify any new issues introduced by the fixes, and find any gaps missed in the first pass.

---

## Part 1: AUDIT-001 Finding Verification

| # | Severity | Finding | Status | Evidence |
|---|----------|---------|--------|----------|
| 1 | CRITICAL | OAuth account linking account takeover | RESOLVED | SPEC-002:37 — Safe account linking requires both sides email_verified = true |
| 2 | CRITICAL | PII of minors with no privacy controls | RESOLVED | SPEC-001:122-156 — Full Section 7 added: age gate 13+, age_range not DOB stored, 90-day retention, deletion rights, privacy policy |
| 3 | CRITICAL | PostgreSQL port exposed to host | RESOLVED | SPEC-007:98 — Comment "NO ports exposed", removed from services table |
| 4 | HIGH | Invite tokens never expire | RESOLVED | SPEC-002:87-88 — 30-day expiry + max_uses cap (default 100), schema has expires_at and use_count |
| 5 | HIGH | No OAuth CSRF/PKCE | RESOLVED | SPEC-002:35-36 — State parameter + PKCE S256 explicitly required |
| 6 | HIGH | Session IDs use UUID | RESOLVED | SPEC-002:220 — sessions.token uses encode(gen_random_bytes(32)) 256-bit, cookie carries token not UUID |
| 7 | HIGH | No password reset flow | RESOLVED | SPEC-002:92-110 — Full Section 2.5 with SHA-256 hashed tokens, 1hr expiry, session invalidation |
| 8 | HIGH | Rich text XSS | RESOLVED | SPEC-003:103 — Changed to Markdown with server-side sanitization, no raw HTML |
| 9 | HIGH | Image upload no validation | RESOLVED | SPEC-004:48-55 — Full Section 3.1 with magic bytes, EXIF stripping, UUID filenames, 5MB limit |
| 10 | HIGH | WebSocket auth not specified | RESOLVED | SPEC-005:61-70 — Full Section 4.1 with session validation, 5-min re-check, 4401 close code |
| 11 | HIGH | App port exposed to host | RESOLVED | SPEC-007:113-116 — Ports commented out, localhost-only for dev |
| 12 | MEDIUM | No per-account lockout | RESOLVED | SPEC-002:55 — 10 attempts/15 min -> 30 min lock, email notification, DB columns added |
| 13 | MEDIUM | Email enumeration | RESOLVED | SPEC-002:56 — Identical 401 responses, registration doesn't reveal existing emails |
| 14 | MEDIUM | Weak password policy | RESOLVED | SPEC-002:52 — Top 10K breached password check, no complexity rules |
| 15 | MEDIUM | No log out all devices | RESOLVED | SPEC-002:163 — Delete all sessions for user_id from account settings |
| 16 | MEDIUM | Invite token in URL path | RESOLVED | SPEC-002:86 — Query parameter with immediate redirect to clean URL |
| 17 | MEDIUM | No security headers | RESOLVED | SPEC-002:174-185 — Full Section 5.1 with CSP, X-Frame-Options, HSTS, etc. |
| 18 | MEDIUM | No updated_at trigger | RESOLVED | SPEC-002:205-216 — set_updated_at() function + triggers on users, productions, bulletin_posts |
| 19 | MEDIUM | No input length limits | RESOLVED | SPEC-003:149-194 — CHECK constraints on all text fields across all tables |
| 20 | MEDIUM | No date validation | RESOLVED | SPEC-003:52-55 + :166-167 — CHECK constraints first_rehearsal <= opening_night <= closing_night |
| 21 | MEDIUM | Schedule edge cases | RESOLVED | SPEC-003:80-86 — Full edge case section: tech week override, blocked date precedence, clamping, empty schedule |
| 22 | MEDIUM | Race condition on conflicts | RESOLVED | SPEC-004:80-90 — Full Section 4.3 with transaction-based guard, constraint violation handling |
| 23 | MEDIUM | No Director conflict reset | RESOLVED | SPEC-004:92-101 — Full Section 4.4 with flow, confirmation dialog, bulletin notification |
| 24 | MEDIUM | No chat rate limiting | RESOLVED | SPEC-005:72-76 — Section 4.2 with 30/min/user limit |
| 25 | MEDIUM | No conversation deduplication | RESOLVED | SPEC-005:32 — SELECT ... FOR UPDATE dedup pattern specified |
| 26 | MEDIUM | Cascade delete destroys conflicts | RESOLVED | SPEC-006:95 — Soft-delete is default, hard-delete requires explicit confirmation |
| 27 | MEDIUM | No Docker restart policy | RESOLVED | SPEC-007:91,112,135 — restart: unless-stopped on all services |
| 28 | MEDIUM | Non-deterministic Docker tags | RESOLVED | SPEC-007:90,134 — postgres:16.6-alpine, cloudflared:2024.12.2 |
| 29 | MEDIUM | Unencrypted backups | RESOLVED | SPEC-007:189-195 — GPG AES256 encryption, piped in-flight, separate key storage |
| 30 | LOW | No theater ownership auth | RESOLVED | SPEC-003:207 — Explicit ownership check in middleware, test DIR-19 |
| 31 | LOW | Duplicate conversations | RESOLVED | SPEC-005:32,105-107 — SELECT FOR UPDATE dedup pattern in schema comments |
| 32 | LOW | No log management | RESOLVED | SPEC-007:222-246 — Full Section 9 with structured JSON, PII scrubbing, log rotation |
| 33 | LOW | No TLS between app and DB | RESOLVED | SPEC-007:158 — Documented as accepted risk with upgrade path |
| 34 | LOW | Missing DB health check | RESOLVED | SPEC-007:99-103 — pg_isready healthcheck block on db service |
| 35 | LOW | No security test scenarios | RESOLVED | SPEC-008:76-84,124-139 — tests/security/ directory + SEC-01 through SEC-10 |

**Result: All 35 findings RESOLVED.**

---

## Part 2: New Issues Introduced by Fixes

| # | Severity | Spec | Finding | Recommendation |
|---|----------|------|---------|----------------|
| N-01 | LOW | 001 | Section 3.3 still references "date of birth" in cast capabilities | Update line 63 to remove DOB reference — it contradicts Section 7.2 which says DOB is not collected in profile |
| N-02 | LOW | 002 | Registration flow (Section 2.3) doesn't mention age gate | Add age gate step: "User enters DOB for age check. If under 13, registration is blocked. If 13+, DOB is discarded and age_range is derived." |
| N-03 | LOW | 003 | Theater fields (Section 3) still lack max length annotations | Add "(max 200)", "(max 100)", "(max 100)" to the fields table to match the DB CHECK constraints |
| N-04 | LOW | 004 | SPEC-004 Section 5.2 doesn't mention soft-deleted dates are hidden | Add note: "Soft-deleted dates (is_deleted = TRUE) are excluded from the cast schedule view" |

---

## Part 3: Gaps Not Caught in AUDIT-001

| # | Severity | Spec | Finding | Recommendation |
|---|----------|------|---------|----------------|
| G-01 | MEDIUM | 002 | Email verification token not specified | The registration flow mentions "send verification email" but never defines the token format, storage, or expiry. Add: verification tokens use same pattern as password reset (256-bit random, SHA-256 hashed in DB, 24-hour expiry, single-use). Add `email_verification_tokens` table or reuse `password_reset_tokens` with a `type` column |
| G-02 | MEDIUM | 003 | Bulletin post editing not specified | Director can create and delete posts but editing existing posts is not addressed. Can a Director edit a post after creation? If yes, add edit behavior. If no, state explicitly that posts are immutable after creation (except delete) |
| G-03 | MEDIUM | 005 | Chat message deletion/moderation not specified | Can a Director delete inappropriate chat messages? Can a user delete their own messages? No moderation capability exists. For an app used by minors, some form of message moderation by the Director is important. Add: Director can delete any message in the production's conversations |
| G-04 | LOW | 002 | NEXTAUTH_SECRET minimum entropy not specified | NEXTAUTH_SECRET should be at least 32 bytes of cryptographic randomness. Add: "Generate with `openssl rand -base64 32`. Do not use short or predictable strings." |
| G-05 | LOW | 003 | No production archival flow specified | SPEC-003 schema has `is_archived` on productions but no section describes when/how archival happens, what it means for active users, or how it ties into the 90-day PII deletion from SPEC-001 Section 7.3 |
| G-06 | LOW | 007 | No `.gitignore` specified | SPEC-007 mentions `.env` should not be in git but never specifies that a `.gitignore` file should exist with entries for `.env`, `node_modules/`, uploads directory, backup files, etc. |
| G-07 | LOW | 007 | No Dockerfile spec | The Docker Compose references `build: .` but no Dockerfile requirements are specified (base image, multi-stage build, non-root user, .dockerignore) |
| G-08 | LOW | ALL | No error code catalog | Each spec defines error scenarios but there's no unified error response format. API should return consistent JSON: `{ "error": "CODE", "message": "Human-readable message" }`. Helps frontend display appropriate messages and helps debugging |

---

## Summary

| Category | Count | Status |
|----------|-------|--------|
| AUDIT-001 findings (35 total) | 35 | All RESOLVED |
| New issues from fixes | 4 | All LOW — minor spec inconsistencies |
| New gaps discovered | 8 | 2 MEDIUM, 6 LOW |
| **Total open items** | **12** | **No CRITICAL or HIGH issues remain** |

## Risk Assessment

The specs are now in **good shape for implementation**. All CRITICAL and HIGH security issues from AUDIT-001 are resolved. The remaining 12 items are LOW/MEDIUM housekeeping that can be addressed during implementation without blocking the start of Phase 1 (infrastructure) or Phase 2 (auth).

The two MEDIUM items (G-01 email verification token spec, G-03 chat moderation for minors) should be addressed before their respective implementation phases begin.
