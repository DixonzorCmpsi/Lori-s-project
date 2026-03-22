# AUDIT-011: Pre-Production GAN Audit

**Auditor:** GAN Round 11
**Date:** 2026-03-21
**Scope:** Full codebase audit against all 10 specs before production deployment
**Method:** File inventory, route map comparison, schema verification, code review

---

## 1. Route Completeness

All 19 routes from SPEC-010 Section 2 exist. **PASS.**

## 2. Missing Pages / Features

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| MP-01 | **HIGH** | **No `/complete-profile` page for Google OAuth age gate.** SPEC-002 Section 2.1 says new Google users with NULL `age_range` redirect to `/complete-profile`. The dashboard layout checks for NULL age_range and redirects, but the destination page doesn't exist — users hit a 404. | Create `/complete-profile` page with DOB input + age gate validation + `PATCH /api/account/age-range` endpoint. |
| MP-02 | **MEDIUM** | **No 404 page (`not-found.tsx`).** SPEC-010 audit finding U-01. Invalid production IDs return a blank page. | Create `src/app/not-found.tsx` with "Page not found" message + link to dashboard. |
| MP-03 | **MEDIUM** | **No archived production read-only enforcement.** When a production is archived, APIs for bulletin posts, chat messages, schedule changes, and conflict submission should reject writes with a 403. Currently only the PATCH/DELETE on the production itself checks `isArchived`. A user could still post to an archived production's bulletin or send chat messages. | Add an `isArchived` check to all write endpoints: bulletin POST, chat messages POST, schedule dates POST/PATCH/DELETE, conflicts POST, invite POST. Return `403 "Production is archived (read-only)"`. |

## 3. Component Architecture (SPEC-009 Section 3)

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| CA-01 | **HIGH** | **14 spec components don't exist.** SPEC-009 defines component files in `src/components/auth/`, `src/components/production/`, `src/components/chat/`. None were created. All logic is inline in page files (many over 200 lines). This violates the spec's project structure AND makes pages hard to maintain. | The spec's component structure is aspirational. Two options: (a) Extract components from pages to match spec. (b) Update spec to match reality — acknowledge inline pages for v1, plan extraction for v2. **Recommend (b) for MVP** — extracting now would be pure refactoring with no functional gain, and the page files are self-contained. Update SPEC-009 Section 3 to note that v1 uses inline page components. |
| CA-02 | **MEDIUM** | **4 empty component directories** (`src/components/auth/`, `src/components/production/`, `src/components/chat/`, `src/styles/`). These were created as placeholders but never populated. | Delete empty directories. They create confusion about what exists. |

## 4. Codebase Organization

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| CO-01 | **HIGH** | **No backend/frontend separation.** The user requested a `backend/` and `frontend/` folder structure. Currently everything is under `src/` with API routes mixed into the Next.js app directory. In Next.js App Router, this is the standard pattern — API routes live in `src/app/api/` alongside pages. A separate `backend/` folder doesn't fit Next.js conventions. However, the business logic in `src/lib/` CAN be better organized into `src/server/` (server-only) and `src/shared/` (shared types/validators). | Reorganize `src/lib/` into: `src/server/` (auth, db, email, storage, schedule, markdown, api-error, rbac) and `src/shared/` (validators, types). This makes the boundary between server and client code explicit. Pages and components stay in `src/app/` and `src/components/` per Next.js convention. |
| CO-02 | **MEDIUM** | **`src/lib/utils.ts` is a shadcn/ui boilerplate file** containing just a `cn()` function. It's used by `button.tsx` only. Fine to keep but doesn't need its own top-level file. | Leave as-is — shadcn/ui expects it at this path. |

## 5. Schema Alignment

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| SA-01 | **LOW** | **`chat_rate_limits` table in schema but not in SPEC-MANIFEST.xml.** Already flagged in AUDIT-007 (M-02). Still not added. | Add to manifest. |

## 6. Test Coverage

| # | Severity | Finding |
|---|----------|---------|
| TC-01 | **MEDIUM** | **114 tests exist but spec requires 150 scenario IDs.** Unit tests cover the pure logic well (generator, passwords, age gate, tokens, permissions, markdown, upload validation, chat boundaries, conflicts). Missing: integration tests (require running DB), security tests, frontend tests, and E2E tests (deferred per spec). For MVP launch, the unit tests cover the critical paths. Integration/security tests should be Phase 10.5 before production. |

## 7. Spec-Code Misalignment

| # | Severity | Finding | Fix |
|---|----------|---------|-----|
| SC-01 | **MEDIUM** | **SPEC-009 Section 3 project structure doesn't match actual code.** Spec shows flat `src/lib/auth.ts`, `src/lib/db.ts`, `src/lib/permissions.ts`, `src/lib/websocket.ts`. Actual uses subdirectories: `src/lib/auth/index.ts`, `src/lib/db/index.ts`, `src/lib/auth/rbac.ts`, `src/lib/realtime/ws-server.ts`. The actual is MORE organized than the spec. | Update SPEC-009 Section 3 to match the actual structure. The actual is better. |

---

## 8. Proposed Codebase Reorganization

Current:
```
src/
  app/           (pages + API routes — Next.js standard)
  components/    (UI components)
  lib/           (everything: auth, db, email, storage, validators, etc.)
  types/
  middleware.ts
```

Proposed:
```
src/
  app/           (pages + API routes — unchanged, Next.js standard)
  components/    (UI components — sidebar, mobile-nav, button)
  server/        (server-only code — NEVER imported by client components)
    auth/        (NextAuth config, password, tokens, age-gate, rbac)
    db/          (Drizzle client, schema)
    email.ts
    storage/
    schedule/
    markdown.ts
    api-error.ts
  shared/        (shared between server and client)
    validators.ts
    types.ts
  styles/        (if globals.css moves here)
  middleware.ts
```

This makes the server/client boundary explicit. `src/server/` files use Node.js APIs (crypto, fs, pg) and must NEVER be imported by `"use client"` components. `src/shared/` files are pure TypeScript (Zod schemas, type definitions) safe for both.

**Key constraint:** The `schedule/generator.ts` is imported by both the wizard page (client) and the API route (server). It must stay in `src/shared/` since it's a pure function with no Node.js dependencies.

---

## Summary

| Severity | Count | IDs |
|----------|-------|-----|
| HIGH | 3 | MP-01, CA-01/CO-01 (reorg) |
| MEDIUM | 5 | MP-02, MP-03, CA-02, TC-01, SC-01 |
| LOW | 1 | SA-01 |

## Fix Order

1. **Update SPEC-009** to match actual project structure (SC-01, CA-01)
2. **Reorganize codebase** — `src/lib/` → `src/server/` + `src/shared/` (CO-01)
3. **Create `/complete-profile` page** + age-range API (MP-01)
4. **Create `not-found.tsx`** (MP-02)
5. **Add archived production write guards** (MP-03)
6. **Clean up empty directories** (CA-02)
7. **Update manifest** (SA-01)
