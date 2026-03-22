# AUDIT-010: Phase 3+4 GAN Audit

**Auditor:** GAN Round 10
**Date:** 2026-03-21
**Scope:** Phase 3 (Theater/Production CRUD) + Phase 4 (Schedule Builder) code

---

## Findings

### Category 1: Security (IDOR / Authorization)

| # | Severity | Location | Finding | Fix |
|---|----------|----------|---------|-----|
| S-01 | **HIGH** | `schedule/dates/[dateId]/route.ts:39,73` | **IDOR on PATCH and DELETE.** The dateId is looked up by `eq(rehearsalDates.id, dateId)` without verifying the date belongs to the production in the URL (`id`). An attacker with Director role on Production A could PATCH/DELETE rehearsal dates from Production B by guessing the dateId UUID. | Add `and(eq(rehearsalDates.id, dateId), eq(rehearsalDates.productionId, id))` to all WHERE clauses. |
| S-02 | **MEDIUM** | `schedule/dates/[dateId]/route.ts:29` | **Note field not validated.** The PATCH endpoint accepts `body.note` without length validation. The DB CHECK constraint (`char_length(note) <= 1000`) will catch it, but the API should return a 400 with a friendly message instead of a raw DB error. | Add: `if (typeof body.note === "string" && body.note.length > 1000) return validationError(...)`. |
| S-03 | **MEDIUM** | `productions/route.ts:88-103` | **Production creation + director auto-join not in a transaction.** If the `productionMembers` insert fails after the production is created, you get an orphaned production with no director — the director would fail their own membership check. | Wrap lines 88-136 in a Drizzle transaction (`db.transaction(async (tx) => { ... })`). |
| S-04 | **LOW** | `productions/route.ts:106-121` | **Wizard data (selectedDays, startTime, etc.) not validated on server.** The Zod `productionSchema` validates production fields, but wizard fields are cast with `as` without validation. Malformed `selectedDays` (e.g., `[99, -1]`) would pass through to the generator. | The generator handles bad days gracefully (they just won't match any dates), so this is low risk. But add basic validation: `selectedDays` must be integers 0-6, `startTime`/`endTime` must match HH:MM pattern. |

### Category 2: Spec Compliance

| # | Severity | Location | Finding | Fix |
|---|----------|----------|---------|-----|
| C-01 | **MEDIUM** | `schedule/dates/[dateId]/route.ts:44-52` | **PATCH only creates bulletin post on cancellation, not time changes.** SPEC-006 Section 5.1 requires a bulletin post for ALL schedule modifications including time changes: "Rehearsal time changed: {date} now {newStartTime}-{newEndTime}". Currently only `isCancelled` triggers a post. | Add bulletin post creation when `startTime` or `endTime` is updated. |
| C-02 | **LOW** | `schedule/dates/route.ts` | **Add-date endpoint doesn't validate date belongs to production's date range.** A director could add a rehearsal date that's before `firstRehearsal` or after `closingNight`. The spec doesn't explicitly block this but it would be surprising. | Optional guard: validate the date is within the production's date range. Low priority since the Director is intentionally adding dates. |

### Category 3: Code Quality

| # | Severity | Location | Finding | Fix |
|---|----------|----------|---------|-----|
| Q-01 | **LOW** | `generator.ts:1` | **Unused imports from date-fns.** `getDay` and `format` are imported but never used. We use native `d.getDay()` and our own `formatDate()`. | Remove `getDay, format` from the import. |
| Q-02 | **LOW** | `schedule/page.tsx:5` | **Unused import: `sql` from drizzle-orm.** | Remove `sql` from import. |
| Q-03 | **LOW** | `(dashboard)/page.tsx:10-11` | **Redundant auth check.** The dashboard layout already redirects to `/login` if unauthenticated. The page does the same check again. Not harmful but unnecessary. | Remove the auth check from page.tsx — the layout handles it. But keeping it is also fine for defense-in-depth. |
| Q-04 | **LOW** | `(dashboard)/layout.tsx` + `production/[productionId]/layout.tsx` | **Nested sidebar rendering.** The parent dashboard layout renders a `<Sidebar />` (no production context), and the production layout ALSO renders a `<Sidebar />` (with production context). This means the production pages render TWO sidebars. | The parent dashboard layout should NOT render a sidebar — it should only handle auth + age gate. The sidebar should be rendered only by the production layout (which has context) and by individual pages (dashboard, theater/new) that need a simpler sidebar. Fix: move `<Sidebar />` out of `(dashboard)/layout.tsx`. |

---

## Summary

| Severity | Count | IDs |
|----------|-------|-----|
| HIGH | 1 | S-01 |
| MEDIUM | 3 | S-02, S-03, C-01 |
| LOW | 5 | S-04, C-02, Q-01, Q-02, Q-03, Q-04 |

## Verdict

**One HIGH must be fixed before Phase 5 (Cast Onboarding):**

1. **S-01: IDOR on schedule date PATCH/DELETE.** A director of one production could modify another production's dates. Add production_id check to WHERE clauses.

**Three MEDIUMs should be fixed now (quick):**
- S-02: Validate note length in PATCH
- S-03: Wrap production creation in transaction
- C-01: Create bulletin posts for time changes

**LOWs are cleanup** — unused imports and nested sidebar layout. Fix opportunistically.
