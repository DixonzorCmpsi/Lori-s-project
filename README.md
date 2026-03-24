# Digital Call Board

A web app replacing the physical backstage call board for theater productions. Directors create productions, build rehearsal schedules, and manage cast. Cast members join via invite link, submit scheduling conflicts, and communicate with staff.

## Quick Start

```bash
# Start both servers (backend + frontend)
./start.sh

# Or start them separately:
./start-backend.sh   # http://localhost:8000
./start-frontend.sh  # http://localhost:5173
```

The backend auto-creates a virtual environment and installs dependencies on first run. The frontend auto-runs `npm install` if needed.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 6, TypeScript, Tailwind CSS 4 |
| Backend | Python, FastAPI, SQLAlchemy (async), JWT auth |
| Database | PostgreSQL (Supabase prod) / SQLite (dev) |
| Auth | Google OAuth 2.0 + email/password (bcrypt) |

## Project Structure

```text
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app + middleware
│   │   ├── config.py            # Environment settings
│   │   ├── database.py          # SQLAlchemy engine
│   │   ├── models.py            # All database models
│   │   ├── routers/             # API endpoints
│   │   └── services/            # Business logic
│   ├── tests/                   # pytest suite (361 passing)
│   ├── requirements.txt
│   └── pyproject.toml
├── frontend/
│   ├── src/
│   │   ├── pages/               # 19 route pages
│   │   ├── components/          # UI components + layouts
│   │   ├── services/            # API client modules
│   │   ├── contexts/            # Auth context
│   │   ├── hooks/               # useAuth, useApi, useForm
│   │   ├── types/               # TypeScript interfaces
│   │   └── utils/               # Validation, formatting
│   ├── tests/                   # Vitest test stubs
│   ├── package.json
│   └── vite.config.ts
├── spec/                        # 10 specification documents
├── start.sh                     # Start both servers
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

- **Schedule Builder** — 7-question wizard generates a rehearsal calendar with tech week, dress rehearsal, and performance dates
- **Conflict Submission** — Cast marks unavailable dates once; Director sees aggregated view with severity badges
- **Bulletin Board** — Markdown posts with pinning, role-based editing, XSS sanitization
- **Role-Based Chat** — 1-on-1 messaging; cast-to-cast blocked at API level
- **Invite Links** — Single link per production, 30-day expiry, max 100 uses
- **Production Archival** — Read-only mode with 90-day PII deletion

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
cd backend
DATABASE_URL="sqlite+aiosqlite:///:memory:" .venv/bin/python3 -m pytest tests/ -v
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | JWT signing secret (min 32 chars) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `SMTP_HOST` | Email server for verification/reset emails |

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
