# IMPACT: Hybrid Infrastructure Migration Analysis

**Date:** 2026-03-21
**Migration:** Fully self-hosted Docker + Cloudflare Tunnel --> Hybrid (Dev: Docker PG + npm run dev, Prod: Supabase + Vercel)
**Portability Principle:** Code uses standard PostgreSQL + Drizzle ORM, NOT Supabase client libraries for data access.

---

## Summary of Changes

| Category | MUST CHANGE | SHOULD UPDATE | NO CHANGE |
|----------|:-----------:|:-------------:|:---------:|
| Docker / docker-compose | 12 | 3 | 0 |
| Cloudflare Tunnel | 10 | 2 | 0 |
| Port exposure / binding | 3 | 1 | 0 |
| Volume mounts / storage | 3 | 0 | 0 |
| File uploads / headshot | 3 | 1 | 0 |
| WebSocket / real-time | 2 | 3 | 0 |
| Backups / pg_dump / GPG | 3 | 0 | 0 |
| Dockerfile / multi-stage | 3 | 1 | 0 |
| Health check endpoint | 0 | 2 | 0 |
| Environment variables | 1 | 3 | 0 |
| SMTP / email | 0 | 1 | 0 |
| PII deletion / cron | 2 | 0 | 0 |
| .gitignore | 0 | 1 | 0 |
| CI/CD / GitHub Actions | 1 | 2 | 0 |
| Cloudflare DNS | 2 | 0 | 0 |

---

## 1. Docker / docker-compose / container

### 1.1 AGENT.md line 11
- **Current text:** `Docker, Cloudflare Tunnel.`  (in Stack description)
- **Impact:** MUST CHANGE
- **New text:** `Docker (dev only), Supabase (prod DB + Storage), Vercel (prod hosting).`
- **Ripple:** Affects SPEC-MANIFEST.xml line 25 (same stack list)

### 1.2 AGENT.md line 116
- **Current text:** `| docker-compose.yml | Infrastructure | SPEC-007 Sec 4.3 |`
- **Impact:** SHOULD UPDATE
- **New text:** `| docker-compose.yml | Local dev infrastructure (PostgreSQL) | SPEC-007 Sec 4.3 |` -- file still exists but is dev-only

### 1.3 AGENT.md line 117
- **Current text:** `| Dockerfile | Container build | SPEC-007 Sec 7.4 |`
- **Impact:** MUST CHANGE
- **New text:** Remove this row. Production uses Vercel builds, not a Dockerfile. A Dockerfile may optionally remain for local Docker-based dev or fallback, but is not the primary deployment artifact.

### 1.4 AGENT.md line 183
- **Current text:** `| 1 | Infrastructure (Docker, DB, Tunnel) | SPEC-007 |`
- **Impact:** MUST CHANGE
- **New text:** `| 1 | Infrastructure (Local dev DB, Supabase project, Vercel project, env config) | SPEC-007 |`

### 1.5 SPEC-MANIFEST.xml line 25
- **Current text:** `<stack>Next.js 14+ App Router, TypeScript strict, Drizzle ORM, PostgreSQL 16, Tailwind CSS, shadcn/ui, ws (WebSocket), NextAuth.js, Docker, Cloudflare Tunnel, Nodemailer (SMTP)</stack>`
- **Impact:** MUST CHANGE
- **New text:** `<stack>Next.js 14+ App Router, TypeScript strict, Drizzle ORM, PostgreSQL 16, Tailwind CSS, shadcn/ui, NextAuth.js, Nodemailer (SMTP), Supabase (prod DB + Storage + Realtime), Vercel (prod hosting), Docker (dev only)</stack>`
- **Ripple:** This is the canonical stack declaration read by all agents.

### 1.6 SPEC-MANIFEST.xml line 228 (SPEC-007 success-metric)
- **Current text:** `docker compose up -d starts all 3 services healthy in 60s. No port accessible from outside except via tunnel. Backups encrypted.`
- **Impact:** MUST CHANGE
- **New text:** `Dev: "docker compose up db -d && npm run dev" starts local dev environment. Prod: Supabase project + Vercel deployment running and healthy. Backups handled by Supabase automated backups.`

### 1.7 SPEC-MANIFEST.xml lines 229-237 (SPEC-007 immutable constraints)
- **Current text:** Lists 8 constraints including "PostgreSQL port NEVER on 0.0.0.0", "All Docker images pinned", "restart: unless-stopped", "Non-root user in Dockerfile"
- **Impact:** MUST CHANGE
- **New text:** Remove/revise Docker-specific constraints. Keep: "NEXTAUTH_SECRET min 32 bytes random", ".env never committed to git". Add: "Code MUST use standard PostgreSQL + Drizzle ORM for data access, NOT Supabase client JS SDK", "Supabase Storage used for file uploads via REST API with service key, not supabase-js for DB queries".

### 1.8 SPEC-MANIFEST.xml line 239 (SPEC-007 non-goals)
- **Current text:** `Kubernetes, multi-host, cloud-managed DB, CI/CD auto-deploy, horizontal scaling, Redis, CDN`
- **Impact:** MUST CHANGE
- **New text:** Remove "cloud-managed DB" and "CI/CD auto-deploy" from non-goals -- these are now goals. Keep: "Kubernetes, multi-host, horizontal scaling, Redis". Add non-goal: "Supabase client JS SDK for database queries (use Drizzle ORM only)".

### 1.9 SPEC-MANIFEST.xml line 244 (Docker Compose section index)
- **Current text:** `<section name="Docker Compose (full YAML)" line="96" end="205" load="when-implementing-docker" />`
- **Impact:** SHOULD UPDATE
- **New text:** `<section name="Docker Compose (dev only)" line="96" end="205" load="when-setting-up-dev" />`

### 1.10 SPEC-MANIFEST.xml line 250 (Dockerfile section index)
- **Current text:** `<section name="Dockerfile (multi-stage)" line="292" end="333" load="when-implementing-docker" />`
- **Impact:** MUST CHANGE
- **New text:** Remove or replace with "Vercel Deployment Configuration" section.

### 1.11 SPEC-MANIFEST.xml line 350 (task routing - project setup)
- **Current text:** `specs="SPEC-007:Tech Stack, SPEC-007:Docker Compose, SPEC-007:Gitignore, SPEC-007:Dockerfile, SPEC-009:Project Structure"`
- **Impact:** MUST CHANGE
- **New text:** `specs="SPEC-007:Tech Stack, SPEC-007:Docker Compose (dev), SPEC-007:Gitignore, SPEC-007:Vercel Config, SPEC-007:Supabase Setup, SPEC-009:Project Structure"`

### 1.12 SPEC-MANIFEST.xml line 371 (Phase 1)
- **Current text:** `Docker, DB, Cloudflare Tunnel`
- **Impact:** MUST CHANGE
- **New text:** `Local dev DB (Docker), Supabase project setup, Vercel project setup, environment config`

### 1.13 SPEC-007-infrastructure.md line 11
- **Current text:** `- Docker Compose with exactly 3 services: app, db, tunnel`
- **Impact:** MUST CHANGE
- **New text:** `- Development: Docker Compose with 1 service (db) + npm run dev for the app` and add `- Production: Supabase (PostgreSQL + Storage + Realtime) + Vercel (Next.js hosting, auto-deploy from GitHub)`

### 1.14 SPEC-007-infrastructure.md line 16
- **Current text:** `- Multi-stage Dockerfile with non-root user for the app service`
- **Impact:** MUST CHANGE
- **New text:** Remove. Vercel handles builds. Optionally: `- Dockerfile retained for optional self-hosted fallback deployment`

### 1.15 SPEC-007-infrastructure.md lines 30-32
- **Current text:** `docker compose up -d starts all 3 services healthy within 60 seconds. No port is accessible from outside the host except via Cloudflare Tunnel. Backups are encrypted and unreadable without the key.`
- **Impact:** MUST CHANGE
- **New text:** `Dev: docker compose up db -d && npm run dev starts local dev environment. Prod: Supabase + Vercel deployment is healthy. Database backups are automated by Supabase. Self-hosted fallback: docker compose up -d starts all services.`

### 1.16 SPEC-007-infrastructure.md lines 36-43 (immutable constraints)
- **Current text:** 8 Docker-centric constraints
- **Impact:** MUST CHANGE
- **New text:** Revise to:
  - `DATABASE_URL connects to local Docker PG in dev, Supabase PG in prod`
  - `NEXTAUTH_SECRET is minimum 32 bytes of cryptographic randomness`
  - `.env is never committed to git`
  - `All data access uses Drizzle ORM with standard PostgreSQL — no Supabase client JS SDK for DB queries`
  - `File uploads use Supabase Storage REST API in prod, local filesystem in dev`
  - Remove: Docker image pinning, restart policy, non-root Dockerfile, 0.0.0.0 port constraints (these become irrelevant or are handled by Supabase/Vercel)

### 1.17 SPEC-007-infrastructure.md line 49
- **Current text:** `The Digital Call Board runs as a containerized web application, backed by PostgreSQL, and exposed to the internet via a Cloudflare Tunnel to a custom domain. The entire stack runs on a single host machine.`
- **Impact:** MUST CHANGE
- **New text:** `Development: The app runs locally via npm run dev, backed by a Docker PostgreSQL container. Production: The app is deployed to Vercel (auto-deploy from GitHub), backed by Supabase (hosted PostgreSQL, file storage, and Realtime). The codebase uses standard PostgreSQL + Drizzle ORM to maintain portability — it can always fall back to a fully self-hosted Docker deployment.`

### 1.18 SPEC-007-infrastructure.md line 62
- **Current text:** `| Containerization | Docker + Docker Compose | Reproducible environment |`
- **Impact:** MUST CHANGE
- **New text:** `| Dev Database | Docker + Docker Compose | Local PostgreSQL for development |` and add row: `| Prod Hosting | Vercel | Next.js hosting, auto-deploy from GitHub, edge functions |` and `| Prod Database | Supabase | Hosted PostgreSQL, automated backups, Storage, Realtime |`

### 1.19 SPEC-007-infrastructure.md line 63
- **Current text:** `| Tunnel | Cloudflare Tunnel (cloudflared) | Expose to custom domain, free HTTPS |`
- **Impact:** MUST CHANGE
- **New text:** Remove. Vercel provides HTTPS and custom domain routing natively.

### 1.20 SPEC-007-infrastructure.md line 65
- **Current text:** `| CI/CD | GitHub Actions | Automated tests on PR, build verification |`
- **Impact:** SHOULD UPDATE
- **New text:** `| CI/CD | GitHub Actions + Vercel | GH Actions for tests, Vercel for auto-deploy on push to main |`

### 1.21 SPEC-007-infrastructure.md lines 67-94 (Architecture Diagram)
- **Current text:** ASCII diagram showing Browser -> Cloudflare Edge -> Cloudflare Tunnel -> Host Machine -> cloudflared -> Next.js App -> PostgreSQL
- **Impact:** MUST CHANGE
- **New text:** Replace with two diagrams:
  ```
  DEVELOPMENT:
  Browser <-> localhost:3000 (npm run dev) <-> Docker PostgreSQL (localhost:5432)

  PRODUCTION:
  Browser <-> Vercel Edge <-> Vercel Serverless (Next.js) <-> Supabase PostgreSQL
                                                          <-> Supabase Storage
                                                          <-> Supabase Realtime (WebSocket)
  ```

### 1.22 SPEC-007-infrastructure.md lines 96-196 (Full Docker Compose YAML)
- **Current text:** Full docker-compose.yml with 3 services (db, app, tunnel), volumes (pgdata, uploads), environment variables
- **Impact:** MUST CHANGE
- **New text:** Simplified dev-only docker-compose.yml:
  ```yaml
  services:
    db:
      image: postgres:16.6-alpine
      restart: unless-stopped
      ports:
        - "127.0.0.1:5432:5432"
      volumes:
        - pgdata:/var/lib/postgresql/data
      environment:
        POSTGRES_USER: callboard
        POSTGRES_PASSWORD: ${DB_PASSWORD:-callboard_dev}
        POSTGRES_DB: callboard
      healthcheck:
        test: ["CMD-SHELL", "pg_isready -U callboard"]
        interval: 10s
        timeout: 5s
        retries: 5
  volumes:
    pgdata:
  ```
  Remove `app` and `tunnel` services. Remove `uploads` volume. Add a section on Supabase project setup and Vercel project setup.

### 1.23 SPEC-007-infrastructure.md lines 198-205 (Docker Compose security notes)
- **Current text:** Notes about 0.0.0.0, pinned images, restart policy, health check, log rotation
- **Impact:** MUST CHANGE
- **New text:** Simplify to dev-only notes. Production security is handled by Supabase (managed PostgreSQL, no port exposure) and Vercel (HTTPS, edge network, DDoS protection).

### 1.24 SPEC-007-infrastructure.md lines 292-333 (Dockerfile)
- **Current text:** Full multi-stage Dockerfile with non-root user, health check, etc.
- **Impact:** MUST CHANGE
- **New text:** Remove or relegate to an appendix labeled "Optional: Self-Hosted Fallback Dockerfile". Vercel does not use a Dockerfile. Add a `vercel.json` configuration section if needed.

### 1.25 SPEC-007-infrastructure.md lines 362-365 (Docker Log Rotation section)
- **Current text:** Docker json-file log driver config
- **Impact:** MUST CHANGE
- **New text:** `Dev: Docker logs for PostgreSQL container only. Prod: Vercel provides built-in function logs and Supabase provides database logs via dashboard.`

### 1.26 SPEC-008-tdd.md line 193
- **Current text:** `| 1 | Infrastructure (Docker, DB, Cloudflare) | SPEC-007 | Setup |`
- **Impact:** MUST CHANGE
- **New text:** `| 1 | Infrastructure (Local dev DB, Supabase, Vercel) | SPEC-007 | Setup |`

### 1.27 SPEC-001-product-overview.md line 133
- **Current text:** `- Docker containerized deployment`
- **Impact:** MUST CHANGE
- **New text:** `- Vercel deployment (production), Docker PostgreSQL (development)`

### 1.28 SPEC-007-infrastructure.md lines 371-382 (Test Scenarios INFRA-01 through INFRA-12)
- **Impact:** MUST CHANGE (multiple test scenarios)
  - **INFRA-01** (line 371): "Docker Compose starts all services" -> "Dev: docker compose up db starts PostgreSQL. Prod: Vercel + Supabase healthy."
  - **INFRA-03** (line 373): "Cloudflare Tunnel routes traffic" -> "Vercel routes traffic to custom domain"
  - **INFRA-04** (line 374): "Docker auto-restarts container" -> "Vercel auto-restarts serverless functions; Supabase manages DB uptime"
  - **INFRA-05** (line 375): "Data survives container restart (volume)" -> "Dev: PG volume persists. Prod: Supabase manages persistence."
  - **INFRA-08** (line 378): "PostgreSQL port not accessible from host" -> "Dev: PG on 127.0.0.1 only. Prod: Supabase manages network security."
  - **INFRA-09** (line 379): "App port not accessible from outside host" -> Remove or reframe for Vercel.
  - **INFRA-10** (line 380): "Backup is encrypted" -> "Prod: Supabase automated daily backups (encrypted at rest)."
  - **INFRA-11** (line 381): "Logs rotate at 10MB" -> "Vercel manages log retention. Dev: Docker log rotation on PG container."

---

## 2. Cloudflare Tunnel / cloudflared / tunnel

### 2.1 AGENT.md line 11
- **Current text:** `Cloudflare Tunnel` in stack
- **Impact:** MUST CHANGE (covered in 1.1 above)

### 2.2 AGENT.md lines 145-146
- **Current text:** `- PostgreSQL port NEVER exposed to 0.0.0.0` / `- App port NEVER exposed to 0.0.0.0 in production`
- **Impact:** MUST CHANGE
- **New text:** These constraints are now handled by Supabase (managed DB) and Vercel (no exposed ports). For dev, PG is on 127.0.0.1. Remove or reframe: `- Dev PostgreSQL bound to 127.0.0.1 only. Prod: Supabase and Vercel manage network security.`

### 2.3 SPEC-001-product-overview.md line 134
- **Current text:** `- Cloudflare Tunnel to custom domain`
- **Impact:** MUST CHANGE
- **New text:** `- Vercel custom domain (production)`

### 2.4 SPEC-001-product-overview.md line 148
- **Current text:** `- **Availability:** Hosted 24/7 via Cloudflare Tunnel`
- **Impact:** MUST CHANGE
- **New text:** `- **Availability:** Hosted 24/7 via Vercel + Supabase`

### 2.5 SPEC-002-auth.md line 291
- **Current text:** `- All auth endpoints over HTTPS (enforced by Cloudflare Tunnel)`
- **Impact:** MUST CHANGE
- **New text:** `- All auth endpoints over HTTPS (enforced by Vercel edge network)`

### 2.6 SPEC-007-infrastructure.md line 13
- **Current text:** `- Cloudflare Tunnel for HTTPS termination and public access`
- **Impact:** MUST CHANGE
- **New text:** `- Production: Vercel for HTTPS termination, custom domain, and public access`

### 2.7 SPEC-007-infrastructure.md lines 207-225 (Cloudflare Tunnel Setup section)
- **Current text:** Full Cloudflare Tunnel setup guide (prerequisites, setup steps, benefits)
- **Impact:** MUST CHANGE
- **New text:** Replace entirely with "Vercel Deployment Setup" section covering: connect GitHub repo, configure environment variables in Vercel dashboard, set custom domain, configure build settings. And "Supabase Project Setup" section covering: create project, note connection string, configure Storage bucket for headshots, configure Realtime.

### 2.8 SPEC-007-infrastructure.md line 106
- **Current text:** `| tunnel | cloudflare/cloudflared:2024.12.2 | None | Connects to Cloudflare edge |`
- **Impact:** MUST CHANGE
- **New text:** Remove entirely. No tunnel service needed.

### 2.9 SPEC-007-infrastructure.md line 124
- **Current text:** `| CLOUDFLARE_TUNNEL_TOKEN | tunnel | Tunnel authentication |`
- **Impact:** MUST CHANGE
- **New text:** Remove. No tunnel token needed. (Vercel uses its own deployment tokens via GitHub integration.)

### 2.10 SPEC-007-infrastructure.md lines 179-191 (tunnel service in docker-compose YAML)
- **Current text:** Full `tunnel:` service definition
- **Impact:** MUST CHANGE
- **New text:** Remove entirely from docker-compose.yml.

### 2.11 SPEC-007-infrastructure.md line 339
- **Current text:** `- **Cloudflare analytics** for traffic monitoring (free tier)`
- **Impact:** MUST CHANGE
- **New text:** `- **Vercel Analytics** for traffic monitoring (included in plan)`

### 2.12 SPEC-MANIFEST.xml line 245
- **Current text:** `<section name="Cloudflare Tunnel Setup" line="207" end="225" load="when-implementing-tunnel" />`
- **Impact:** MUST CHANGE
- **New text:** `<section name="Vercel + Supabase Deployment Setup" line="207" end="225" load="when-deploying" />`

---

## 3. Port Exposure / 0.0.0.0 / localhost

### 3.1 AGENT.md line 145
- **Current text:** `- PostgreSQL port NEVER exposed to 0.0.0.0`
- **Impact:** MUST CHANGE (covered in 2.2)

### 3.2 AGENT.md line 146
- **Current text:** `- App port NEVER exposed to 0.0.0.0 in production`
- **Impact:** MUST CHANGE (covered in 2.2)

### 3.3 SPEC-007-infrastructure.md line 104
- **Current text:** `| app | Custom (Dockerfile) | 127.0.0.1:3000 (dev only) | Next.js production build |`
- **Impact:** MUST CHANGE
- **New text:** Remove the `app` row from the services table. The app runs via `npm run dev` locally, not as a Docker service.

### 3.4 SPEC-007-infrastructure.md lines 157-160
- **Current text:** Comments about app port binding in docker-compose
- **Impact:** MUST CHANGE
- **New text:** Remove. App is not a Docker service.

---

## 4. Volume Mounts / pgdata / uploads

### 4.1 SPEC-007-infrastructure.md lines 193-195
- **Current text:** `volumes:\n  pgdata:\n  uploads:`
- **Impact:** MUST CHANGE
- **New text:** Keep `pgdata:` for dev. Remove `uploads:` -- in dev, uploads go to a local directory; in prod, uploads go to Supabase Storage.

### 4.2 SPEC-007-infrastructure.md line 169
- **Current text:** `volumes:\n      - uploads:/app/uploads`
- **Impact:** MUST CHANGE
- **New text:** Remove. There is no `app` Docker service. File storage strategy changes (see Section 5 below).

### 4.3 SPEC-007-infrastructure.md line 137
- **Current text:** `- pgdata:/var/lib/postgresql/data`
- **Impact:** NO CHANGE for dev. This stays as-is in the dev-only docker-compose.yml.
- **Note:** Actually SHOULD UPDATE -- expose port 5432 to 127.0.0.1 so `npm run dev` can connect to it (dev docker-compose currently has no ports exposed for db).

---

## 5. File Uploads / /app/uploads/ / headshot storage / serving endpoint

### 5.1 SPEC-004-cast-flow.md line 86
- **Current text:** `**Storage path:** /app/uploads/headshots/ inside the app container, backed by a Docker named volume uploads (persists across container restarts and rebuilds). **Serving endpoint:** GET /api/uploads/[filename] -- a Next.js API route that validates the requesting user is authenticated and a member of a production referencing this file, reads from disk, sets headers...`
- **Impact:** MUST CHANGE
- **New text:**
  ```
  **Storage:**
  - Development: Local filesystem at `./uploads/headshots/` (gitignored).
  - Production: Supabase Storage bucket `headshots` (private bucket, accessed via signed URLs or service-role key).
  **Serving endpoint:** `GET /api/uploads/[filename]` -- a Next.js API route that validates the requesting user is authenticated and a member of a production referencing this file. In dev, reads from local disk. In prod, generates a Supabase Storage signed URL (short-lived, e.g., 60 seconds) and redirects, OR proxies the file. Headers: Content-Type from magic bytes, Content-Disposition: inline, X-Content-Type-Options: nosniff, Cache-Control: private, max-age=86400.
  ```
- **Ripple:** Affects SPEC-007 (uploads volume removal), AGENT.md line 127 (file upload validation rules still apply)

### 5.2 SPEC-004-cast-flow.md line 87
- **Current text:** `**Deletion:** Users can delete their photo at any time. Photos are also deleted when the user is removed from a production or deletes their account`
- **Impact:** SHOULD UPDATE
- **New text:** Add: `In prod, deletion calls Supabase Storage delete API. In dev, deletes from local filesystem.`

### 5.3 SPEC-004-cast-flow.md line 177
- **Current text:** `headshot_url stores the path to the uploaded image (UUID filename in the uploads directory)`
- **Impact:** MUST CHANGE
- **New text:** `headshot_url stores the UUID filename (e.g., "a1b2c3d4.jpg"). The serving layer resolves this to local disk in dev or Supabase Storage in prod.`

### 5.4 SPEC-007-infrastructure.md line 253 (PII cleanup - orphaned uploads)
- **Current text:** `Then deletes orphaned upload files older than 90 days from the uploads volume.`
- **Impact:** MUST CHANGE
- **New text:** `Then deletes orphaned upload files older than 90 days from Supabase Storage (prod) or local uploads directory (dev).`

---

## 6. WebSocket / ws library / real-time

### 6.1 AGENT.md line 11
- **Current text:** `ws (WebSocket)` in stack
- **Impact:** MUST CHANGE
- **New text:** Replace `ws (WebSocket)` with `Supabase Realtime (prod WebSocket) or ws (self-hosted fallback)`. Note: Vercel serverless functions do not natively support long-lived WebSocket connections. Two options: (a) Use Supabase Realtime for pub/sub message delivery, or (b) Use a separate WebSocket server (e.g., on a small VPS or Supabase Edge Functions). The Supabase Realtime approach is recommended for the hybrid model.
- **Ripple:** Affects SPEC-005, SPEC-009

### 6.2 SPEC-005-chat.md line 37
- **Current text:** `WebSocket auth validates the session on upgrade handshake AND re-validates every 5 minutes. Expired sessions close with code 4401.`
- **Impact:** SHOULD UPDATE
- **New text:** The re-validation mechanism depends on the real-time transport. With Supabase Realtime, session validation happens via Supabase auth tokens (JWTs with expiry). With ws (self-hosted), the existing spec applies. Add: `In hybrid prod mode, Supabase Realtime channels are used for message delivery. The client subscribes to a channel scoped to their production. Authorization is enforced via Supabase Row Level Security (RLS) policies or via the API layer before publishing.`
- **Ripple:** Affects SPEC-005 lines 104-113 (WebSocket Authentication section)

### 6.3 SPEC-005-chat.md lines 99-100
- **Current text:** `- **Primary:** WebSocket connection for real-time message delivery` / `- **Fallback:** Polling every 10 seconds if WebSocket fails`
- **Impact:** SHOULD UPDATE
- **New text:** `- **Primary (prod):** Supabase Realtime channel subscription for real-time message delivery` / `- **Primary (dev/self-hosted):** ws WebSocket connection` / `- **Fallback:** Polling every 10 seconds if real-time transport fails`

### 6.4 SPEC-005-chat.md lines 104-113 (WebSocket Authentication section)
- **Current text:** Detailed ws upgrade handshake authentication requirements
- **Impact:** SHOULD UPDATE
- **New text:** Keep the security requirements but add a note: `In hybrid prod mode using Supabase Realtime, authentication is handled via Supabase auth tokens. The client obtains a token from the app's auth layer and uses it to subscribe to Realtime channels. Channel-level authorization (Row Level Security) ensures users can only receive messages for their own conversations.`

### 6.5 SPEC-009-frontend-architecture.md line 66
- **Current text:** `| Real-time | Native WebSocket (client) | Chat delivery, reconnection logic |`
- **Impact:** SHOULD UPDATE
- **New text:** `| Real-time | Supabase Realtime client (prod) / Native WebSocket (dev/fallback) | Chat delivery, reconnection logic |`

---

## 7. Backups / pg_dump / GPG / cron

### 7.1 SPEC-007-infrastructure.md line 14
- **Current text:** `- Encrypted daily backups using GPG AES256`
- **Impact:** MUST CHANGE
- **New text:** `- Production: Automated daily backups via Supabase (encrypted at rest, point-in-time recovery on Pro plan). Dev/self-hosted: Optional manual pg_dump with GPG AES256 encryption.`

### 7.2 SPEC-007-infrastructure.md lines 234-242 (Backups section)
- **Current text:** Detailed pg_dump + GPG encryption pipeline, cron schedule, restore commands
- **Impact:** MUST CHANGE
- **New text:** ```
  **Production (Supabase):** Supabase provides automated daily backups with 7-day retention (Free plan) or point-in-time recovery (Pro plan). Backups are encrypted at rest by Supabase. No manual backup scripts needed.

  **Development / Self-hosted fallback:** Use the original pg_dump + GPG pipeline:
  - `pg_dump -U callboard callboard | gpg --symmetric --cipher-algo AES256 --batch --passphrase-file /path/to/backup-key > backup-$(date +%Y%m%d).sql.gpg`
  - Restore: `gpg --decrypt ... | psql -U callboard callboard`
  ```

### 7.3 AGENT.md line 147
- **Current text:** `- Backups encrypted with GPG AES256`
- **Impact:** MUST CHANGE
- **New text:** `- Prod: Supabase automated encrypted backups. Self-hosted fallback: GPG AES256 encrypted pg_dump.`

---

## 8. Dockerfile / multi-stage / non-root

### 8.1 SPEC-007-infrastructure.md lines 294-333 (Full Dockerfile)
- **Current text:** Multi-stage Dockerfile with builder stage, production stage, non-root user, health check
- **Impact:** MUST CHANGE
- **New text:** Move to an appendix section titled "Appendix: Self-Hosted Fallback Dockerfile" or remove entirely. Vercel builds Next.js apps using its own build pipeline (reads `next.config.js`, runs `npm run build`). No Dockerfile needed for production.

### 8.2 SPEC-007-infrastructure.md line 301
- **Current text:** `- **.dockerignore:** Must exclude node_modules/, .git/, .env, uploads/, coverage/, *.md`
- **Impact:** SHOULD UPDATE
- **New text:** Keep .dockerignore for optional self-hosted fallback. Add a `.vercelignore` if needed (Vercel respects .gitignore by default).

### 8.3 SPEC-007-infrastructure.md line 302
- **Current text:** `- **Health check:** HEALTHCHECK CMD curl -f http://localhost:3000/api/health || exit 1`
- **Impact:** MUST CHANGE
- **New text:** Remove Docker HEALTHCHECK. Vercel provides its own health monitoring. The `/api/health` endpoint is still useful for manual checks and CI.

### 8.4 AGENT.md line 150
- **Current text:** `- Dockerfile runs as non-root user`
- **Impact:** MUST CHANGE
- **New text:** Remove. Vercel manages the runtime environment. For self-hosted fallback, this remains a recommendation.

---

## 9. Health Check Endpoint

### 9.1 SPEC-007-infrastructure.md lines 337-339
- **Current text:** `- **Health check endpoint:** GET /api/health returns { status: "ok", db: "connected" }` / `- **Docker health checks** on both app and db services` / `- **Cloudflare analytics** for traffic monitoring`
- **Impact:** SHOULD UPDATE
- **New text:** Keep the `/api/health` endpoint (useful for monitoring and CI). Change: `- **Vercel monitoring** + Supabase dashboard for production health` / `- **Docker health check** on dev PostgreSQL container only`

### 9.2 SPEC-009-frontend-architecture.md line 100
- **Current text:** `health/route.ts -- Health check endpoint`
- **Impact:** NO CHANGE -- the health endpoint remains useful.

---

## 10. Environment Variables

### 10.1 SPEC-007-infrastructure.md line 124
- **Current text:** `| CLOUDFLARE_TUNNEL_TOKEN | tunnel | Tunnel authentication |`
- **Impact:** MUST CHANGE (covered in 2.9)

### 10.2 SPEC-007-infrastructure.md line 116
- **Current text:** `| NEXTAUTH_URL | app | Public URL (your domain) |`
- **Impact:** SHOULD UPDATE
- **New text:** `| NEXTAUTH_URL | app | Public URL (Vercel auto-sets VERCEL_URL; override with custom domain) |`

### 10.3 SPEC-007-infrastructure.md lines 112-125 (environment variables table)
- **Impact:** SHOULD UPDATE
- **New text:** Add new variables:
  - `SUPABASE_URL` -- Supabase project URL (for Storage and Realtime)
  - `SUPABASE_SERVICE_ROLE_KEY` -- Service role key for server-side Storage operations (never exposed to client)
  - `SUPABASE_ANON_KEY` -- Anon key for client-side Realtime subscriptions
  - Keep all existing variables except `CLOUDFLARE_TUNNEL_TOKEN`
  - `DATABASE_URL` now points to Supabase PostgreSQL connection string in prod (`postgresql://postgres.[ref]:[password]@[host]:5432/postgres`)

### 10.4 SPEC-007-infrastructure.md line 162
- **Current text:** `DATABASE_URL: postgresql://callboard:${DB_PASSWORD}@db:5432/callboard`
- **Impact:** SHOULD UPDATE
- **New text:** This is fine for the dev docker-compose. Add a note: `In production, DATABASE_URL is the Supabase PostgreSQL connection string configured in Vercel environment variables.`

---

## 11. SMTP / Nodemailer / email

### 11.1 SPEC-002-auth.md lines 181-196 (Email Delivery section)
- **Current text:** Nodemailer + SMTP for transactional emails
- **Impact:** NO CHANGE -- Nodemailer + SMTP works identically on Vercel serverless functions. SMTP credentials are set as Vercel environment variables.
- **Note:** SHOULD UPDATE to add a caveat: Vercel serverless functions have a 10-second default timeout (30s on Pro). Email sending should be async/non-blocking. Consider using Vercel's `waitUntil()` for background email sending, or use a service like Resend/SendGrid that has fast API response times vs raw SMTP.

---

## 12. PII Deletion Job / Scheduled Jobs

### 12.1 SPEC-007-infrastructure.md lines 244-253 (Scheduled Jobs section)
- **Current text:** Two cron jobs on the host machine: backup (2 AM) and PII cleanup (3 AM), running shell scripts
- **Impact:** MUST CHANGE
- **New text:**
  ```
  **Production:**
  - Database backup: Handled automatically by Supabase.
  - PII cleanup: Vercel Cron Job (vercel.json cron config) triggers a Next.js API route at 3:00 AM UTC daily. The route runs the PII deletion query against Supabase PostgreSQL via Drizzle ORM. Supabase Storage API deletes orphaned upload files.

  **Development / Self-hosted fallback:**
  - Database backup: scripts/backup.sh via host cron
  - PII cleanup: scripts/pii-cleanup.sh via host cron
  ```
- **Ripple:** Requires adding a cron configuration to `vercel.json` and creating an API route like `GET /api/cron/pii-cleanup` protected by a `CRON_SECRET` header.

### 12.2 SPEC-003-director-flow.md line 183
- **Current text:** `After 90 days from archived_at, a scheduled job permanently deletes: cast profiles, conflicts, chat messages, and uploaded images.`
- **Impact:** MUST CHANGE
- **New text:** `After 90 days from archived_at, a scheduled job (Vercel Cron in prod, host cron in self-hosted) permanently deletes: cast profiles, conflicts, chat messages, and uploaded images (from Supabase Storage in prod, local disk in dev).`

---

## 13. .gitignore Entries

### 13.1 SPEC-007-infrastructure.md lines 279-290
- **Current text:** `.gitignore` list including `uploads/`, `*.gpg`
- **Impact:** SHOULD UPDATE
- **New text:** Add: `.vercel/` (Vercel local config). Keep `uploads/` (for local dev uploads). Keep `*.gpg` (for self-hosted backup fallback). Add `.env*.local` if not already covered by `.env.*.local`.

---

## 14. CI/CD / GitHub Actions

### 14.1 SPEC-008-tdd.md lines 176-185 (CI Integration section)
- **Current text:** GitHub Actions CI that spins up PostgreSQL, runs tests, builds the app
- **Impact:** SHOULD UPDATE
- **New text:** Keep GitHub Actions for testing. Add: `Vercel handles deployment automatically on push to main. The CI pipeline does NOT deploy -- it only runs tests and linting. Vercel's GitHub integration handles build + deploy separately.`

### 14.2 SPEC-007-infrastructure.md line 24
- **Current text (non-goal):** `CI/CD auto-deploy to production (deployment is manual via docker compose up)`
- **Impact:** MUST CHANGE
- **New text:** Remove from non-goals. CI/CD auto-deploy IS now a goal via Vercel's GitHub integration.

### 14.3 SPEC-008-tdd.md line 28
- **Current text:** `CI completes in under 5 minutes.`
- **Impact:** SHOULD UPDATE (still valid but add note)
- **New text:** `CI (GitHub Actions test suite) completes in under 5 minutes. Vercel build/deploy is a separate pipeline.`

---

## 15. Cloudflare DNS

### 15.1 SPEC-007-infrastructure.md line 216
- **Current text:** `**Configure DNS:** Add CNAME record pointing domain to <tunnel-id>.cfargotunnel.com`
- **Impact:** MUST CHANGE
- **New text:** `**Configure DNS:** Add CNAME record pointing domain to cname.vercel-dns.com (or use Vercel Domains to auto-configure)`

### 15.2 SPEC-007-infrastructure.md lines 221-225 (Tunnel Benefits)
- **Current text:** Benefits of Cloudflare Tunnel (free HTTPS, no open ports, DDoS, works behind NAT)
- **Impact:** MUST CHANGE
- **New text:** Benefits of Vercel: `- Free HTTPS with automatic certificate provisioning` / `- No server to manage, no open ports` / `- Global edge network with DDoS protection` / `- Automatic preview deployments on PRs` / `- Zero-config auto-deploy from GitHub`

---

## Cross-Cutting Concerns (Ripple Effects)

### R1. SPEC-MANIFEST.xml `<stack>` tag (line 25) is the canonical stack list
Any change here must be reflected in AGENT.md line 11 and SPEC-007 line 62 (tech stack table).

### R2. WebSocket transport change (ws -> Supabase Realtime) affects:
- SPEC-005 (chat system) -- entire real-time delivery section
- SPEC-009 (frontend architecture) -- real-time tech stack row
- AGENT.md line 34 -- "ws (not Socket.io)" tech stack constraint
- SPEC-005 immutable constraint about WebSocket close code 4401 -- needs reframing for Supabase Realtime
- SPEC-003 line 171 -- WebSocket re-validation on demotion

### R3. File storage change (Docker volume -> Supabase Storage) affects:
- SPEC-004 lines 80-87 (image upload requirements)
- SPEC-007 (uploads volume, PII cleanup)
- SPEC-003 line 183 (PII deletion mentions "uploaded images")
- AGENT.md line 269 (commit rules: "Never commit uploads/")

### R4. Removal of Cloudflare Tunnel affects:
- SPEC-002 line 291 (HTTPS enforcement attribution)
- SPEC-001 lines 133-134 (scope: Docker + Cloudflare)
- SPEC-001 line 148 (availability)
- All SPEC-007 tunnel references

### R5. Deployment model change (manual docker compose -> Vercel auto-deploy) affects:
- SPEC-008 CI section (add note about Vercel separate pipeline)
- SPEC-007 non-goals (CI/CD auto-deploy is now a goal)
- AGENT.md Phase 1 description

### R6. Supabase portability constraint is NEW and cross-cutting:
Must be added to SPEC-007 immutable constraints AND AGENT.md Section 0 stack description: "All database access uses standard PostgreSQL + Drizzle ORM. Supabase client libraries are used ONLY for Storage and Realtime, NEVER for database queries. This ensures the codebase can fall back to fully self-hosted Docker at any time."

---

## Files Requiring Changes (Ordered by Impact)

| Priority | File | Changes Required |
|----------|------|-----------------|
| 1 | `spec/SPEC-007-infrastructure.md` | Near-complete rewrite. Every section affected. |
| 2 | `AGENT.md` | Stack description, security rules, directory stewardship, phases |
| 3 | `spec/SPEC-MANIFEST.xml` | Stack tag, SPEC-007 index, task routing, phases, constraints |
| 4 | `spec/SPEC-004-cast-flow.md` | File upload storage path + serving endpoint |
| 5 | `spec/SPEC-005-chat.md` | WebSocket/Realtime transport |
| 6 | `spec/SPEC-001-product-overview.md` | Scope section (Docker + Cloudflare references) |
| 7 | `spec/SPEC-002-auth.md` | HTTPS enforcement attribution |
| 8 | `spec/SPEC-008-tdd.md` | Phase 1 description, CI section |
| 9 | `spec/SPEC-009-frontend-architecture.md` | Real-time tech stack row |
| 10 | `spec/SPEC-003-director-flow.md` | PII deletion reference |
| -- | `spec/SPEC-006-schedule.md` | NO CHANGES NEEDED |
| -- | `spec/SPEC-010-pages-and-screens.md` | NO CHANGES NEEDED |
