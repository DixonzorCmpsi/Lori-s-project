# Digital Call Board — Agent Rules

## Stack

- **Backend:** Python 3.11+ / FastAPI / SQLAlchemy async / JWT auth / Resend (email)
- **Frontend:** React 19 / Vite 6 / TypeScript / Tailwind CSS 4 / framer-motion
- **Database:** PostgreSQL (Supabase, via PgBouncer pooler on port 6543)
- **Deployment:** Docker Compose + Cloudflare Tunnel (callboard.deetalk.win)
- **Tests:** pytest (backend) / Vitest stubs (frontend)

## Project Layout

```
backend/app/            — FastAPI application
backend/app/routers/    — API endpoints (auth, productions, schedule, bulletin, members, chat, conflicts, teams, join, etc.)
backend/app/services/   — Business logic, email service (Resend), audit logging
backend/tests/          — pytest test suite
frontend/src/pages/     — Route pages (20+)
frontend/src/components/theater/ — Theater-themed layout components
frontend/src/tours/     — Guided tour definitions + styles
frontend/src/contexts/  — AuthContext, ThemeContext
frontend/src/services/  — API client modules
spec/                   — 10 specification documents
docker-compose.yml      — Production container orchestration
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

- Exactly 3 base roles: director, staff, cast
- Cast-to-cast messaging blocked UNLESS they share a team
- Conflict windows: 1 initial + N extra (set by director globally or per-member)
- Conflicts immutable after submission — director can reset via member endpoint
- Age gate at 13+ (COPPA) — raw DOB never stored, only age_range ("13-17" or "18+")
- Emergency contacts: 2 slots (1 required for minors, 1 optional)
- 90-day PII deletion after production archival
- All API errors return `{"error": "CODE", "message": "..."}`
- PgBouncer requires `statement_cache_size=0` in asyncpg connection
- Error boundary wraps all page content
- Block/ban: director can block members — blocked users cannot rejoin via invite

## Tour System

- react-joyride v3 with dynamically themed tooltips (dark/light)
- Close button uses `closeButtonAction: 'skip'` (v3 quirk)
- Tour IDs guarded: `{userRole && <PageTour />}`
- Responsive: smaller padding/font on mobile (<640px)
- Production tour: 7 steps (director), 5 steps (staff), 4 steps (cast)
- Page tours: dashboard, schedule (staff/cast), bulletin (staff/cast), chat, roster, teams, settings, conflicts

## Teams System

- Directors/staff create teams, assign cast via click-to-cycle (optimistic + batch save)
- 8 distinct team colors
- Teams tab in Members page (Roster | Manage)
- Team-based schedule assignment (collapsed groups, bulk assign/remove)
- Cast in same team can message each other
- Broadcast to teams (message or announcement) from Manage tab

## Conflict Windows

- Production-level `extra_conflict_windows` (default 0)
- Per-member override (nullable — falls back to production default)
- `GET /conflicts/status` returns remaining windows
- Dashboard button shows count or greys out at 0

## Email Notifications (Resend)

- Templates: invite, announcement, team message, conflict reminder, verification, password reset
- `RESEND_API_KEY` env var activates real sending — without it, logged only
- `email_from`: noreply@callboard.deetalk.win
- Users toggle `email_notifications` in Account settings
- Bulletin posts with `notify_members=true` email opted-in members

## COPPA Compliance

- Age gate: 13+ at registration, age_range stored (never raw DOB)
- Google OAuth users prompted for DOB on Account page if age_range is null
- Emergency contacts: 2 slots (name, email, phone, relationship)
- Parental consent recorded for minors (13-17)
- AuditLog tracks: register, login, password changes, profile updates, consent, deletions
- Profile completion signals: "No age" badge on roster, "Complete your profile" banner

## Block/Ban

- Director-only, cannot block yourself or another director
- Blocked = removed + cannot rejoin via invite
- Blocked list with unblock on Roster page

## Production Lifecycle

- Expiry banner when closing_night passes (extend or archive)
- Director extends closing_night or archives
- Archiving deactivates invites + sets read-only

## UI Theme

- Dark/light mode toggle (ThemeProvider + localStorage)
- Dark: green chalkboard, dark panels, gold accents
- Light: blackboard stays dark (bright room), warm cream panels, wood frame
- 60+ CSS custom properties in `:root` (dark) and `.light`
- Chalkboard uses `--t-chalk-surface`, `--t-chalk-text`, `--t-wood-frame`

## Responsive Design

- 3 breakpoints: mobile (<768px), tablet (768-1023px), desktop (≥1024px)
- Mobile: bottom nav, drawer for cast panel, compact calendar (no times in notes)
- Tablet: left panel + drawer for right panel
- Desktop: 3-column layout with draggable panel widths
- Dialogs: `w-[calc(100vw-2rem)]` mobile, `max-w-md` desktop
- Tour tooltips: responsive padding/font/maxWidth on <640px
- Content: `pb-20` mobile for bottom nav clearance
- Safe area inset bottom on mobile nav

## Chat System

- 1-on-1 messaging, cast can message teammates + staff/director
- Conversations grouped by team (collapsed in chat list)
- New message: Teams section, Staff, Individual Cast
- Message vs Announcement toggle in Manage tab
- No message deletion (audit trail)
- Actual timestamps (not relative)

## Rehearsal Operations (see spec/SPEC-012)

- Acknowledgements: bulletin posts can require "I've read this"; staff see who is pending and can remind (email)
- Call sheet: who is called (explicit assignments, else full cast), check-in, late/absent notices, attendance report
- Personal calendar feed: secret `.ics` link per member (`/api/calendar/{token}.ics`), reset to revoke
- Rehearsal reports: department sections, distribution list, recipients confirm
- Scenes with casting and per-date availability; open-call sign-ups; double-booking detection (rooms, people, sign-ups)
- Documents (files, 10 MB, allow-listed types) and e-signed forms (typed name, guardian for 13-17, immutable once signed)
- Help in plain language: every page has a role-specific "How this page works" box (`frontend/src/content/guides.ts`, `PageGuide`), plus a Help page with a permission table and glossary. Edit words in `guides.ts`, not in pages
- The "How this page works" box folds to its small link while a tour is running or due to start (`hooks/tourSignal.ts`), then slides back open; tours that have nothing on screen end themselves. Keep any new tour or guide wired through those hooks so the two never overlap
- Tours (`frontend/src/tours/`): bump `TOUR_VERSION` in `hooks/useTour.ts` when tour content changes so everyone sees the update once; steps whose target is not on screen are skipped
- Documents open in a pop-up viewer (`DocumentViewer`): PDF, Word (.docx), Excel (.xlsx), CSV, Markdown, text, images, audio, video; other types download
- Backend routers use `Depends(get_db)` and `user["id"]` (never `user["sub"]`); shared checks live in `services/access.py`
- Page colours in inline styles use `rgb(var(--c-R-G-B) / a)` / `hsl(var(--h-H-S-L))`; run `frontend/scripts/gen_color_vars.py` after adding a new colour

## Simple theme (internal key `calendar`)

- Simple is the default for new users; the old "Default" look is now named "Classic" (stored key still `default`)
- Third style, shown as "Simple" (Account > Appearance); the stored key and CSS class stay `calendar`: Default layout rules plus a top navigation bar (group tabs with a sub-row of pages) and a "road to opening" phase bar on Dashboard and Schedule
- `ThemeContext`: `uiStyle` stays `'default' | 'fancy'` (calendar counts as default); `isCalendar` is the extra flag; html gets `ui-default ui-calendar`
- Phases come from the production dates and the types of scheduled calls (rehearsal, tech, dress, performance): `components/layout/PhaseBar.tsx`
- Teal accent channels are overridden after the generated colour-vars block in `index.css`

## Hosted copy (Google Cloud VM)

- Project `digital-call-board`, VM `callboard-vm` (e2-micro, us-central1-a), static IP `callboard-ip`; site at `https://34-171-7-85.sslip.io` (Caddy gets a free certificate; swap `SITE_ADDRESS` in `/opt/callboard/.env` when a real domain exists)
- Containers: `docker-compose.vm.yml` (db, backend, frontend, caddy). Images are built locally and copied up; secrets live only in `/opt/callboard/.env` on the VM
- Google sign-in: the browser sends Google's signed ID token and the backend checks it with Google (`verify_google_credential`); it never trusts an email or ID sent on its own. Needs `GOOGLE_CLIENT_ID` on the VM and `VITE_GOOGLE_CLIENT_ID` as a frontend build arg; no client secret is used

## Navigation

- Director/staff: Dashboard; Rehearse (Schedule, Call Sheet, Scenes, Reports); Communicate (Bulletin, Chat); Company (Members, Sign-ups, Documents); Production (Settings)
- Cast: Dashboard, Bulletin, Schedule, Call Sheet, Chat, Sign-ups, Documents
- Phones: four pages plus a "More" sheet
- Members page: Roster | Manage tabs
- "← Productions" back button in sidebar
- Account page: one section at a time via a pill menu (Classic and Simple); Fancy keeps the long page
- Account page within production context (`/production/:id/account`)
- Member count persists across tabs
