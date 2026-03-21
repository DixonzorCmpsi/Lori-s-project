# SPEC-008: TDD Strategy & Test Plan

**Status:** Draft
**Last Updated:** 2026-03-21
**Depends On:** All specs

---

## Goals (Immutable)

- Every feature has tests written BEFORE implementation code
- Tests cover happy path, error path, and security path for each feature
- 80%+ line coverage on business logic
- 100% coverage on auth middleware, role permissions, chat boundaries, and conflict submission guards
- CI runs the full test suite (unit + integration + security) on every PR
- Security tests are mandatory, not optional, in every CI pipeline run

## Non-Goals (Explicit Exclusions)

- E2E browser tests in v1 (Playwright is deferred to a future phase)
- Performance or load testing
- Visual regression testing
- 100% coverage on all code (diminishing returns on generated code, config, type definitions)
- Manual QA process documentation

## Success Metric

No PR can merge with failing tests. Every test scenario ID (AUTH-XX, DIR-XX, CHAT-XX, SCHED-XX, SEC-XX, etc.) has a corresponding test function. CI completes in under 5 minutes.

## Immutable Constraints

- TDD cycle is RED -> GREEN -> REFACTOR. The RED step is never skipped; every test must be observed failing before implementation.
- Integration tests use a real PostgreSQL database, not mocks or in-memory substitutes.
- Security tests run in every CI pipeline. They cannot be skipped, marked pending, or separated into an optional job.
- Test database is `callboard_test`, fully separate from dev and production databases.
- Each test suite wraps in a transaction that rolls back after completion. No shared state between test files.

---

## 1. Overview

Every feature is implemented by writing tests first, observing them fail, then writing the minimum code to make them pass. No production code is written without a corresponding test.

## 2. TDD Cycle

```
1. READ the spec        — Know what to build
2. WRITE the test       — Define expected behavior in code
3. RUN tests -> RED     — Confirm the test fails (feature doesn't exist yet)
4. WRITE minimum code   — Just enough to make the test pass
5. RUN tests -> GREEN   — All tests pass
6. REFACTOR             — Clean up, keep tests green
7. COMMIT               — Feature complete
```

## 3. Test Types

### 3.1 Unit Tests

- Test individual functions, utilities, and business logic
- No database, no network, no external services
- Fast — run in milliseconds
- Example: password validation, schedule generation logic, role permission checks

### 3.2 Integration Tests

- Test API routes with a real test database
- Database is reset between test suites
- Test auth flows, CRUD operations, role-based access
- Example: "POST /api/productions creates a production and returns 201"

### 3.3 E2E Tests (deferred — not implemented in v1)

- Deferred to a future phase. Test files in `tests/e2e/` MUST exist as empty stubs with `test.skip()` and a comment referencing the PAGE-XX scenario ID.
- When implemented: Playwright browser tests covering full user flows.

## 4. Test Organization

```text
tests/
  unit/
    auth/
      password.test.ts        — Password hashing, validation, breached password check
      permissions.test.ts     — Role-based permission checks (director, staff, cast)
    schedule/
      generator.test.ts       — Schedule generation from wizard answers + edge cases
      conflicts.test.ts       — Conflict submission logic + race condition handling
    chat/
      boundaries.test.ts      — Chat access control (cast can't message cast)
  integration/
    auth/
      login.test.ts           — Login endpoints (Google OAuth, email/password)
      registration.test.ts    — Registration flow + age gate
      invite.test.ts          — Invite link flow (expiry, max uses, token cleanup)
      password-reset.test.ts  — Password reset flow (token, expiry, session invalidation)
      lockout.test.ts         — Account lockout after failed attempts
    productions/
      create.test.ts          — Production CRUD + date validation
      schedule.test.ts        — Schedule API endpoints + soft-delete
      bulletin.test.ts        — Bulletin board CRUD + Markdown sanitization
      roster.test.ts          — Staff elevation, demotion, member removal
    chat/
      messages.test.ts        — Send/receive messages + rate limiting
      contacts.test.ts        — Contact list filtering by role
      websocket.test.ts       — WebSocket auth, session expiry, reconnection
    cast/
      conflicts.test.ts       — Conflict submission + immutability + Director reset
      profile.test.ts         — Cast profile setup + image upload validation
  security/
    injection.test.ts         — SQL injection attempts on all text input endpoints
    xss.test.ts               — XSS payloads in bulletin posts, profiles, chat messages
    idor.test.ts              — Accessing other productions' data via direct API calls
    csrf.test.ts              — State-changing requests without CSRF token
    upload.test.ts            — Malicious file uploads (SVG with script, oversized, wrong type)
    auth-bypass.test.ts       — Expired sessions, tampered cookies, missing auth headers
    rate-limit.test.ts        — Exceeding rate limits on login, chat, registration
    enum.test.ts              — Email enumeration via login/register response differences
```

## 5. Test Tooling

| Tool | Purpose |
|------|---------|
| Vitest | Test runner (fast, ESM-native, works with Next.js) |
| @testing-library/react | Component testing (unit tests for React components) |
| next-test-api-route-handler | API route testing (MUST use this, not supertest — works with Next.js App Router) |
| PostgreSQL (test DB) | Real database for integration tests |
| @faker-js/faker | Generate test data (use `@faker-js/faker`, not the deprecated `faker` package) |

## 6. Test Database Strategy

- Separate test database: `callboard_test`
- Migrations run before test suite starts via a `globalSetup` script in `vitest.config.ts`
- Each test file MUST wrap all operations in a database transaction that rolls back in `afterEach`. MUST NOT use table truncation (rollback is faster and avoids DDL locks).
- No shared state between test files

## 7. Test-to-Spec Mapping

Every spec includes a "Test Scenarios" table. Tests are named to reference these:

| Spec | Test File(s) | Scenario IDs |
|------|-------------|-------------|
| SPEC-002 Auth | `tests/integration/auth/*.test.ts` | AUTH-01 through AUTH-27 |
| SPEC-003 Director | `tests/integration/productions/*.test.ts` | DIR-01 through DIR-23 |
| SPEC-004 Cast | `tests/integration/cast/*.test.ts` | CAST-01 through CAST-20 |
| SPEC-005 Chat | `tests/integration/chat/*.test.ts` | CHAT-01 through CHAT-20 |
| SPEC-006 Schedule | `tests/integration/productions/schedule.test.ts` | SCHED-01 through SCHED-14 |
| SPEC-007 Infra | `tests/integration/infra/health.test.ts` | INFRA-01 through INFRA-12 |
| Security | `tests/security/*.test.ts` | SEC-01 through SEC-10 |
| SPEC-009 Frontend | `tests/unit/components/*.test.tsx` | FE-01 through FE-10 |
| SPEC-010 Pages | `tests/e2e/*.test.ts` (Playwright, future) | PAGE-01 through PAGE-12 |

## 8. Coverage Requirements

- **Target:** 80%+ line coverage on business logic
- **Required 100%:** Auth middleware, role permission checks, chat boundaries, invite token validation, conflict submission guards
- **Not required:** Generated code, config files, type definitions

## 9. Security Test Scenarios

These tests live in `tests/security/` and cover OWASP Top 10 risks relevant to this app.

| ID | Scenario | Expected Result |
|----|----------|-----------------|
| SEC-01 | SQL injection in production name field | Input parameterized, no DB error or data leak |
| SEC-02 | XSS script tag in bulletin post Markdown body | Script stripped by sanitizer, rendered safely |
| SEC-03 | Cast accesses Director's production endpoint (IDOR) | 403 Forbidden |
| SEC-04 | State-changing POST without CSRF token | 403 Forbidden |
| SEC-05 | Upload SVG file with embedded JavaScript as headshot | Rejected — JPEG/PNG only (magic byte check) |
| SEC-06 | Upload file exceeding 5MB as headshot | Rejected with 413 Payload Too Large |
| SEC-07 | Expired session token used for API call | 401, redirect to login |
| SEC-08 | Tampered/random session cookie value | 401, session not found |
| SEC-09 | 100 login attempts in 1 minute (same account) | Rate limited after 5/IP, account locked after 10 |
| SEC-10 | Login with non-existent email vs wrong password | Identical 401 "Invalid email or password" response |

## 10. CI Integration

Tests run on every push and PR via GitHub Actions (see `.github/workflows/ci.yml`):

1. Spin up PostgreSQL service
2. Install dependencies
3. Run linter
4. Run full test suite (unit + integration + security)
5. Build the app
6. Report results

PRs MUST NOT merge if any test fails. The GitHub branch protection rule MUST require the CI status check to pass. Security tests are not in a separate job — they run in the same job as unit and integration tests.

**CI/CD split:** GitHub Actions runs the test suite (unit + integration + security with Docker PostgreSQL). Vercel handles build + deploy only. GitHub Actions MUST use `services: postgres:16.6-alpine` with the same credentials as the dev docker-compose (`callboard`/`callboard_dev`/`callboard_test`).

## 11. Implementation Order

Features are built in this order, each following the TDD cycle:

| Phase | Feature | Spec | Priority |
|-------|---------|------|----------|
| 1 | Infrastructure (Supabase project, Vercel project, local dev DB, env config) | SPEC-007 | Setup |
| 2 | Auth (Google OAuth + email/password) | SPEC-002 | Critical |
| 3 | Director: Theater + Production CRUD | SPEC-003 | Critical |
| 4 | Director: Schedule Builder | SPEC-003, SPEC-006 | Critical |
| 5 | Invite Link + Cast Onboarding | SPEC-002, SPEC-004 | Critical |
| 6 | Cast: Conflict Submission | SPEC-004, SPEC-006 | Critical |
| 7 | Bulletin Board | SPEC-003, SPEC-004 | High |
| 8 | Chat System | SPEC-005 | High |
| 9 | Director: Aggregated Conflict View | SPEC-006 | High |
| 10 | Polish: Theater theme, responsive, accessibility | SPEC-009, SPEC-010, SPEC-001 | Medium |
