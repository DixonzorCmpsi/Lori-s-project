# Digital Call Board — Agent Rules

## Stack
- **Backend:** Python 3.11+ / FastAPI / SQLAlchemy (async) / Supabase PostgreSQL
- **Frontend:** React 19 / Vite / TypeScript
- **Backend Tests:** pytest (async) / httpx / factory-boy / freezegun
- **Frontend Tests:** Vitest / React Testing Library
- **Auth:** Google OAuth 2.0 + email/password (bcrypt) / JWT sessions
- **Realtime:** Supabase Realtime (production) / ws (development)

## TDD Workflow
Tests are written FIRST. All tests are in:
- `backend/tests/` — pytest test suite
- `frontend/tests/` — Vitest test suite

Implementation should make the tests pass. Specs are in `spec/`.

## Key Constraints
- Exactly 3 roles: director, staff, cast
- Cast-to-cast messaging blocked at API level
- Conflicts are immutable after submission (DB UNIQUE constraint)
- Age gate at 13+ (COPPA) — raw DOB never stored
- 90-day PII deletion after production archival
