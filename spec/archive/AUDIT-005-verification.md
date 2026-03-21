# AUDIT-005: GAN Round 5 -- Verification Pass

**Auditor:** Senior Engineer (Verification)
**Date:** 2026-03-21
**Scope:** Verify all 26 findings from AUDIT-004 are resolved in the current specs
**Method:** Read every spec file, grep for expected fix content, trace user flows end-to-end

---

## 1. Per-Finding Verification Table

| # | Severity | Finding | Status | Evidence |
|---|----------|---------|--------|----------|
| 1 | CRITICAL | No email delivery mechanism | **VERIFIED** | SPEC-002 Section 2.6 defines Nodemailer/SMTP with templates, error handling, rate limits. SPEC-007 Section 2 Tech Stack row "Email / Nodemailer + SMTP" present. SPEC-007 Section 4.2 has SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM env vars. |
| 2 | CRITICAL | Schedule algorithm not implementable | **VERIFIED** | SPEC-006 Section 2.2 contains full pseudocode (`generateSchedule` function) with 5 steps: regular dates, tech week, dress rehearsal, performance dates, sort+validate. SPEC-003 Section 5 Question 7 now says "exactly 1 day" for dress rehearsal. |
| 3 | HIGH | 90-day PII deletion job unspecified | **VERIFIED** | SPEC-007 Section 6.3 "Scheduled Jobs" defines two cron jobs (backup at 2AM, PII cleanup at 3AM). PII Cleanup description lists all tables to delete and specifies orphaned upload file cleanup. Retained data defined. |
| 4 | HIGH | Image upload storage undefined | **VERIFIED** | SPEC-004 Section 3.1 now specifies: storage path `/app/uploads/headshots/`, Docker named volume `uploads`, serving endpoint `GET /api/uploads/[filename]` with auth check and headers. SPEC-007 docker-compose.yml has `uploads:/app/uploads` volume and `uploads:` in volumes section. |
| 5 | HIGH | Staff demotion side effects undefined | **VERIFIED** | SPEC-003 Section 6.4.1 "Demotion Side Effects" added with 4 subsections: bulletin posts (remain, no edit), conflict data (403 on next request), chat conversations (history readable, no new Cast-to-Cast messages), WebSocket (4401 close on next revalidation). |
| 6 | HIGH | Unverified cast member flow incomplete | **VERIFIED** | SPEC-002 Section 2.3.1 contains "Unverified users and invite links" paragraph. Defines: auto-join without verification, CAN view bulletin/schedule/profile/conflicts, CANNOT create theater/production/post/chat. Verification banner on all pages. |
| 7 | HIGH | Performance dates never generated | **VERIFIED** | SPEC-003 Section 5 edge cases includes "Performance dates" paragraph generating dates from opening_night to closing_night. SPEC-006 Section 2.2 pseudocode Step 4 generates performance dates. Both specs aligned. |
| 8 | HIGH | Route count immutable constraint wrong | **VERIFIED** | SPEC-010 Immutable Constraints now says "Exactly 19 routes total" (confirmed at line 33). Route table lists 19 routes. Constraint matches reality. |
| 9 | MEDIUM | Manifest line numbers stale | **PARTIAL** | The manifest still has stale line numbers for multiple specs. SPEC-003 Database Schema listed at line 190, actual is 204 (off by 14). SPEC-003 Authorization at 252, actual is 267 (off by 15). SPEC-003 Test Scenarios at 260, actual is 275 (off by 15). SPEC-005 Database Schema at 124, actual is 136 (off by 12). SPEC-005 Test Scenarios at 181, actual is 198 (off by 17). All exceed the stated +/- 3 tolerance. Additionally, no manifest entry exists for SPEC-006 Section 2.2 (schedule algorithm pseudocode) or SPEC-004 Cast Navigation section. SPEC-003 overlapping section ranges (Database Schema end=258 vs Authorization line=252) not fixed. |
| 10 | MEDIUM | AGENT.md / SPEC-008 Phase 10 mismatch | **VERIFIED** | SPEC-008 Section 11 Phase 10 now reads: "Polish: Theater theme, responsive, accessibility / SPEC-009, SPEC-010, SPEC-001 / Medium". AGENT.md Section 8 Phase 10 says "SPEC-009, SPEC-010". These are close enough -- AGENT.md omits SPEC-001 but SPEC-001 is the overview and implicitly referenced. The critical mismatch (SPEC-008 listing only SPEC-001) is resolved. |
| 11 | MEDIUM | Breached password list format undefined | **VERIFIED** | SPEC-002 Section 2.2 now contains full specification: file at `src/lib/data/breached-passwords.txt`, one per line lowercase, NCSC/HIBP source, loaded into `Set<string>` at startup, case-insensitive check, committed to git. |
| 12 | MEDIUM | System bulletin posts violate NOT NULL author_id | **VERIFIED** | SPEC-003 Section 6.2 states: "System-generated posts ... are attributed to the Director who triggered the action. The `author_id` is the Director's user_id." Option A (recommended in AUDIT-004) was implemented. No schema change needed. |
| 13 | MEDIUM | Chat is_read trigger undefined | **VERIFIED** | SPEC-005 Section 5.1 "Read Status" defines: `POST /api/conversations/:id/mark-read` on conversation open/focus, sets `is_read = TRUE` for all messages where `sender_id != current_user_id`, unread count badge reflects totals, no read receipt to sender. |
| 14 | MEDIUM | Director not added to production_members | **VERIFIED** | SPEC-002 Section 6.1 Schema Notes contains: "Director auto-join: When a Director creates a production, the server MUST automatically insert a `production_members` row with `role = 'director'`..." Full justification included. |
| 15 | MEDIUM | Dress rehearsal day count unresolved | **VERIFIED** | SPEC-003 Section 5 Question 7 now says "If yes: last day of tech week is marked as dress (exactly 1 day)". SPEC-006 Section 2.2 pseudocode Step 3 marks only `techDates[techDates.length - 1]` as dress. Both specs agree on exactly 1 day. |
| 16 | MEDIUM | New Message chat flow undefined | **VERIFIED** | SPEC-005 Section 3.4 "Starting a New Conversation" defines 5-step flow: click New Message, contact picker filtered by role, select contact, deduplication check, redirect to conversation view. |
| 17 | MEDIUM | JetBrains Mono not in font loading setup | **VERIFIED** | SPEC-009 Section 4.5 Schedule dates row now includes: "Loaded via `next/font/google` with `display: swap` alongside Playfair Display and Libre Franklin. Fallback: `ui-monospace, 'Cascadia Code', 'Fira Code', monospace`". |
| 18 | MEDIUM | Unarchive flow has no UI | **VERIFIED** | SPEC-010 Section 3.13 now includes: "Archive/Unarchive: If the production is archived and within the 90-day window, a 'Restore Production' button appears. After 90 days, the button is replaced with 'PII deleted -- cannot be restored' (disabled state)." SPEC-003 Section 6.5 also references the unarchive UI location. |
| 19 | MEDIUM | Session rolling refresh undefined | **VERIFIED** | SPEC-002 Section 4 contains: "Rolling refresh: On every authenticated API request, the server checks if the session expires within the next 7 days. If so, the `expires_at` is extended to `NOW() + 30 days`." Defines "activity" as authenticated HTTP requests (not WebSocket frames or page loads without API calls). |
| 20 | LOW | productions.archived_at missing from schema SQL | **VERIFIED** | SPEC-003 Section 8 productions table now includes `archived_at TIMESTAMPTZ,` at line 225. Also mentioned in text at Section 6.5 and in manifest database table definition. |
| 21 | LOW | Re-clicking invite link when already a member | **NOT FIXED** | Searched SPEC-002 and SPEC-004 for "already a member", "already belong", "silently redirect" -- no matches found outside of AUDIT-004 itself. The recommended fix was not applied to any spec. |
| 22 | LOW | Conversation deduplication missing index | **NOT FIXED** | Searched SPEC-005 Section 6 for `idx_conversation_participants_user` and `idx_conversations_production` -- not present. The schema has `idx_messages_conversation` and `idx_messages_unread` but no indexes for conversation participant lookups. |
| 23 | LOW | Theater edit/delete not specified | **NOT FIXED** | Searched all specs for "Theater editing", "theater edit", "theater delete" -- no results in any spec (only in AUDIT-004 recommended fix text). SPEC-003 Section 3 still only defines theater creation. |
| 24 | LOW | CI/CD workflow structure undefined | **NOT FIXED** | SPEC-008 Section 10 still only says "Tests run on every push and PR via GitHub Actions (see `.github/workflows/ci.yml`)" with the 6-step list. No reference YAML structure was added. Searched for `runs-on`, `actions/checkout`, `npm ci.*lint` -- no matches. |
| 25 | LOW | Account settings OAuth linking flow undefined | **NOT FIXED** | Searched SPEC-010 for "Link Google", "Unlink Google", "OAuth linking" -- no results. Section 3.12 still only says "Connected accounts: Link/unlink Google OAuth" without defining the flow. |
| 26 | LOW | CSP + data URI texture interaction | **NOT FIXED** | Searched SPEC-002 for CSP note about data URIs -- no match. The recommended "accepted risk" comment was not added to SPEC-002 Section 5.1. |

### Verification Summary

| Status | Count | Findings |
|--------|-------|----------|
| VERIFIED | 19 | F-01 through F-08, F-10 through F-20 |
| PARTIAL | 1 | F-09 (manifest line numbers still stale) |
| NOT FIXED | 6 | F-21, F-22, F-23, F-24, F-25, F-26 |

**All 2 CRITICAL findings: VERIFIED.**
**All 6 HIGH findings: VERIFIED.**
**9 of 10 MEDIUM findings: VERIFIED. 1 PARTIAL (manifest).**
**0 of 7 LOW findings: VERIFIED. 1 PARTIAL (manifest, counted as MEDIUM). 6 NOT FIXED.**

---

## 2. New Issues Found

### NEW-01 [MEDIUM] -- Manifest line numbers exceed +/- 3 tolerance for multiple specs

The manifest header claims "ALL line numbers are approximate (within +/- 3 lines)." After the Round 4 fixes added substantial content to SPEC-002, SPEC-003, SPEC-005, and SPEC-006, the actual line numbers have drifted significantly:

| Spec | Section | Manifest Line | Actual Line | Drift |
|------|---------|---------------|-------------|-------|
| SPEC-003 | Database Schema (Director) | 190 | 204 | +14 |
| SPEC-003 | Authorization Rules | 252 | 267 | +15 |
| SPEC-003 | Test Scenarios | 260 | 275 | +15 |
| SPEC-005 | Database Schema (Chat) | 124 | 136 | +12 |
| SPEC-005 | Test Scenarios | 181 | 198 | +17 |

An agent following the progressive disclosure protocol would read the wrong lines and potentially miss critical content. The overlapping section ranges in SPEC-003 (Database Schema end=258 overlaps Authorization start=252) are also still present.

**Missing manifest entries:**
- SPEC-006 Section 2.2 (Schedule Generation Algorithm pseudocode) -- added by F-02 fix, no manifest entry
- SPEC-004 Cast Navigation section (lines 202-217) -- still not indexed
- SPEC-003 Section 6.4.1 (Demotion Side Effects) -- added by F-05 fix, no manifest entry
- SPEC-005 Section 3.4 (Starting a New Conversation) -- added by F-16 fix, no manifest entry
- SPEC-005 Section 5.1 (Read Status) -- added by F-13 fix, no manifest entry
- SPEC-002 Section 2.6 (Email Delivery) -- added by F-01 fix, no manifest entry

**Impact:** The progressive disclosure system is degraded. Agents will find content by reading full specs, but the manifest's value as a targeted index is reduced.

### NEW-02 [LOW] -- AGENT.md Phase 10 still omits SPEC-001

AGENT.md Section 8 Phase 10 lists "SPEC-009, SPEC-010" while SPEC-008 (now fixed) and the manifest both include SPEC-001. Minor inconsistency -- SPEC-001 is the overview and would be consulted naturally, so this is unlikely to cause implementation issues.

### NEW-03 [LOW] -- SPEC-005 messages table in manifest missing is_deleted column

The manifest database section for `messages` lists columns as "id, conversation_id, sender_id, body(2000), is_read, created_at" but the actual SPEC-005 schema includes `is_deleted BOOLEAN DEFAULT FALSE`. This column is referenced in the message deletion/moderation logic (Section 7) and its absence from the manifest could cause a migration miss.

### NEW-04 [LOW] -- No contradictions introduced by fixes

Cross-checked all verified fixes for inter-spec contradictions:
- F-01 (email): SPEC-002 and SPEC-007 agree on Nodemailer/SMTP, same env vars
- F-02 (algorithm): SPEC-003 and SPEC-006 pseudocode are consistent (both show same 5 steps)
- F-05 (demotion): SPEC-003 Section 6.4.1 aligns with SPEC-005 WebSocket 4401 behavior and SPEC-002 permission matrix
- F-06 (unverified cast): SPEC-002 Section 2.3.1 permissions are consistent with SPEC-004 cast flow (cast can submit conflicts but not post/chat)
- F-07 (performance dates): SPEC-003 and SPEC-006 both describe performance date generation from opening_night to closing_night
- F-14 (Director auto-join): SPEC-002 Section 6.1 note is consistent with SPEC-003 production creation flow
- F-15 (dress = 1 day): SPEC-003 Question 7 and SPEC-006 pseudocode Step 3 both say exactly 1 day

No new contradictions detected.

---

## 3. Prototype Completeness Checklist (Re-Traced)

### Flow 1: Director Registration and First Production

| Step | Action | Spec Coverage | Status |
|------|--------|--------------|--------|
| 1.1 | Director visits `/register` | SPEC-010 Sec 3.2, SPEC-002 Sec 2.3 | PASS |
| 1.2 | Enters name, email, DOB, password | SPEC-002 Sec 2.3, SPEC-010 Sec 3.2 | PASS |
| 1.3 | Age gate validates 13+ | SPEC-002 Sec 2.3 | PASS |
| 1.4 | Password checked against breached list | SPEC-002 Sec 2.2 (file, format, lookup defined) | PASS |
| 1.5 | Privacy policy checkbox required | SPEC-010 Sec 3.2 | PASS |
| 1.6 | Server creates user, sends verification email | SPEC-002 Sec 2.3.1 + Sec 2.6 (Nodemailer/SMTP) | PASS |
| 1.7 | User clicks verification link | SPEC-002 Sec 2.3.1 | PASS |
| 1.8 | User logs in, sees empty dashboard | SPEC-010 Sec 3.3 | PASS |
| 1.9 | User clicks "Add Theater" | SPEC-003 Sec 3, SPEC-010 Sec 3.3 | PASS |
| 1.10 | Enters theater name, city, state | SPEC-003 Sec 3 | PASS |
| 1.11 | User clicks "Create Production" | SPEC-003 Sec 4, SPEC-010 Sec 3.4 | PASS |
| 1.12 | Enters production name, dates, cast size | SPEC-003 Sec 4 | PASS |
| 1.13 | Director auto-added to production_members | SPEC-002 Sec 6.1 (Director auto-join note) | PASS |
| 1.14 | Schedule wizard Steps 1-6 | SPEC-003 Sec 5, SPEC-010 Sec 3.4 | PASS |
| 1.15 | Schedule wizard Step 7 (review + generate) | SPEC-006 Sec 2.2 pseudocode + SPEC-003 Sec 5 performance dates | PASS |
| 1.16 | Production dashboard loads | SPEC-010 Sec 3.5 | PASS |
| 1.17 | Director copies invite link | SPEC-003 Sec 6.3, SPEC-010 Sec 3.8 | PASS |
| 1.18 | Director posts to bulletin board | SPEC-003 Sec 6.2, SPEC-010 Sec 3.7 | PASS |

**Result: 18/18 PASS (100%)**

### Flow 2: Cast Member Joining via Invite Link

| Step | Action | Spec Coverage | Status |
|------|--------|--------------|--------|
| 2.1 | Cast receives invite link | SPEC-002 Sec 2.4 | PASS |
| 2.2 | Clicks link: `/join?token=xxx` | SPEC-002 Sec 2.4, SPEC-004 Sec 2 | PASS |
| 2.3 | Token validated, stored in session | SPEC-002 Sec 2.4 | PASS |
| 2.4 | Not logged in: redirect to register | SPEC-004 Sec 2 | PASS |
| 2.5 | Registers with email/password, DOB, age gate | SPEC-002 Sec 2.3 | PASS |
| 2.6 | Verification email sent | SPEC-002 Sec 2.6 (Nodemailer/SMTP) | PASS |
| 2.7 | Unverified user auto-joins production | SPEC-002 Sec 2.3.1 (unverified users + invite links) | PASS |
| 2.8 | Redirect to cast profile setup | SPEC-004 Sec 3, SPEC-010 Sec 3.11 | PASS |
| 2.9 | Enters name, phone, role, optional headshot | SPEC-004 Sec 3 | PASS |
| 2.10 | Headshot uploaded, stored, served | SPEC-004 Sec 3.1 (path, volume, API route defined) | PASS |
| 2.11 | Profile saved to cast_profiles | SPEC-004 Sec 4.5 | PASS |
| 2.12 | Redirect to conflict submission | SPEC-010 Sec 3.10 | PASS |
| 2.13 | Cast sees calendar, selects conflict dates | SPEC-004 Sec 4.1, SPEC-010 Sec 3.10 | PASS |
| 2.14 | Enters optional reasons (max 500 chars) | SPEC-004 Sec 4.1 | PASS |
| 2.15 | Submits conflicts (transaction, UNIQUE guard) | SPEC-004 Sec 4.3 | PASS |
| 2.16 | Redirect to bulletin board (poster tab) | SPEC-010 Sec 3.7, SPEC-004 Sec 5 | PASS |
| 2.17 | Cast views posts | SPEC-004 Sec 5.1 | PASS |
| 2.18 | Cast views schedule tab | SPEC-004 Sec 5.2 | PASS |
| 2.19 | Cast navigates to chat | SPEC-010 Sec 3.9 | PASS |
| 2.20 | Cast sees only Director/Staff in contacts | SPEC-005 Sec 3.3 | PASS |
| 2.21 | Cast clicks "+ New Message" to start chat | SPEC-005 Sec 3.4 (new conversation flow defined) | PASS |

**Result: 21/21 PASS (100%)**

### Flow 3: Director Daily Use

| Step | Action | Spec Coverage | Status |
|------|--------|--------------|--------|
| 3.1 | Director logs in, production dashboard | SPEC-010 Sec 3.5 | PASS |
| 3.2 | Views quick stats | SPEC-010 Sec 3.5 wireframe | PASS |
| 3.3 | Views schedule with conflict counts | SPEC-006 Sec 4.1 | PASS |
| 3.4 | Clicks date, sees conflict names + reasons | SPEC-006 Sec 4.1 | PASS |
| 3.5 | Edits a rehearsal time | SPEC-003 Sec 7 | PASS |
| 3.6 | System bulletin post for schedule change | SPEC-003 Sec 6.2 (attributed to Director) | PASS |
| 3.7 | Views conflict summary table | SPEC-006 Sec 4.2 | PASS |
| 3.8 | Promotes Cast to Staff | SPEC-003 Sec 6.4, SPEC-002 Sec 3.2 | PASS |
| 3.9 | Demotes Staff to Cast | SPEC-003 Sec 6.4.1 (demotion side effects defined) | PASS |
| 3.10 | Resets cast member's conflicts | SPEC-004 Sec 4.4 | PASS |
| 3.11 | Opens chat, sends message to Cast | SPEC-005, SPEC-010 Sec 3.9 | PASS |
| 3.12 | Deletes inappropriate message | SPEC-005 Sec 7 | PASS |
| 3.13 | Archives production | SPEC-003 Sec 6.5 | PASS |
| 3.14 | Unarchives production | SPEC-010 Sec 3.13 (Restore Production button) | PASS |

**Result: 14/14 PASS (100%)**

### Flow 4: Account Management

| Step | Action | Spec Coverage | Status |
|------|--------|--------------|--------|
| 4.1 | User visits `/account` | SPEC-010 Sec 3.12 | PASS |
| 4.2 | Edits name, email | SPEC-010 Sec 3.12 | PASS |
| 4.3 | Changes password | SPEC-010 Sec 3.12 | PASS |
| 4.4 | Links Google OAuth from settings | SPEC-010 Sec 3.12 | **FAIL** -- flow undefined (F-25 NOT FIXED) |
| 4.5 | Logs out of all devices | SPEC-002 Sec 4 | PASS |
| 4.6 | Deletes account with re-auth | SPEC-010 Sec 3.12 | PASS |

**Result: 5/6 PASS (83%)**

### Flow 5: Password Reset

| Step | Action | Spec Coverage | Status |
|------|--------|--------------|--------|
| 5.1 | User clicks "Forgot password" | SPEC-010 Sec 3.1 | PASS |
| 5.2 | Enters email | SPEC-002 Sec 2.5 | PASS |
| 5.3 | Server sends reset email | SPEC-002 Sec 2.5 + Sec 2.6 (Nodemailer) | PASS |
| 5.4 | User clicks reset link | SPEC-002 Sec 2.5 | PASS |
| 5.5 | New password set, sessions invalidated | SPEC-002 Sec 2.5 | PASS |

**Result: 5/5 PASS (100%)**

### Updated Prototype Completeness Score

| Flow | Steps | Pass | Fail | Completion |
|------|-------|------|------|------------|
| Director Registration + First Production | 18 | 18 | 0 | 100% |
| Cast Joining via Invite | 21 | 21 | 0 | 100% |
| Director Daily Use | 14 | 14 | 0 | 100% |
| Account Management | 6 | 5 | 1 | 83% |
| Password Reset | 5 | 5 | 0 | 100% |
| **Total** | **64** | **63** | **1** | **98%** |

**Improvement from AUDIT-004: 78% --> 98% (+20 percentage points)**

---

## 4. Remaining Work (Prioritized)

### Should fix before implementation starts

| Item | Severity | Effort | Impact |
|------|----------|--------|--------|
| Manifest line numbers (F-09 / NEW-01) | MEDIUM | 30 min | Progressive disclosure is degraded; agents read wrong lines |
| Manifest missing new sections (NEW-01) | MEDIUM | 15 min | 6 new sections have no manifest entries |

### Can fix during implementation (non-blocking)

| Item | Severity | Effort | Impact |
|------|----------|--------|--------|
| F-21: Re-click invite link behavior | LOW | 5 min | Edge case; builder can make reasonable choice (silent redirect) |
| F-22: Conversation dedup indexes | LOW | 5 min | Performance concern at scale; can add indexes during implementation |
| F-23: Theater edit/delete | LOW | 10 min | Minor gap; v1 can defer to "not available" |
| F-24: CI workflow YAML | LOW | 10 min | Builder can create from the 6-step description |
| F-25: OAuth linking from settings | LOW | 10 min | Account settings edge case; single user flow step fails |
| F-26: CSP data URI note | LOW | 2 min | Documentation-only; no functional impact |

---

## 5. Final Verdict

### **READY** for implementation -- with one caveat.

**Rationale:**

1. **All 2 CRITICAL findings are fully resolved.** Email delivery and schedule algorithm are now implementable. No day-1 blockers remain.

2. **All 6 HIGH findings are fully resolved.** PII deletion, image storage, demotion effects, unverified cast flow, performance dates, and route count are all specified.

3. **9 of 10 MEDIUM findings are resolved.** The remaining partial (manifest line numbers) degrades the progressive disclosure optimization but does not block implementation -- agents can fall back to reading full spec files.

4. **Prototype completeness is at 98%.** The only failing step is an edge case (OAuth linking from account settings) that affects a non-critical user flow.

5. **No new contradictions were introduced.** All fixes are internally consistent across specs.

6. **The 6 unfixed LOW findings are genuinely low-impact.** They are edge cases, performance optimizations, or documentation notes that can be addressed during implementation without rework.

**Recommendation:** Fix the manifest line numbers (30 minutes of effort) before handing off to builders. The 6 LOW items can be resolved as they come up during implementation phases. Proceed with Phase 1 (Infrastructure) immediately.
