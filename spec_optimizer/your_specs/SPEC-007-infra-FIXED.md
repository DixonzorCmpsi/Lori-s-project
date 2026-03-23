# SPEC-007-INFRA-FIXED: Infrastructure & Deployment (FastAPI Backend)

**Status:** Draft
**Last Updated:** 2026-03-23

---

## Goals (Immutable)

- Development environment uses Docker PostgreSQL + uvicorn (FastAPI dev server)
- Production uses PostgreSQL (Supabase hosted) + Render/Vercel (FastAPI hosting)
- All database queries use SQLAlchemy async (NOT Drizzle - this is Python, not TypeScript)
- Use Alembic for migrations
- Auto-deploy from GitHub

## Non-Goals (Explicit Exclusions)

- Next.js or any JavaScript frontend framework
- Drizzle ORM (wrong language)
- Kubernetes or container orchestration

## 1. Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Backend | FastAPI 0.115+ | Modern async Python web framework |
| Database | PostgreSQL 16 | Standard SQL |
| ORM | SQLAlchemy 2.0+ async | Python async ORM |
| Auth | JWT (python-jose) | Token-based auth |
| Password | bcrypt (passlib) | Secure hashing |
| Migrations | Alembic | Database migrations |
| Testing | pytest + pytest-asyncio | Async test support |
| Hosting | Render / Railway / VPS | Python-compatible hosting |

## 2. Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py              # CRITICAL: MUST have create_app() function
│   ├── config.py            # Settings
│   ├── database.py          # SQLAlchemy setup
│   ├── models.py            # SQLAlchemy models
│   ├── routers/             # API route handlers
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   ├── theaters.py
│   │   ├── productions.py
│   │   ├── schedule.py
│   │   ├── bulletin.py
│   │   ├── members.py
│   │   ├── invite.py
│   │   ├── conflicts.py
│   │   ├── cast_profile.py
│   │   └── chat.py
│   └── services/
│       ├── __init__.py
│       └── business_logic.py  # Pure functions from spec
├── tests/
│   ├── conftest.py
│   ├── integration/
│   │   ├── test_auth.py
│   │   ├── test_cast_flow.py
│   │   ├── test_director_flow.py
│   │   └── ...
│   └── unit/
├── alembic/
│   └── versions/
├── requirements.txt
├── pyproject.toml
└── alembic.ini
```

## 3. main.py CRITICAL REQUIREMENTS

The `app/main.py` file MUST export a `create_app()` function. This is required by the test suite.

```python
# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import (
    auth, theaters, productions, schedule, bulletin,
    members, invite, conflicts, cast_profile, chat
)

def create_app() -> FastAPI:
    """Create and configure the FastAPI application.
    
    This function MUST be exported - tests import it:
        from app.main import create_app
        app = create_app()
    """
    app = FastAPI(
        title="Digital Call Board API",
        description="Theater Production Management API",
        version="1.0.0"
    )
    
    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://localhost:5173",  # Vite dev
            "http://localhost:3000",  # Next.js dev (if used)
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Include routers - ALL of these are required
    app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
    app.include_router(theaters.router, prefix="/api/theaters", tags=["theaters"])
    app.include_router(productions.router, prefix="/api/productions", tags=["productions"])
    app.include_router(schedule.router, prefix="/api/productions", tags=["schedule"])
    app.include_router(bulletin.router, prefix="/api/productions", tags=["bulletin"])
    app.include_router(members.router, prefix="/api/productions", tags=["members"])
    app.include_router(invite.router, prefix="/api/invite", tags=["invite"])
    app.include_router(conflicts.router, prefix="/api/productions", tags=["conflicts"])
    app.include_router(cast_profile.router, prefix="/api/productions", tags=["cast_profile"])
    app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
    
    # Health check endpoint (required by tests and infrastructure)
    @app.get("/api/health")
    async def health_check():
        return {"status": "ok"}
    
    return app


# For running with uvicorn: uvicorn app.main:app --reload
app = create_app()
```

## 4. database.py CRITICAL REQUIREMENTS

The `app/database.py` file MUST have these exports for tests to work:

```python
# app/database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from typing import AsyncGenerator
import os

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://callboard:callboard_dev@localhost:5432/callboard"
)

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

## 5. Dependencies (requirements.txt)

```
# Core
fastapi>=0.115.0
uvicorn[standard]>=0.34.0
sqlalchemy[asyncio]>=2.0.0
asyncpg>=0.30.0
alembic>=1.14.0

# Auth
pydantic>=2.10.0
pydantic-settings>=2.7.0
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4

# Utilities
python-multipart>=0.0.18
httpx>=0.28.0
markdown-it-py>=3.0.0
bleach>=6.2.0
Pillow>=11.0.0

# Testing
pytest>=8.3.0
pytest-asyncio>=0.25.0
pytest-cov>=6.0.0
factory-boy>=3.3.0
freezegun>=1.4.0
```

## 6. Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| DATABASE_URL | PostgreSQL connection string | postgresql+asyncpg://callboard:callboard_dev@localhost:5432/callboard |
| SECRET_KEY | JWT signing key | (required) |
| CORS_ORIGINS | Comma-separated allowed origins | http://localhost:5173,http://localhost:3000 |

## 7. Docker Compose (Development)

```yaml
# docker-compose.yml
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

volumes:
  pgdata:
```

## 8. Running the Application

```bash
# Development
docker compose up db -d
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload

# Production
# Set DATABASE_URL to production PostgreSQL
# Deploy to Render/Railway/VPS with gunicorn + uvicorn workers
```

## 9. Health Check

The `/api/health` endpoint MUST return 200 OK when the application is running:

```bash
curl http://localhost:8000/api/health
# {"status": "ok"}
```

This is used by:
- Load balancers for health checks
- CI/CD pipelines
- Monitoring systems

## 10. Test Configuration

Tests use in-memory SQLite for isolation:

```python
# tests/conftest.py
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest.fixture(scope="function")
def app_instance():
    # Create test app with test database
    from app.main import create_app
    app = create_app()
    # Override database to use test DB
    # ...
    return app
```

---

## 11. Test Scenarios

| ID | Scenario | Expected Result |
|----|----------|-----------------|
| INFRA-01 | docker compose up db -d starts PostgreSQL | Local DB accessible at localhost:5432 |
| INFRA-02 | uvicorn connects to local DB | Health check returns ok |
| INFRA-03 | Run pytest tests | All tests pass |
| INFRA-04 | App connects to production PostgreSQL | Health check returns ok |
| INFRA-05 | Alembic migrations run | Schema up to date |
| INFRA-06 | Test with SQLite in-memory | Tests run independently |