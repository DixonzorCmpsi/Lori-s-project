# SPEC-007: Infrastructure & Deployment

**Status:** Active
**Last Updated:** 2026-04-04
**Depends On:** SPEC-002

---

## Goals (Immutable)

- Development environment uses Supabase PostgreSQL + local dev servers (zero Docker dependency for dev)
- Production uses Docker Compose + Cloudflare Tunnel on a local machine
- All database queries use SQLAlchemy async ORM against Supabase PostgreSQL (PgBouncer pooler)
- File uploads use local filesystem (Supabase Storage planned for future)
- Deployment is manual: `git pull && docker compose build && docker compose up -d`

## Non-Goals (Explicit Exclusions)

- Kubernetes or container orchestration
- Vercel, Render, Railway, or any PaaS hosting
- Redis or in-memory cache beyond rate limiting
- Multi-region deployment
- CI/CD pipeline (manual deployment for now)

## Success Metric

A developer can clone the repo, copy `.env`, run `./start.sh`, and have the full app running locally in under 5 minutes. Production deployment is `git pull && docker compose build && docker compose up -d` on the host machine.

## Immutable Constraints

- Database queries MUST use SQLAlchemy async ORM only
- PgBouncer connection requires `statement_cache_size=0` in asyncpg connect_args
- NEXTAUTH_SECRET minimum 32 bytes of cryptographic randomness
- `.env` and `.env.production` files NEVER committed to git
- Supabase database connection uses pooler URL (port 6543) via PgBouncer

---

## 1. Overview

| Environment | Database | App Hosting | File Storage | Realtime |
|------------|----------|-------------|-------------|----------|
| Development | Supabase PostgreSQL (remote) | `./start.sh` (backend :8000, frontend :5173) | Local filesystem (`uploads/`) | `ws` library (local WebSocket) |
| Production | Supabase PostgreSQL (remote) | Docker Compose (nginx :8080) + Cloudflare Tunnel | Local filesystem | `ws` library |

Application code is identical in both environments. Only environment variables change.

## 2. Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | React 19 + Vite 6 + TypeScript | Fast dev server, SPA with client-side routing |
| Backend | FastAPI + SQLAlchemy async | Python async, auto-generated OpenAPI docs |
| Database | PostgreSQL 15 (Supabase hosted) | Managed PostgreSQL, automatic backups |
| ORM | SQLAlchemy async + asyncpg | Type-safe, async-first, PgBouncer compatible |
| Auth | JWT (python-jose) + bcrypt + Google OAuth | Stateless auth, no session store needed |
| Realtime | `ws` WebSocket library | Chat message delivery (dev and production) |
| File Storage | Local filesystem | Headshot uploads stored in `uploads/` |
| Styling | Tailwind CSS 4 + framer-motion | Dark theater theme, utility-first, animations |
| Hosting | Docker Compose + nginx | Self-hosted, no cloud vendor dependency |
| Tunnel | Cloudflare Tunnel (cloudflared) | HTTPS + DNS routing to local Docker |
| DNS | Cloudflare | callboard.deetalk.win CNAME to tunnel |

## 3. Architecture Diagram

```text
Development:
  Browser <-> localhost:5173 (Vite dev server)
                  |
            localhost:8000 (FastAPI + uvicorn)
                  |
            Supabase PostgreSQL (aws-1-us-east-1.pooler.supabase.com:6543)

Production:
  Browser <-> Cloudflare CDN (callboard.deetalk.win)
                  |
            Cloudflare Tunnel (cloudflared)
                  |
            localhost:8080 (nginx container)
                  |
            ┌─────┴─────┐
            |            |
      /api/* proxy    /* static
            |          (React SPA)
      backend:8000
      (FastAPI container)
            |
      Supabase PostgreSQL (PgBouncer, port 6543)
```

## 4. Docker Compose Services

```yaml
services:
  backend:
    build: ./backend              # Python 3.11, pip install, uvicorn
    env_file: .env.production     # DB URL, JWT secret, OAuth creds
    expose: ["8000"]              # Internal only, nginx proxies

  frontend:
    build: .                      # Multi-stage: node build + nginx serve
    depends_on: [backend]
    ports: ["8080:80"]            # Exposed to host, tunnel connects here
```

### nginx Configuration

- `/api/*` proxied to `backend:8000` (WebSocket upgrade supported)
- `/*` serves static React build with SPA fallback (`try_files $uri /index.html`)
- Gzip enabled for JS/CSS/JSON
- Static assets cached 30 days with `immutable` header

## 5. Cloudflare Tunnel

The production app runs on a local machine (spare computer) and is exposed to the internet via Cloudflare Tunnel.

### Setup (one-time)

```bash
brew install cloudflared                       # macOS
cloudflared tunnel login                       # Authorize with Cloudflare account
cloudflared tunnel create callboard            # Create named tunnel
cloudflared tunnel route dns callboard callboard.deetalk.win  # Set DNS
```

### Configuration

`~/.cloudflared/config.yml`:
```yaml
tunnel: <tunnel-id>
credentials-file: ~/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: callboard.deetalk.win
    service: http://localhost:8080
  - service: http_status:404
```

### Running

```bash
cloudflared tunnel run callboard
```

For auto-start on boot: `sudo cloudflared service install`

## 6. Environment Variables

### Development (`.env` in project root)

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | `postgresql://postgres.xxx:pass@aws-1-us-east-1.pooler.supabase.com:6543/postgres` |
| `NEXTAUTH_SECRET` | `dev-secret-change-me-in-production-min-32-bytes` |
| `NEXTAUTH_URL` | `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `SUPABASE_URL` | `https://xxx.supabase.co` |
| `STORAGE_PROVIDER` | `local` |
| `REALTIME_PROVIDER` | `ws` |

### Production (`.env.production`, gitignored)

Same variables as development, except:
- `NEXTAUTH_SECRET` — cryptographically random (use `openssl rand -hex 32`)
- `NEXTAUTH_URL` — `https://callboard.deetalk.win`
- `VITE_GOOGLE_CLIENT_ID` — passed at Docker build time for frontend

## 7. Database

- **Provider:** Supabase PostgreSQL (free tier)
- **Connection:** PgBouncer pooler on port 6543 (transaction mode)
- **Driver:** asyncpg with `statement_cache_size=0` (required for PgBouncer)
- **ORM:** SQLAlchemy async with `create_async_engine`
- **Migrations:** Alembic (available but tables auto-created on startup via `Base.metadata.create_all`)
- **Pool:** size=5, max_overflow=10, pool_pre_ping=True

### Seed Data

Two seed scripts populate the database with test data:

```bash
docker compose exec backend python3 seed_data.py    # "Into the Woods" + 12 cast
docker compose exec backend python3 seed_admin.py   # "Phantom of the Opera" + 50 cast
```

Both scripts are idempotent (check before inserting).

## 8. Security

- **CORS:** Allows localhost origins + production URL from `NEXTAUTH_URL`
- **CSRF:** Origin checking on auth endpoints, production origin whitelisted
- **CSP:** Strict Content-Security-Policy header on all responses
- **HSTS:** `max-age=31536000; includeSubDomains`
- **Rate limiting:** Login endpoint: 5 attempts/minute per IP. Chat: 30 messages/minute per user.
- **JWT:** HS256 signed, includes `token_version` for invalidation
- **Passwords:** bcrypt with cost factor 12
- **Error boundary:** React PageErrorBoundary catches crashes, prevents blank screens

## 9. Health Check

```
GET /api/health -> {"status": "ok", "db": "connected"}
```

## 10. Monitoring

No formal monitoring yet. Cloudflare provides basic analytics. Docker logs available via `docker compose logs`.
