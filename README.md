# Digital Call Board

A web app replacing the physical backstage call board for theater productions. Directors create productions, build rehearsal schedules, and manage cast. Cast members join via invite link, submit scheduling conflicts, and communicate with staff.

**Live:** [callboard.deetalk.win](https://callboard.deetalk.win)

## Quick Start

```bash
# Start both servers (backend + frontend)
./start.sh

# Or start them separately:
./start-backend.sh   # http://localhost:8000
./start-frontend.sh  # http://localhost:5173
```

The backend auto-creates a virtual environment and installs dependencies on first run. The frontend auto-runs `npm install` if needed.

## Production Deployment

```bash
# Build and run Docker containers
docker compose build && docker compose up -d   # App at localhost:8080

# Start Cloudflare Tunnel
cloudflared tunnel run callboard               # Routes to callboard.deetalk.win
```

Requires `.env.production` (gitignored) with database URL, JWT secret, and OAuth credentials. See `.env` for the template.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 6, TypeScript, Tailwind CSS 4, framer-motion |
| Backend | Python, FastAPI, SQLAlchemy (async), JWT auth |
| Database | PostgreSQL (Supabase, PgBouncer pooler) |
| Auth | Google OAuth 2.0 + email/password (bcrypt) |
| Deployment | Docker Compose, nginx, Cloudflare Tunnel |

## Project Structure

```text
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app + middleware (CORS, CSRF, rate limit)
│   │   ├── config.py            # Environment settings
│   │   ├── database.py          # SQLAlchemy async engine (PgBouncer compatible)
│   │   ├── models.py            # All database models
│   │   ├── routers/             # API endpoints
│   │   └── services/            # Business logic
│   ├── tests/                   # pytest suite
│   ├── seed_data.py             # Seed: Into the Woods (12 cast)
│   ├── seed_admin.py            # Seed: Phantom of the Opera (50 cast)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/               # 20 route pages
│   │   ├── components/          # UI components + theater layouts
│   │   ├── services/            # API client modules
│   │   ├── hooks/               # useAuth, useApi, useTour, useBreakpoint
│   │   ├── tours/               # Guided tour step definitions
│   │   ├── types/               # TypeScript interfaces
│   │   └── utils/               # Validation, formatting
│   ├── tests/                   # Vitest test stubs
│   ├── nginx.conf               # Production reverse proxy
│   ├── Dockerfile               # Multi-stage build (node + nginx)
│   └── package.json
├── spec/                        # 10 specification documents
├── docker-compose.yml           # Production orchestration
├── .env.production              # Production secrets (gitignored)
├── start.sh                     # Start both dev servers
├── start-backend.sh             # Start backend only
└── start-frontend.sh            # Start frontend only
```

## User Roles

| Role | How Assigned | Capabilities |
|------|-------------|-------------|
| **Director** | Creates account + production | Full control: schedule, bulletin, roster, chat, archive |
| **Staff** | Promoted from Cast by Director | Post to bulletin, edit schedule, chat with anyone, view conflicts |
| **Cast** | Joins via invite link | View bulletin/schedule, submit conflicts (once), chat with Director/Staff only |

## Key Features

- **Schedule Builder** — Weekly pattern toolbar generates rehearsal calendar. Click to override individual dates. Conflict counts and cast assignments visible per day.
- **Conflict Submission** — Cast marks unavailable dates once. Director sees aggregated conflict view with severity badges.
- **Bulletin Board** — Sticky note posts on the chalkboard with pinning, role-based editing.
- **Role-Based Chat** — 1-on-1 messaging. Cast-to-cast blocked at API level. Director can moderate any conversation.
- **Invite Links** — Single link per production, 30-day expiry, max 100 uses. Cast routed to conflict submission on join.
- **Production Archival** — Read-only mode with 90-day PII deletion.
- **Guided Tours** — react-joyride onboarding for directors (7 steps) and cast (3 steps). "Take Tour" button always available.
- **Error Boundary** — Page crashes show a "Something went wrong" message with retry, not a blank screen.

## UI Theme

Theater backstage aesthetic: dark background, green chalkboard content area, wooden frame with nails, curtain open/close animations, flight-case side panels with rivets, gaffer tape schedule indicators, sticky note bulletin posts, spotlight effects. Dark mode only.

## API Documentation

With the backend running, visit [http://localhost:8000/docs](http://localhost:8000/docs) for interactive Swagger docs.

## Development

### Backend

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn app.main:app --reload
```

Run tests:
```bash
cd backend && .venv/bin/python3 -m pytest tests/ -v
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Seed Data

```bash
docker compose exec backend python3 seed_data.py    # Into the Woods
docker compose exec backend python3 seed_admin.py   # Phantom of the Opera
```

## Environment Variables

Copy `.env` template and configure:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (Supabase pooler, port 6543) |
| `NEXTAUTH_SECRET` | JWT signing secret (min 32 chars) |
| `NEXTAUTH_URL` | Production URL (e.g. https://callboard.deetalk.win) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |

## Specifications

Detailed specs in `spec/`:

| Spec | Topic |
|------|-------|
| SPEC-001 | Product overview and user roles |
| SPEC-002 | Authentication and authorization |
| SPEC-003 | Director flow |
| SPEC-004 | Cast flow |
| SPEC-005 | Chat system |
| SPEC-006 | Schedule and conflict management |
| SPEC-007 | Infrastructure and deployment |
| SPEC-008 | TDD strategy |
| SPEC-009 | Frontend architecture and design system |
| SPEC-010 | Pages and screens |
