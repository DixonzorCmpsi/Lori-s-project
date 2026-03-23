# SPEC-OPTIMIZED: Digital Call Board - FastAPI Backend

**Status:** Draft
**Last Updated:** 2026-03-23

---

## 1. Architecture Overview

This is a **FastAPI** backend (NOT Next.js). All authentication uses JWT tokens stored in the Authorization header, not cookies.

### Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | FastAPI 0.115+ |
| ORM | SQLAlchemy 2.0+ (async) |
| Database | PostgreSQL 16 |
| Auth | JWT (python-jose) |
| Password | bcrypt (passlib) |

### Project Structure (Required)

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py          # MUST export create_app() function
│   ├── config.py        # Settings from environment
│   ├── database.py      # MUST export: engine, async_session_maker, get_db, Base
│   ├── models.py        # SQLAlchemy models
│   ├── routers/        # API endpoints
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
│       └── business_logic.py
├── tests/
├── requirements.txt
└── pyproject.toml
```

---

## 2. CRITICAL: main.py Requirements

**This is required by the test suite.**

```python
# app/main.py - EXACTLY THIS PATTERN
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import (
    auth, theaters, productions, schedule, bulletin,
    members, invite, conflicts, cast_profile, chat
)

def create_app() -> FastAPI:
    """Create and configure the FastAPI application.
    
    REQUIRED by tests: from app.main import create_app
    """
    app = FastAPI(
        title="Digital Call Board API",
        version="1.0.0"
    )
    
    # CORS - allow frontend
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Include ALL routers
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
    
    @app.get("/api/health")
    async def health_check():
        return {"status": "ok"}
    
    return app

# Required for uvicorn
app = create_app()
```

---

## 3. CRITICAL: database.py Requirements

**This is required by tests.**

```python
# app/database.py - EXACTLY THIS PATTERN
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from typing import AsyncGenerator
import os

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://callboard:callboard_dev@localhost:5432/callboard"
)

engine = create_async_engine(DATABASE_URL, echo=False)

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
```

---

## 4. API Endpoints (Complete List)

| Method | Path | Description | Auth | Role |
|--------|------|-------------|------|------|
| **Auth** |||||
| POST | /api/auth/register | Register user | No | - |
| POST | /api/auth/login | Login | No | - |
| POST | /api/auth/logout | Logout | Yes | all |
| POST | /api/auth/logout-all | Logout all devices | Yes | all |
| GET | /api/auth/me | Get current user | Yes | all |
| POST | /api/auth/forgot-password | Request password reset | No | - |
| POST | /api/auth/reset-password | Reset password | No | - |
| POST | /api/auth/verify-email | Verify email | No | - |
| POST | /api/auth/complete-profile | Age gate for Google users | Yes | all |
| DELETE | /api/auth/account | Delete account | Yes | all |
| **Theaters** |||||
| POST | /api/theaters | Create theater | Yes | director |
| GET | /api/theaters | List theaters | Yes | director |
| GET | /api/theaters/{id} | Get theater | Yes | director |
| PUT | /api/theaters/{id} | Update theater | Yes | director |
| DELETE | /api/theaters/{id} | Delete theater | Yes | director |
| **Productions** |||||
| POST | /api/productions | Create production | Yes | director |
| GET | /api/productions | List productions | Yes | all |
| GET | /api/productions/{id} | Get production | Yes | member |
| PUT | /api/productions/{id} | Update production | Yes | director/staff |
| DELETE | /api/productions/{id} | Delete production | Yes | director |
| **Schedule** |||||
| POST | /api/productions/{id}/schedule | Generate schedule | Yes | director |
| GET | /api/productions/{id}/schedule | Get schedule | Yes | member |
| POST | /api/productions/{id}/schedule/dates | Add date | Yes | director/staff |
| PUT | /api/productions/{id}/schedule/dates/{date_id} | Update date | Yes | director/staff |
| DELETE | /api/productions/{id}/schedule/dates/{date_id} | Delete date | Yes | director/staff |
| **Bulletin** |||||
| GET | /api/productions/{id}/bulletin | Get posts | Yes | member |
| POST | /api/productions/{id}/bulletin | Create post | Yes | director/staff |
| PUT | /api/productions/{id}/bulletin/{post_id} | Update post | Yes | author |
| DELETE | /api/productions/{id}/bulletin/{post_id} | Delete post | Yes | author/director |
| POST | /api/productions/{id}/bulletin/{post_id}/pin | Pin post | Yes | director/staff |
| **Members** |||||
| GET | /api/productions/{id}/members | List members | Yes | director/staff |
| PUT | /api/productions/{id}/members/{user_id} | Update role | Yes | director |
| DELETE | /api/productions/{id}/members/{user_id} | Remove member | Yes | director |
| DELETE | /api/productions/{id}/members/{user_id}/conflicts | Reset conflicts | Yes | director |
| **Conflicts** |||||
| GET | /api/productions/{id}/conflicts | Get conflicts | Yes | director/staff (all), cast (personal) |
| POST | /api/productions/{id}/conflicts | Submit conflicts | Yes | cast |
| **Cast Profile** |||||
| GET | /api/productions/{id}/profile | Get profile | Yes | cast |
| POST | /api/productions/{id}/profile | Create profile | Yes | cast |
| PUT | /api/productions/{id}/profile | Update profile | Yes | cast |
| DELETE | /api/productions/{id}/profile | Delete profile | Yes | cast |
| **Invite** |||||
| GET | /api/invite/{token} | Validate token | No | - |
| POST | /api/invite/join | Join via token | No | - |
| **Chat** |||||
| GET | /api/chat/conversations | List conversations | Yes | member |
| POST | /api/chat/conversations | Create conversation | Yes | member |
| GET | /api/chat/conversations/{id}/messages | Get messages | Yes | participant |
| POST | /api/chat/conversations/{id}/messages | Send message | Yes | participant |
| DELETE | /api/chat/messages/{id} | Delete message | Yes | owner/director |
| POST | /api/chat/conversations/{id}/mark-read | Mark read | Yes | participant |
| **Health** |||||
| GET | /api/health | Health check | No | - |

---

## 5. Data Models

### Users

```python
class User(Base):
    id: UUID (PK)
    email: str (unique, max 320)
    name: str (max 200)
    password_hash: str (nullable)
    google_id: str (unique, nullable)
    email_verified: bool
    avatar_url: str (nullable)
    age_range: str ('13-17' or '18+', nullable)
    token_version: int (default 0)
    failed_login_attempts: int (default 0)
    locked_until: datetime (nullable)
    created_at: datetime
    updated_at: datetime
```

### Theaters

```python
class Theater(Base):
    id: UUID (PK)
    owner_id: UUID (FK users)
    name: str (max 200)
    city: str (max 100)
    state: str (max 100)
    created_at: datetime
```

### Productions

```python
class Production(Base):
    id: UUID (PK)
    theater_id: UUID (FK theaters)
    name: str (max 200)
    estimated_cast_size: int
    first_rehearsal: date
    opening_night: date
    closing_night: date
    is_archived: bool
    archived_at: datetime (nullable)
    created_at: datetime
    updated_at: datetime
```

### Production Members

```python
class ProductionMember(Base):
    id: UUID (PK)
    production_id: UUID (FK productions)
    user_id: UUID (FK users)
    role: str ('director', 'staff', 'cast')
    joined_at: datetime
    # UNIQUE(production_id, user_id)
```

### Invite Tokens

```python
class InviteToken(Base):
    id: UUID (PK)
    production_id: UUID (FK productions)
    token: str (unique)
    expires_at: datetime
    max_uses: int
    use_count: int (default 0)
    created_at: datetime
```

### Rehearsal Dates

```python
class RehearsalDate(Base):
    id: UUID (PK)
    production_id: UUID (FK productions)
    date: date
    start_time: time
    end_time: time
    type: str ('regular', 'tech', 'dress', 'performance')
    note: str (max 1000, nullable)
    is_cancelled: bool (default False)
    is_deleted: bool (default False)
```

### Bulletin Posts

```python
class BulletinPost(Base):
    id: UUID (PK)
    production_id: UUID (FK productions)
    author_id: UUID (FK users)
    title: str (max 200)
    body: str (max 10000, Markdown)
    is_pinned: bool (default False)
    created_at: datetime
    updated_at: datetime
```

### Cast Profiles

```python
class CastProfile(Base):
    id: UUID (PK)
    production_id: UUID (FK productions)
    user_id: UUID (FK users)
    display_name: str (max 200)
    phone: str (max 20, nullable)
    role_character: str (max 200, nullable)
    headshot_url: str (nullable)
    created_at: datetime
    updated_at: datetime
    # UNIQUE(production_id, user_id)
```

### Conflict Submissions

```python
class ConflictSubmission(Base):
    id: UUID (PK)
    production_id: UUID (FK productions)
    user_id: UUID (FK users)
    submitted_at: datetime
    # UNIQUE(production_id, user_id)

class CastConflict(Base):
    id: UUID (PK)
    production_id: UUID (FK productions)
    user_id: UUID (FK users)
    rehearsal_date_id: UUID (FK rehearsal_dates)
    reason: str (max 500, nullable)
    submitted_at: datetime
    # UNIQUE(user_id, rehearsal_date_id)
```

### Conversations & Messages

```python
class Conversation(Base):
    id: UUID (PK)
    production_id: UUID (FK productions)
    created_at: datetime

class ConversationParticipant(Base):
    id: UUID (PK)
    conversation_id: UUID (FK conversations)
    user_id: UUID (FK users)
    # UNIQUE(conversation_id, user_id)

class Message(Base):
    id: UUID (PK)
    conversation_id: UUID (FK conversations)
    sender_id: UUID (FK users)
    body: str (max 2000)
    is_read: bool (default False)
    is_deleted: bool (default False)
    created_at: datetime
```

---

## 6. Error Response Format

All errors follow this format:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable message"
}
```

With optional fields for validation:

```json
{
  "error": "VALIDATION_ERROR",
  "message": "Invalid input",
  "fields": [
    {"field": "email", "message": "Must be valid email"}
  ]
}
```

Error codes:
- `VALIDATION_ERROR` - 400
- `UNAUTHORIZED` - 401
- `FORBIDDEN` - 403
- `NOT_FOUND` - 404
- `CONFLICT` - 409
- `RATE_LIMITED` - 429
- `INTERNAL_ERROR` - 500

---

## 7. Permission Matrix

| Action | Director | Staff | Cast |
|--------|----------|-------|------|
| Create theater | ✓ | ✗ | ✗ |
| Create production | ✓ | ✗ | ✗ |
| Edit production | ✓ | ✓ | ✗ |
| Edit schedule | ✓ | ✓ | ✗ |
| Post bulletin | ✓ | ✓ | ✗ |
| View bulletin | ✓ | ✓ | ✓ |
| View all conflicts | ✓ | ✓ | ✗ |
| Submit conflicts | ✗ | ✗ | ✓ (once) |
| Chat with anyone | ✓ | ✓ | ✗ |
| Chat with director/staff | ✓ | ✓ | ✓ |
| Chat with cast | ✗ | ✗ | ✗ |
| Elevate/demote | ✓ | ✗ | ✗ |
| Remove member | ✓ | ✗ | ✗ |
| Reset conflicts | ✓ | ✗ | ✗ |
| Generate invite | ✓ | ✓ | ✗ |
| Delete production | ✓ | ✗ | ✗ |

---

## 8. Key Business Logic Functions

### From app/services/business_logic.py:

```python
# Age Gate
check_age_gate(dob: date, reference_date: date) -> {"allowed": bool}
derive_age_range(dob: date, reference_date: date) -> str  # "13-17" or "18+"

# Password Validation
validate_password(password: str) -> {"valid": bool, "reason": str}

# Permissions
check_permission(role: str, action: str) -> bool

# Chat
can_send_message(sender_role: str, recipient_role: str) -> bool

# Date Validation
validate_production_dates(first_rehearsal, opening_night, closing_night) -> {"valid": bool}

# Sanitization
sanitize_markdown(text: str) -> str

# Field Validation
validate_field_lengths(field_name: str, value: str) -> {"valid": bool}

# Schedule Generation
generate_schedule(...) -> {"dates": [...], "warnings": [...]} or {"error": str}
```

---

## 9. Requirements.txt

```
fastapi>=0.115.0
uvicorn[standard]>=0.34.0
sqlalchemy[asyncio]>=2.0.0
asyncpg>=0.30.0
alembic>=1.14.0
pydantic>=2.10.0
pydantic-settings>=2.7.0
python-jose[cryptography]>=3.3.0
passlib[bcrypt]>=1.7.4
python-multipart>=0.0.18
httpx>=0.28.0
markdown-it-py>=3.0.0
bleach>=6.2.0

pytest>=8.3.0
pytest-asyncio>=0.25.0
pytest-cov>=6.0.0
factory-boy>=3.3.0
freezegun>=1.4.0
```

---

## 10. Test Suite Requirements

Tests expect these imports:

```python
# tests/conftest.py
from app.main import create_app  # CRITICAL
from app.database import get_db, Base, engine, async_session_maker

# Test execution
pytest tests/ -v
```

All tests must pass with:
```bash
source .venv/bin/activate
python -m pytest tests/ -v
```