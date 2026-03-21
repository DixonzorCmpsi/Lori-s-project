# Digital Call Board

A web application that replaces the physical backstage call board used in theater productions. Directors create productions, build rehearsal schedules, and share a single invite link. Cast members join, submit their conflicts, and stay informed through a bulletin board and direct messaging -- all from their phone or computer.

---

## Why

Theater productions rely on a physical call board posted backstage for schedules, announcements, and cast lists. This system is unreliable. Members miss updates. Information gets buried. There is no way to communicate schedule conflicts before they become a problem.

No digital equivalent exists. No known competitors serve this exact workflow. Digital Call Board fills that gap for high school theater programs and above.

## What

Digital Call Board is a production management tool built around three user roles:

- **Director** -- the production owner. Creates a theater, sets up a production, builds the rehearsal schedule through a guided wizard, posts announcements, manages the roster, and communicates with the entire cast.
- **Staff** -- elevated cast members. Promoted by the Director to help manage the production. Can post announcements, view all conflicts, and chat with anyone. Cannot delete the production or manage roles.
- **Cast** -- everyone who joins via the invite link. Sets up a profile, submits conflicts one time (immutable after submission), views the bulletin board and personal schedule, and messages the Director or Staff directly.

There is one invite link per production. Everyone enters as Cast. The Director promotes individuals to Staff as needed. There are no separate invite paths, no access codes, and no QR codes.

### Core Features

- **Schedule Builder** -- a 7-question wizard that generates a deterministic rehearsal calendar. Supports regular rehearsals, tech week, dress rehearsals, blocked dates, and performance nights.
- **One-Time Conflict Submission** -- cast members select the dates they are unavailable. Submission is all-or-nothing and cannot be edited after the fact. The Director sees an aggregated conflict view overlaid on the schedule.
- **Bulletin Board** -- a two-tab view (Posters and Schedule) where the Director and Staff post Markdown announcements. Styled as paper cards pinned to a cork board.
- **Role-Based Chat** -- 1-on-1 direct messages with strict boundaries. Cast can message the Director and Staff. Cast cannot message other cast members. Enforced at the API level, not just the UI.
- **Production Lifecycle** -- create, manage, archive. Archived productions enter read-only mode. All personally identifiable information is permanently deleted 90 days after archival.

## How

### Architecture

```
Production:
  Browser <-> Vercel Edge Network (HTTPS + CDN)
                  |
            Vercel Serverless Functions (Next.js)
                  |
          +-------+-------+
          |               |
    Supabase DB     Supabase Storage
    (PostgreSQL)    (headshot images)
          |
    Supabase Realtime
    (WebSocket chat)

Development:
  Browser <-> localhost:3000 (Next.js dev server)
                  |
            Docker PostgreSQL (localhost:5432)
            Local filesystem (uploads/)
```

Application code is identical in both environments. Only environment variables change.

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14+ (App Router), TypeScript strict mode |
| Styling | Tailwind CSS, shadcn/ui components |
| Database | PostgreSQL 16 (Supabase in production, Docker in development) |
| ORM | Drizzle (SQL-first, type-safe, no vendor lock-in) |
| Auth | NextAuth.js (Google OAuth + email/password) |
| Realtime | Supabase Realtime (production), ws library (development) |
| File Storage | Supabase Storage (production), local filesystem (development) |
| Email | Nodemailer over SMTP |
| Hosting | Vercel (auto-deploy from GitHub) |
| DNS | Cloudflare (pointing custom domain to Vercel) |

### System Design Patterns

**Server-first rendering.** React Server Components handle data fetching. Client components are used only where interactivity is required (forms, chat, calendar). This minimizes client-side JavaScript and keeps sensitive logic on the server.

**Drizzle ORM over raw SQL and Supabase JS client.** All database queries go through Drizzle. The Supabase JS client (`@supabase/supabase-js`) is never used for data access. This keeps the application portable -- switching from Supabase to any other PostgreSQL host requires only changing the connection string.

**Environment-aware providers.** Storage and realtime are abstracted behind environment variables (`STORAGE_PROVIDER`, `NEXT_PUBLIC_REALTIME_PROVIDER`). In production, they resolve to Supabase Storage and Supabase Realtime. In development, they resolve to the local filesystem and the `ws` WebSocket library. No code changes required.

**Database-level enforcement.** Business rules are enforced at the database level, not just in application code. One-time conflict submission uses a UNIQUE constraint on `(production_id, user_id)`. Role permissions are checked via RBAC middleware on every protected route. Text field max lengths are enforced by CHECK constraints. Date ordering (`first_rehearsal <= opening_night <= closing_night`) is enforced by CHECK constraints.

**Deterministic schedule generation.** The schedule wizard is a pure function. Given the same 7 inputs (rehearsal days, start time, end time, blocked dates, tech week toggle, tech week length, dress rehearsal toggle), it produces byte-identical output every time.

**Immutable conflict submission.** Cast members submit all their conflicts in a single database transaction. No partial saves. No edits after submission. The Director can reset a member's conflicts if needed, allowing them to resubmit.

**PII lifecycle management.** Raw date of birth is used only for the age gate check and then discarded -- only the derived age range ("13-17" or "18+") is stored. When a production is archived, a pg_cron job permanently deletes all associated PII (profiles, conflicts, chat messages) after exactly 90 days.

**Self-hosted fallback.** The entire application can run without managed services. Set `STORAGE_PROVIDER=local` and `NEXT_PUBLIC_REALTIME_PROVIDER=ws`, point `DATABASE_URL` at a local PostgreSQL instance, and add a Cloudflare Tunnel for public access. No application code changes required.

### Security Model

- Google OAuth 2.0 with PKCE and state parameter validation
- Email/password auth with bcrypt (cost factor 12) and breached password checking
- 256-bit cryptographically random session tokens stored server-side
- RBAC middleware on every protected route: authenticate, verify membership, verify role
- Cast-to-cast messaging blocked at the API level
- Anti-enumeration: identical responses for "email not found" and "wrong password"
- Account lockout after 10 failed attempts (30-minute lock)
- Rate limiting on login, registration, chat, and email endpoints
- HTTP security headers (CSP, HSTS, X-Frame-Options) on all responses
- COPPA compliance: users under 13 are blocked at registration

### Design System

The visual identity is "backstage at a theater." Dark wood panels, cork bulletin boards, amber work lights. Dark theme only -- no light mode.

- **Backgrounds:** warm dark tones (HSL hue 25-40), not cold blue or gray
- **Surfaces:** wood-panel texture via CSS gradients (no image assets)
- **Bulletin posts:** paper cards pinned to a cork board with slight rotation and drop shadows
- **Accent color:** amber work light (`hsl(38, 75%, 55%)`)
- **Headings:** Playfair Display serif (theater program feel)
- **Body text:** Libre Franklin sans-serif
- **Schedule dates:** JetBrains Mono monospace (call sheet feel)
- **Components:** shadcn/ui exclusively, styled with Tailwind CSS
- **Accessibility:** WCAG AA compliant, 4.5:1 minimum contrast, 44x44px touch targets, keyboard-navigable

---

## Goal

Ship a focused v1 that serves a single Director managing a single production with up to 100 cast members. Every page loads within 2 seconds. The app is fully usable on a phone. A Director can go from account creation to a shared invite link in under 10 minutes. A cast member can join, set up their profile, and submit conflicts in under 5 minutes.

This is not a SaaS platform. It is a tool built for one specific workflow that has no digital equivalent.

---

## Getting Started

### Prerequisites

- Node.js 18+
- Docker (for local PostgreSQL)
- A Google OAuth client ID and secret (for auth)

### Local Development

```bash
git clone <repo-url>
cd digital-call-board
cp .env.example .env.local       # Fill in local values
docker compose up db -d            # Start PostgreSQL
npm install                        # Install dependencies
npm run db:push                    # Push schema to local DB
npm run dev                        # Start at localhost:3000
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (pooler, port 6543 for production) |
| `DATABASE_URL_DIRECT` | PostgreSQL direct connection (port 5432, for migrations) |
| `NEXTAUTH_SECRET` | Session encryption key (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | Public URL (`http://localhost:3000` in dev) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Supabase public key (for Realtime client auth) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service key (server-side only) |
| `STORAGE_PROVIDER` | `supabase` (production) or `local` (development) |
| `NEXT_PUBLIC_REALTIME_PROVIDER` | `supabase` (production) or `ws` (development) |
| `SMTP_HOST` | SMTP server for transactional emails |
| `SMTP_PORT` | SMTP port (587 for TLS) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASSWORD` | SMTP password |
| `EMAIL_FROM` | From address for transactional emails |

### Production Deployment

1. Import the GitHub repo into Vercel
2. Set environment variables in the Vercel dashboard
3. Point your custom domain to Vercel via Cloudflare DNS (CNAME to `cname.vercel-dns.com`)
4. Push to `main` -- Vercel auto-deploys

---

## Project Structure

```
spec/               Specifications (source of truth)
src/
  app/
    (auth)/         Login, register, password reset, email verification
    (join)/         Invite link handler
    (dashboard)/    Authenticated pages (production, schedule, bulletin, chat)
    api/            API routes
  components/
    ui/             shadcn/ui primitives
    layout/         Sidebar, header, mobile nav
    auth/           Login form, Google button, age gate
    production/     Schedule, conflicts, bulletin, roster
    chat/           Conversations, messages, input
  lib/              Auth config, DB client, validators, permissions
  styles/           Global CSS and theme tokens
tests/
  unit/             Unit tests
  integration/      Integration tests (real PostgreSQL)
  security/         Security tests
```

---

## Specifications

All behavior is defined in the `spec/` directory. Specs are the source of truth. If the code contradicts a spec, the code is wrong.

| Spec | Covers |
|------|--------|
| SPEC-001 | Product overview, user roles, data privacy |
| SPEC-002 | Authentication, authorization, RBAC |
| SPEC-003 | Director flow, theater/production CRUD, schedule wizard, bulletin board |
| SPEC-004 | Cast flow, profile setup, conflict submission |
| SPEC-005 | Chat system, WebSocket, role-based messaging |
| SPEC-006 | Schedule generation algorithm, conflict aggregation |
| SPEC-007 | Infrastructure, deployment, environment config |
| SPEC-008 | TDD strategy and test organization |
| SPEC-009 | Frontend architecture, design system, accessibility |
| SPEC-010 | Page-by-page wireframes and screen definitions |

---

## License

Private. All rights reserved.
