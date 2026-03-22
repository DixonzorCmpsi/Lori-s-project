# SPEC-007: Infrastructure & Deployment

**Status:** Draft
**Last Updated:** 2026-03-21
**Depends On:** SPEC-002

---

## Goals (Immutable)

- Development environment uses Docker PostgreSQL + npm run dev (zero cloud dependency for local work)
- Production uses Supabase (hosted PostgreSQL, Storage, Realtime) + Vercel (Next.js hosting)
- All database queries use Drizzle ORM against standard PostgreSQL — no Supabase JS client for data access
- File uploads use Supabase Storage REST API in production, local filesystem in development
- Auto-deploy from GitHub: push to main triggers Vercel build and deploy
- Supabase handles database backups automatically (daily, point-in-time recovery on Pro plan)
- Code is portable: can fall back to fully self-hosted Docker + Cloudflare Tunnel without code changes (only env vars change)

## Non-Goals (Explicit Exclusions)

- Kubernetes or container orchestration
- Self-managed servers in production (Supabase and Vercel handle this)
- Supabase JS client (`@supabase/supabase-js`) for database queries — Drizzle ORM only
- Redis or in-memory cache
- Multi-region deployment
- Custom CI/CD pipeline beyond Vercel's built-in GitHub integration

## Success Metric

A developer can clone the repo, run `docker compose up db -d && npm run dev`, and have the full app running locally in under 5 minutes. Production deployment is a `git push` to main — Vercel auto-deploys within 2 minutes.

## Immutable Constraints

- Database queries MUST use Drizzle ORM only. No `supabase.from('table')` calls in application code
- File uploads use Supabase Storage REST API (with service role key). Files are never stored in the database
- NEXTAUTH_SECRET minimum 32 bytes of cryptographic randomness
- `.env` file NEVER committed to git
- All environment variables for production are set in Vercel dashboard, not in code
- Supabase database connection uses connection pooler URL (port 6543) in production for serverless compatibility

---

## 1. Overview

| Environment | Database | App Hosting | File Storage | Realtime |
|------------|----------|-------------|-------------|----------|
| Development | Docker PostgreSQL (local) | `npm run dev` (localhost:3000) | Local filesystem (`uploads/`) | `ws` library (local WebSocket server) |
| Production | Supabase PostgreSQL | Vercel (serverless) | Supabase Storage | Supabase Realtime |

Application code is identical in both environments. Only environment variables change.

## 2. Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Next.js 14+ (App Router) | SSR, file-based routing, server actions |
| Backend | Next.js API routes + server actions | Co-located with frontend |
| Database | PostgreSQL 16 (Supabase in prod, Docker in dev) | Standard SQL, no vendor lock-in |
| ORM | Drizzle | SQL-first, type-safe, works with any PostgreSQL |
| Auth | NextAuth.js (Auth.js) | Google OAuth + credentials provider |
| Realtime | Supabase Realtime (prod) / ws (dev) | Chat message delivery |
| File Storage | Supabase Storage (prod) / local fs (dev) | Headshot uploads |
| Styling | Tailwind CSS | Dark theme, utility-first |
| Email | Nodemailer + SMTP | Transactional emails |
| Hosting | Vercel | Auto-deploy from GitHub, serverless, edge network |
| CI/CD | Vercel + GitHub integration | Build on push, preview deploys on PRs |
| DNS | Cloudflare (DNS only, no tunnel) | Point custom domain to Vercel |

## 3. Architecture Diagram

```text
Development:
  Browser <-> localhost:3000 (Next.js dev server)
                  |
            Docker PostgreSQL (localhost:5432)
            Local filesystem (uploads/)

Production:
  Browser <-> Vercel Edge Network (HTTPS + CDN)
                  |
            Vercel Serverless Functions (Next.js)
                  |
          +-------+-------+
          |               |
    Supabase DB     Supabase Storage
    (PostgreSQL)    (S3-compatible)
          |
    Supabase Realtime
    (WebSocket channels)
```

## 4. Development Environment

### 4.1 Docker Compose (Dev Only)

```yaml
# docker-compose.yml — local development only
services:
  db:
    image: postgres:16.6-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_USER: callboard
      POSTGRES_PASSWORD: callboard_dev
      POSTGRES_DB: callboard
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U callboard"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

### 4.2 Local Development Workflow

```bash
# First time setup
git clone <repo>
cp .env.example .env.local     # Fill in local values
docker compose up db -d         # Start PostgreSQL
npm install                     # Install dependencies
npm run db:push                 # Push Drizzle schema to local DB
npm run dev                     # Start Next.js at localhost:3000
```

### 4.3 Environment Files

- `.env.example` — Committed to git. Contains placeholder values and documentation for every variable
- `.env` — NOT committed. Contains production/Supabase credentials (API keys, OAuth secrets). Loaded by Next.js but overridden by `.env.local` for local dev
- `.env.local` — NOT committed. Contains local dev overrides: Docker PostgreSQL `DATABASE_URL`, local `NEXTAUTH_URL`, `STORAGE_PROVIDER=local`, `NEXT_PUBLIC_REALTIME_PROVIDER=ws`. This file MUST exist for local development and MUST override `.env` so that `npm run dev` connects to local Docker PostgreSQL, not production Supabase
- `.env.supabase` — NOT committed. Contains `SUPABASE_ACCESS_TOKEN` for CLI operations only. NOT loaded by Next.js (not a standard Next.js env file name). Used only when running `npx supabase` commands
- `.env.test` — NOT committed. Test-specific overrides (uses `callboard_test` database)
- **Loading order:** Next.js loads `.env` first, then `.env.local` overrides. This means `.env` can safely contain production keys (for reference) as long as `.env.local` overrides `DATABASE_URL` and other connection values for local dev

## 5. Production Environment (Supabase + Vercel)

### 5.1 Supabase Setup

1. Create a Supabase project at supabase.com
2. Note the project URL and keys (anon key, service role key)
3. Database connection strings:
   - **Direct:** `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres` (for migrations)
   - **Pooler:** `postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true` (for application — required for serverless)
4. Enable Supabase Storage (for headshot uploads)
5. Create a storage bucket: `headshots` (private, authenticated access only)
6. Enable Supabase Realtime (for chat WebSocket channels)

### 5.2 Vercel Setup

1. Import the GitHub repo into Vercel
2. Set the framework to Next.js (auto-detected)
3. Configure environment variables in Vercel dashboard (see Section 6)
4. Set custom domain via Cloudflare DNS (CNAME to `cname.vercel-dns.com`)
5. Push to `main` triggers production deployment. PRs get preview deploys.

### 5.3 Supabase Realtime for Chat

In production, the `ws` library cannot maintain persistent WebSocket connections on Vercel's serverless platform. Instead, chat uses **Supabase Realtime channels**:

- Each conversation has a Realtime channel: `conversation:{conversationId}`
- When a message is saved to the database (via Drizzle ORM through a Next.js API route), the API route also broadcasts the message to the Realtime channel
- The client subscribes to relevant channels on the chat page
- Authentication is handled via Supabase Realtime's built-in auth (using the user's session token to verify channel access)

**Development:** In local dev, `NEXT_PUBLIC_REALTIME_PROVIDER` MUST be set to `ws` (default for dev) or `supabase`. When set to `ws`, the app starts a local WebSocket server on port 3001 alongside the Next.js dev server. The `ws` server MUST be started automatically by `npm run dev` via a concurrently script.

### 5.4 Supabase Storage for Uploads

In production, headshot images are stored in Supabase Storage:

- Bucket: `headshots` (private)
- Upload: Server-side via Supabase Storage REST API using the service role key (NOT the anon key, NOT the JS client)
- URL format: `https://[project-ref].supabase.co/storage/v1/object/authenticated/headshots/{uuid}.jpg`
- Serving: Client requests go through a Next.js API route (`GET /api/uploads/[filename]`) which verifies auth + production membership, then proxies the file from Supabase Storage with correct headers
- EXIF stripping and magic byte validation happen server-side BEFORE uploading to Supabase Storage

**Development fallback:** In local dev, files are stored at `./uploads/headshots/` on the local filesystem. The same API route serves them.

The `STORAGE_PROVIDER` env var controls which: `supabase` (prod) or `local` (dev).

## 6. Environment Variables

### 6.1 All Environments

| Variable | Description | Where Set |
|----------|-------------|-----------|
| `DATABASE_URL` | PostgreSQL connection string | `.env.local` (dev), Vercel dashboard (prod) |
| `NEXTAUTH_SECRET` | Session encryption. Min 32 bytes: `openssl rand -base64 32` | `.env.local` (dev), Vercel dashboard (prod) |
| `NEXTAUTH_URL` | Public URL. `http://localhost:3000` (dev), `https://yourdomain.com` (prod) | `.env.local` (dev), Vercel dashboard (prod) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | `.env.local` (dev), Vercel dashboard (prod) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | `.env.local` (dev), Vercel dashboard (prod) |

### 6.2 Email (Both Environments)

| Variable | Description |
|----------|-------------|
| `SMTP_HOST` | SMTP server (e.g., `smtp.resend.com`, `smtp.gmail.com`) |
| `SMTP_PORT` | SMTP port (587 for TLS) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASSWORD` | SMTP password |
| `EMAIL_FROM` | From address (e.g., `noreply@yourdomain.com`) |

### 6.3 Production Only (Vercel Dashboard)

| Variable | Description |
|----------|-------------|
| `SUPABASE_URL` | Supabase project URL (`https://[ref].supabase.co`) |
| `SUPABASE_ANON_KEY` | Supabase anon/public key (for Realtime client auth) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service key (for Storage uploads, server-side only, NEVER exposed to client) |
| `STORAGE_PROVIDER` | `supabase` in production |
| `NEXT_PUBLIC_REALTIME_PROVIDER` | `supabase` in production |

### 6.4 Development Only (.env.local)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | `postgresql://callboard:callboard_dev@localhost:5432/callboard` |
| `STORAGE_PROVIDER` | `local` |
| `NEXT_PUBLIC_REALTIME_PROVIDER` | `ws` or `supabase` (dev's choice) |

## 7. Database Management

### 7.1 Schema & Migrations

- All schema defined in Drizzle schema files (`src/lib/db/schema.ts`)
- Migrations generated via `npx drizzle-kit generate`
- **Local dev:** `npm run db:push` applies schema directly to local Docker PostgreSQL
- **Production:** `npm run db:migrate` runs migrations against Supabase PostgreSQL (using direct connection URL, not pooler)
- Migration files committed to git

### 7.2 Backups

- **Production (Supabase):** Automatic daily backups included in all plans. Pro plan adds point-in-time recovery. No manual backup scripts needed.
- **Local dev:** No backups needed (disposable dev data)

### 7.3 PII Cleanup (90-Day Deletion)

The 90-day PII deletion for archived productions runs as a **Supabase Database Function + pg_cron extension** in production.

The following tables are referenced by the cleanup job (schemas defined in their respective specs):

```sql
-- Cross-references: full schemas in SPEC-003, SPEC-004, SPEC-005
CREATE TABLE productions (id UUID PRIMARY KEY);
CREATE TABLE cast_profiles (id UUID PRIMARY KEY, production_id UUID);
CREATE TABLE cast_conflicts (id UUID PRIMARY KEY, production_id UUID);
CREATE TABLE conflict_submissions (id UUID PRIMARY KEY, production_id UUID);
CREATE TABLE conversations (id UUID PRIMARY KEY, production_id UUID);
CREATE TABLE conversation_participants (id UUID PRIMARY KEY, conversation_id UUID);
CREATE TABLE messages (id UUID PRIMARY KEY, conversation_id UUID);
CREATE TABLE bulletin_posts (id UUID PRIMARY KEY, production_id UUID);
CREATE TABLE invite_tokens (id UUID PRIMARY KEY, production_id UUID);
```

Cleanup job:

```sql
-- Supabase supports pg_cron for scheduled jobs
SELECT cron.schedule(
  'pii-cleanup',
  '0 3 * * *',  -- Daily at 3:00 AM UTC
  $$
    BEGIN;
    WITH expired AS (
      SELECT id FROM productions
      WHERE is_archived = TRUE
      AND archived_at < NOW() - INTERVAL '90 days'
      AND archived_at IS NOT NULL
    )
    DELETE FROM cast_profiles WHERE production_id IN (SELECT id FROM expired);
    DELETE FROM cast_conflicts WHERE production_id IN (SELECT id FROM expired);
    DELETE FROM conflict_submissions WHERE production_id IN (SELECT id FROM expired);
    DELETE FROM messages WHERE conversation_id IN (
      SELECT id FROM conversations WHERE production_id IN (SELECT id FROM expired)
    );
    DELETE FROM conversation_participants WHERE conversation_id IN (
      SELECT id FROM conversations WHERE production_id IN (SELECT id FROM expired)
    );
    DELETE FROM conversations WHERE production_id IN (SELECT id FROM expired);
    DELETE FROM bulletin_posts WHERE production_id IN (SELECT id FROM expired);
    DELETE FROM invite_tokens WHERE production_id IN (SELECT id FROM expired);
    COMMIT;
  $$
);
```

Headshot image cleanup: A separate Supabase Edge Function runs after the SQL cleanup, listing and deleting orphaned files in the `headshots` bucket.

## 8. .gitignore

```text
node_modules/
.next/
.env
.env.local
.env.*.local
uploads/
coverage/
.DS_Store
.vercel/
```

## 9. Monitoring

- **Vercel:** Built-in analytics (requests, errors, performance), accessible from Vercel dashboard
- **Supabase:** Built-in dashboard with database metrics, storage usage, realtime connections
- **Health check:** `GET /api/health` MUST return HTTP 200 with body `{ "status": "ok", "db": "connected" }` when the database is reachable. If the database connection fails, it MUST return HTTP 503 with body `{ "status": "error", "db": "disconnected" }`. The health check MUST execute a `SELECT 1` query with a 3-second timeout to verify database connectivity.
- **Error tracking:** Vercel logs all serverless function errors. Accessible via `vercel logs`

## 10. Logging

### 10.1 Application Logging

- **Format:** Structured JSON logs (`{ timestamp, level, message, ... }`)
- **Levels:** `info`, `warn`, `error`
- **Access:** Vercel Runtime Logs (real-time streaming from dashboard or CLI)
- No separate log rotation needed — Vercel handles log storage

### 10.2 PII Scrubbing

Application logs MUST NOT contain:
- Passwords or password hashes
- Full session tokens or invite tokens (redact to first 8 chars)
- Full email addresses (mask as `d***@example.com`)
- Chat message content (log only message ID)
- Request bodies containing PII

## 11. Self-Hosted Fallback

To move off managed services, the app runs in Docker with these environment variable changes:

1. Set `STORAGE_PROVIDER=local` and `NEXT_PUBLIC_REALTIME_PROVIDER=ws`
2. Set `DATABASE_URL=postgresql://callboard:callboard_dev@db:5432/callboard`
3. Add an `app` service to `docker-compose.yml` that builds the Next.js app and depends on the `db` service
4. Add a `cloudflared` service to `docker-compose.yml` for public HTTPS access via Cloudflare Tunnel
5. Add a `backup` service that runs `pg_dump` daily at 2:00 AM UTC, encrypts with GPG, and writes to a mounted volume
6. Add a cron container that executes the PII cleanup SQL from Section 7.3 daily at 3:00 AM UTC

No application code changes required — only environment variables and docker-compose additions.

## 12. Test Scenarios

| ID | Scenario | Expected Result |
|----|----------|-----------------|
| INFRA-01 | `docker compose up db -d` starts PostgreSQL | Local DB accessible at localhost:5432 |
| INFRA-02 | `npm run dev` connects to local DB | Health check returns db: connected |
| INFRA-03 | Push to main triggers Vercel deploy | Deployment succeeds, site accessible |
| INFRA-04 | App connects to Supabase PostgreSQL in prod | Health check returns db: connected |
| INFRA-05 | File upload works with Supabase Storage | Image stored in headshots bucket, accessible via API |
| INFRA-06 | File upload works with local filesystem in dev | Image stored in uploads/ directory |
| INFRA-07 | Supabase Realtime delivers chat messages | Recipient sees message in real-time |
| INFRA-08 | Migrations run against Supabase | Schema up to date in production |
| INFRA-09 | .env.local not in git | git status shows it ignored |
| INFRA-10 | Application logs do not contain PII | Grep for emails/tokens returns nothing |
| INFRA-11 | PII cleanup job runs on Supabase | Archived production data deleted after 90 days |
| INFRA-12 | Self-hosted fallback works | App runs with Docker + local storage + ws library |
