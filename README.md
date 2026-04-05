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
| Email | Resend (transactional emails) |
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
│   │   │   ├── auth.py          # Registration, login, OAuth, account management
│   │   │   ├── productions.py   # CRUD + archive/unarchive + extend
│   │   │   ├── schedule.py      # Rehearsal dates + bulk sync
│   │   │   ├── bulletin.py      # Posts + email notifications
│   │   │   ├── members.py       # Roster + promote/demote/block/unblock
│   │   │   ├── chat.py          # Messages + broadcast + team contacts
│   │   │   ├── conflicts.py     # Submission windows + status
│   │   │   ├── teams.py         # Team CRUD + member assignment
│   │   │   └── join.py          # Invite link join (with block check)
│   │   └── services/
│   │       ├── business_logic.py # Permissions, validation, schedule generation
│   │       ├── email.py         # Resend integration + HTML templates
│   │       └── audit.py         # COPPA audit logging
│   ├── tests/                   # pytest suite
│   ├── seed_data.py             # Seed: Into the Woods (12 cast)
│   ├── seed_admin.py            # Seed: Phantom of the Opera (50 cast)
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── pages/               # 20+ route pages
│   │   ├── components/          # UI components + theater layouts
│   │   ├── services/            # API client modules
│   │   ├── hooks/               # useAuth, useApi, useTour, useBreakpoint, useTheme
│   │   ├── contexts/            # AuthContext, ThemeContext
│   │   ├── tours/               # Guided tour step definitions + responsive styles
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
| **Director** | Creates account + production | Full control: schedule, bulletin, roster, teams, chat, settings, block/ban, archive |
| **Staff** | Promoted from Cast by Director | Post to bulletin, edit schedule, manage teams, chat with anyone, view conflicts |
| **Cast** | Joins via invite link | View bulletin/schedule, submit conflicts, chat with Director/Staff/teammates |

## Key Features

- **Schedule Builder** — Weekly pattern toolbar generates rehearsal calendar. Click to override individual dates. Conflict counts and cast assignments visible per day. Assign by individual or by team (collapsed groups with bulk assign/remove).
- **Conflict Submission** — Two-step: weekly pattern picker, then specific date fine-tuning. Windowed system: 1 initial + N extra submissions (director-configurable globally or per-member).
- **Teams** — Create groups (dancers, actors, ensemble). Click-to-cycle assignment with batch save. Cast in same team can message each other. Team-based schedule assignment. Message or announcement broadcast to teams.
- **Bulletin Board** — Sticky note posts on the chalkboard with pinning, role-based editing. Email notifications to opted-in members.
- **Chat** — 1-on-1 messaging. Cast-to-cast allowed within teams. Director can broadcast to teams or all cast. Conversations grouped by team. Message vs Announcement toggle. No message deletion (audit trail).
- **Invite Links** — Single link per production, 30-day expiry, max 100 uses. Blocked users cannot rejoin.
- **Block/Ban** — Director blocks members (removed + cannot rejoin via invite). Blocked list with unblock option.
- **Email Notifications** — Resend integration for announcements, team messages, conflict reminders, invite links. Per-user opt-out toggle.
- **Emergency Contacts** — 2 contacts per user (1 required for minors). Name, email, phone, relationship (Parent/Guardian/Spouse/Sibling/Other).
- **COPPA Compliance** — Age gate 13+, age range stored (never raw DOB), parental consent for minors, audit logging for all data actions, 90-day PII deletion.
- **Production Lifecycle** — Expiry prompt when closing night passes (extend or archive). Archiving sets read-only + deactivates invites.
- **Dark/Light Mode** — Theme toggle with localStorage persistence. Blackboard stays dark in both modes (bright room aesthetic in light mode).
- **Guided Tours** — react-joyride onboarding: directors (7 steps), staff (5 steps), cast (4 steps). Page-level tours for every section. Responsive tooltips. "Take Tour" button always available.
- **Responsive Design** — Mobile bottom nav, tablet drawer, desktop 3-column. Compact calendar on mobile. Responsive dialogs, tour tooltips, and grids.
- **Error Boundary** — Page crashes show "Something went wrong" with retry, not blank screen.
- **Profile Completion** — Google OAuth users prompted for DOB. "No age" badge on roster for incomplete profiles. "Complete your profile" banner.

## UI Theme

Theater backstage aesthetic with dark/light mode. Dark mode: green chalkboard content area, wooden frame with nails, flight-case side panels with rivets, gold accents. Light mode: blackboard stays dark, warm cream panels, brown wood frame. Curtain open/close animations, gaffer tape schedule indicators, sticky note bulletin posts, spotlight effects, pelmet with gold fringe.

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
| `RESEND_API_KEY` | Resend API key for email notifications (optional — logs only without it) |

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
