# SPEC-TEST: Test Configuration

**Status:** Draft
**Last Updated:** 2026-03-23
**Depends On:** SPEC-002, SPEC-008

---

## Goals (Immutable)

- Ensure all backend tests run without environment setup errors
- Define explicit database initialization in conftest.py
- Ensure SQLAlchemy models are imported before table creation

## Immutable Constraints

- All SQLAlchemy models MUST be imported in conftest.py before `Base.metadata.create_all()` is called
- Test database MUST use in-memory SQLite with tables created per test session
- All test fixtures MUST be properly awaited for async tests

---

## 1. Test Database Configuration

### 1.1 conftest.py Database Setup

The test conftest.py MUST import all models before creating tables:

```python
# tests/conftest.py - IMPORTS MUST COME FIRST
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import DeclarativeBase

# Import ALL models before Base.metadata.create_all()
# This is REQUIRED - models register themselves with Base.metadata
from app.models import (
    User,
    Theater,
    Production,
    RehearsalDate,
    ProductionMember,
    CastProfile,
    ConflictSubmission,
    CastConflict,
    BulletinPost,
    InviteToken,
    Conversation,
    ConversationParticipant,
    Message,
    PasswordResetToken,
    EmailVerificationToken,
)

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


@pytest_asyncio.fixture
async def db_session():
    """Create a database session for testing."""
    from app.database import Base
    
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async with TestSessionLocal() as session:
        yield session
        await session.rollback()
    
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
```

### 1.2 Model Registration

Each model file MUST ensure models are registered with Base:

```python
# app/models.py
from app.database import Base

class User(Base):
    __tablename__ = "users"
    # ... columns
```

## 6. Test Database Setup (Critical)

### 6.1 Model Import Requirement

**THIS IS MANDATORY** - All SQLAlchemy models MUST be imported in conftest.py BEFORE `Base.metadata.create_all()` is called. This is the most common cause of test failures.

**WRONG (causes "no such table" errors):**
```python
# conftest.py - BROKEN
from app.database import Base  # Base has no knowledge of models

async def db_session():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)  # Creates ZERO tables
```

**CORRECT:**
```python
# conftest.py - WORKS
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.pool import StaticPool

# IMPORTS MUST COME FIRST - register all models with Base.metadata
from app.models import User, Theater, Production, RehearsalDate
from app.models import ProductionMember, CastProfile, ConflictSubmission, CastConflict
from app.models import BulletinPost, InviteToken
from app.models import Conversation, ConversationParticipant, Message
from app.models import PasswordResetToken, EmailVerificationToken
from app.database import Base

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)

TestSessionLocal = async_sessionmaker(
    test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

@pytest_asyncio.fixture
async def db_session():
    """Create database session with all tables."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)  # Creates ALL tables now
    
    async with TestSessionLocal() as session:
        yield session
        await session.rollback()
    
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
```

### 6.2 Why This Matters

SQLAlchemy's declarative base (`Base`) only knows about models that have been imported. Each model file should have:
```python
from app.database import Base

class MyModel(Base):
    __tablename__ = "my_models"
    # ...
```

When you import `MyModel`, it registers with `Base.metadata`. But if you never import `MyModel` before calling `Base.metadata.create_all()`, the table won't be created.

### 6.3 App Factory Pattern

If using an app factory, ensure models are imported:
```python
# app/__init__.py or app/main.py
from app.database import Base
from app.models import *  # Import all models to register with Base
```

---

## 7. Test Execution

### 7.1 Run All Tests

```bash
cd backend
source .venv/bin/activate
pytest tests/ -v --tb=short
```

### 7.2 Run Unit Tests Only

```bash
pytest tests/unit/ -v
```

### 7.3 Run Integration Tests Only

```bash
pytest tests/integration/ -v
```

### 7.4 Expected Results

| Test Suite | Expected | Actual (After Fix) |
|------------|----------|-------------------|
| tests/unit/test_spec_validation.py | 89 pass | 89 pass |
| tests/unit/test_schedule_generator.py | All pass | All pass |
| tests/unit/test_auth_*.py | All pass | All pass |
| tests/integration/test_*.py | All pass | All pass |
| **Total** | **559 pass** | **559 pass** |

---

## 4. API Error Response Format

All API endpoints MUST return consistent error format:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description"
}
```

| HTTP Status | Error Code | Description |
|------------|------------|-------------|
| 400 | VALIDATION_ERROR | Invalid input |
| 401 | UNAUTHORIZED | No valid session |
| 403 | FORBIDDEN | Insufficient role/permission |
| 404 | NOT_FOUND | Resource not found |
| 409 | CONFLICT | Duplicate resource |
| 429 | RATE_LIMITED | Too many requests |

---

## 5. Implementation Validation

### 5.1 Pure Functions

The following functions MUST be implemented in `implementation.py`:

| Function | Purpose |
|----------|---------|
| generate_schedule() | Deterministic schedule from wizard inputs |
| check_age_gate() | COPPA age validation |
| derive_age_range() | Age range derivation |
| validate_password() | Password security rules |
| check_permission() | RBAC permission check |
| can_send_message() | Chat boundary enforcement |
| validate_production_dates() | Date ordering validation |
| sanitize_markdown() | XSS prevention |
| validate_field_lengths() | Max length constraints |
| validate_invite_token() | Token expiry/use validation |

### 5.2 Tests Pass Criteria

- **SPEC tests:** 89/89 pass (pure function validation)
- **Integration tests:** All tests pass when database is properly initialized
- **No import errors:** All models imported before use
- **No table errors:** Base.metadata.create_all() creates all tables
