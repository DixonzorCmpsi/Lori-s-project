# Digital Call Board — Agent Rules

## Stack

- **Backend:** Python 3.11+ / FastAPI / SQLAlchemy async / JWT auth
- **Frontend:** React 19 / Vite 6 / TypeScript / Tailwind CSS 4 / framer-motion
- **Database:** PostgreSQL (Supabase, via PgBouncer pooler on port 6543)
- **Deployment:** Docker Compose + Cloudflare Tunnel (callboard.deetalk.win)
- **Tests:** pytest (backend) / Vitest stubs (frontend)

## Project Layout

```
backend/app/         — FastAPI application
backend/tests/       — pytest test suite
frontend/src/        — React SPA
spec/                — 10 specification documents
docker-compose.yml   — Production container orchestration
frontend/nginx.conf  — Nginx reverse proxy config
```

## Running

```bash
# Development (local)
./start.sh           # Both servers
./start-backend.sh   # Backend at :8000
./start-frontend.sh  # Frontend at :5173

# Production (Docker)
docker compose build && docker compose up -d   # App at :8080
cloudflared tunnel run callboard               # Tunnel to callboard.deetalk.win
```

## Key Constraints

- Exactly 3 roles: director, staff, cast
- Cast-to-cast messaging blocked at API level
- Conflicts are immutable after submission (DB UNIQUE constraint)
- Age gate at 13+ (COPPA) — raw DOB never stored
- 90-day PII deletion after production archival
- All API errors return `{"error": "CODE", "message": "..."}`
- PgBouncer requires `statement_cache_size=0` in asyncpg connection
- Error boundary wraps all page content — crashes show "Something went wrong" not black screen
- Guided tour system (react-joyride v3) for onboarding — different flows for director vs staff vs cast
- Tour styles defined in `frontend/src/tours/tourStyles.ts` — theater-themed tooltips with Playfair titles, gold buttons
- Tour close button uses `closeButtonAction: 'skip'` (v3 quirk — 'close' doesn't fire tour:end)
- Tour IDs must not depend on async data (userRole) until it's resolved — guard with `{userRole && <PageTour />}`
- Conflicts use two-step input: weekly pattern picker first (bulk), then specific dates (fine-tune)
- Invite landing page (`/join`) fetches production name from token and displays it

## UI Theme

Theater backstage aesthetic: dark background, green chalkboard content area, wooden frame, curtain animations, flight-case side panels, gaffer tape schedule indicators, sticky note bulletin posts. No light mode.
