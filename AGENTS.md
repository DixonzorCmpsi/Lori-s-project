# Digital Call Board — Agent Rules

## Stack

- **Backend:** Python 3.9+ / FastAPI / SQLAlchemy async / JWT auth
- **Frontend:** React 19 / Vite 6 / TypeScript / Tailwind CSS 4
- **Database:** PostgreSQL (Supabase)
- **Tests:** pytest 361 passing (backend) / Vitest stubs (frontend)

## Project Layout

```
backend/app/         — FastAPI application
backend/tests/       — pytest test suite
frontend/src/        — React SPA
spec/                — 10 specification documents
```

## Running

```bash
./start.sh           # Both servers
./start-backend.sh   # Backend at :8000
./start-frontend.sh  # Frontend at :5173
```

## Key Constraints

- Exactly 3 roles: director, staff, cast
- Cast-to-cast messaging blocked at API level
- Conflicts are immutable after submission (DB UNIQUE constraint)
- Age gate at 13+ (COPPA) — raw DOB never stored
- 90-day PII deletion after production archival
- All API errors return `{"error": "CODE", "message": "..."}`
