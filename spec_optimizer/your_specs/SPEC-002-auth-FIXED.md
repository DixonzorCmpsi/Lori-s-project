# SPEC-002-AUTH-FIXED: Authentication & Authorization (FastAPI)

**Status:** Draft
**Last Updated:** 2026-03-23
**Depends On:** SPEC-001

---

## Goals (Immutable)

- Implement FastAPI with SQLAlchemy async for all database operations
- Implement JWT-based authentication (NOT NextAuth.js)
- Implement invite link system with 30-day expiry and configurable max uses per token
- Use JWT with a `token_version` column on the `users` table to enable server-side invalidation (password reset, logout-all)
- Implement password reset flow with 1-hour expiry, single-use hashed tokens, and full session invalidation via `token_version` increment
- Implement account lockout after 10 failed attempts within 15 minutes (30-minute lock duration)
- Implement anti-enumeration: login and registration endpoints return identical responses regardless of email existence
- Implement age gate at registration blocking users under 13 and storing only age range (not raw DOB)
- Enforce RBAC middleware on every protected route: authenticate session, verify production membership, verify role permission

## Non-Goals (Explicit Exclusions)

- NextAuth.js or any Next.js authentication - this is a FastAPI backend
- Magic link (passwordless email) auth
- SMS/phone auth
- Social login other than Google (OAuth2)
- 2FA/MFA
- SSO/SAML

## Success Metric

No unauthenticated request can access protected data. No user can perform an action their role does not permit. No timing difference or response variation reveals whether an email exists in the system.

## Immutable Constraints

- bcrypt cost factor 12 for all password hashing
- JWT strategy with token stored in Authorization header (not cookies for API)
- Invite tokens are minimum 32 characters, cryptographically random, URL-safe
- Rate limit: 5 login attempts per minute per IP. Returns 429
- Account lockout: 10 failed attempts within 15 minutes triggers 30-minute lock
- CORS enabled for frontend origin

---

## 1. Overview

The Digital Call Board supports email + password authentication with JWT tokens.

## 2. App Structure (CRITICAL - MUST IMPLEMENT)

### 2.1 main.py Requirements

The `app/main.py` file MUST export a `create_app()` function that returns a FastAPI application instance.

```python
# app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import auth, theaters, productions, schedule, bulletin, members, invite, conflicts, cast_profile, chat

def create_app() -> FastAPI:
    app = FastAPI(title="Digital Call Board API")
    
    # CORS - allow frontend
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://localhost:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Include routers
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
```

**This is NOT optional. The test suite imports `from app.main import create_app`.**

### 2.2 Database Module Requirements

The `app/database.py` file MUST have:
- `engine` - async engine instance
- `async_session_maker` - session maker
- `get_db` - dependency for getting database sessions
- `Base` - SQLAlchemy declarative base

```python
# app/database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

DATABASE_URL = "postgresql+asyncpg://..."

engine = create_async_engine(DATABASE_URL, echo=False)
async_session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with async_session_maker() as session:
        yield session
```

---

## 3. Auth Flows

### 3.1 Registration Flow

```
User enters: name, email, date of birth, password
  -> Age gate: if DOB indicates under 13, block registration immediately
  -> If 13+: derive age_range ("13-17" or "18+"), discard raw DOB
  -> Server creates user record
  -> Send verification email
  -> Return user without requiring verification for login (but with limited access)
```

### 3.2 Login Flow

```
User enters email + password
  -> Server validates credentials
  -> bcrypt compare against stored hash
  -> Server creates JWT token
  -> Return token in response
```

**Requirements:**
- Passwords hashed with **bcrypt** (cost factor 12)
- Minimum password length: 8 characters
- Password MUST be checked against a bundled list of the top 10,000 breached passwords
- Per-IP rate limit: 5 login attempts per minute per IP
- Per-account lockout: After 10 failed login attempts within 15 minutes, lock the account for 30 minutes
- Anti-enumeration: Login endpoint MUST return identical error responses for "email not found" and "wrong password"

### 3.3 JWT Token Structure

```python
{
    "sub": user_id,
    "token_version": 0,
    "exp": expiration_timestamp
}
```

### 3.4 Password Reset Flow

```
User clicks "Forgot password?"
  -> Enters email address
  -> Server sends a password reset email (regardless of whether email exists — anti-enumeration)
  -> User clicks link, enters new password
  -> Server validates token, updates password hash, invalidates ALL existing sessions
```

**Requirements:**
- Reset token: 256-bit cryptographically random
- Token hashed with SHA-256 before storage
- Token expires after **1 hour**
- Token is single-use
- All existing sessions invalidated on reset (token_version incremented)

---

## 4. Authorization (Role-Based Access Control)

### 4.1 Roles

| Role | Level | Assigned By | Entry Path |
|------|-------|-------------|------------|
| Director | Owner | Self (account creator) | Registers directly |
| Staff | Admin | Director elevates a Cast member | Invite link -> Cast -> Elevated |
| Cast | Member | Joins via invite link | Invite link (default role) |

### 4.2 Permission Matrix

| Action | Director | Staff | Cast |
|--------|----------|-------|------|
| Create theater/school | Yes | No | No |
| Create production | Yes | No | No |
| Edit production details | Yes | Yes | No |
| Edit schedule | Yes | Yes | No |
| Post to bulletin board | Yes | Yes | No |
| View bulletin board | Yes | Yes | Yes |
| View full cast conflicts | Yes | Yes | No |
| Submit personal conflicts | No | No | Yes (once) |
| View personal schedule | Yes | Yes | Yes |
| Chat with anyone | Yes | Yes | No |
| Chat with Staff/Director | Yes | Yes | Yes |
| Chat with other Cast | No | No | No |
| Elevate Cast to Staff | Yes | No | No |
| Demote Staff to Cast | Yes | No | No |
| Remove member from production | Yes | No | No |
| Reset cast member's conflicts | Yes | No | No |
| Generate invite link | Yes | Yes | No |
| Delete production | Yes | No | No |

### 4.3 Middleware

Every protected route checks:
1. Is the user authenticated? (valid JWT token)
2. Does the user belong to this production?
3. Does the user's role permit this action?

If step 1 fails, return `401 UNAUTHORIZED`. If step 2 fails, return `403 FORBIDDEN`. If step 3 fails, return `403 FORBIDDEN`.

### 4.4 API Error Response Format

All API endpoints MUST return errors in a consistent JSON format:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable description"
}
```

**Standard error codes:**

| HTTP Status | Error Code | When |
|-------------|------------|------|
| 400 | `VALIDATION_ERROR` | Invalid input |
| 401 | `UNAUTHORIZED` | No valid session, invalid credentials |
| 403 | `FORBIDDEN` | Valid session but insufficient role/permission |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Duplicate resource |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unhandled server error |

---

## 5. Database Schema (Auth-Related)

```sql
CREATE TABLE users (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                 TEXT UNIQUE NOT NULL CHECK (char_length(email) <= 320),
  name                  TEXT NOT NULL CHECK (char_length(name) <= 200),
  password_hash         TEXT,
  google_id             TEXT UNIQUE,
  email_verified        BOOLEAN DEFAULT FALSE,
  avatar_url            TEXT,
  age_range             TEXT CHECK (age_range IS NULL OR age_range IN ('13-17', '18+')),
  token_version         INTEGER NOT NULL DEFAULT 0,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE productions (id UUID PRIMARY KEY);

CREATE TABLE production_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id UUID NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL DEFAULT 'cast' CHECK (role IN ('director', 'staff', 'cast')),
  joined_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(production_id, user_id)
);

CREATE TABLE password_reset_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT UNIQUE NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE email_verification_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE invite_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id UUID NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  token         TEXT UNIQUE NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  max_uses      INTEGER NOT NULL DEFAULT 100,
  use_count     INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 6. API Endpoints (Complete List)

| Method | Path | Description | Auth Required |
|--------|------|-------------|----------------|
| POST | /api/auth/register | Register new user | No |
| POST | /api/auth/login | Login with email/password | No |
| POST | /api/auth/logout | Logout | Yes |
| POST | /api/auth/logout-all | Logout all devices | Yes |
| GET | /api/auth/me | Get current user | Yes |
| POST | /api/auth/forgot-password | Request password reset | No |
| POST | /api/auth/reset-password | Reset password with token | No |
| POST | /api/auth/verify-email | Verify email with token | No |
| POST | /api/auth/complete-profile | Complete profile (age gate) | Yes |
| DELETE | /api/auth/account | Delete account | Yes |
| POST | /api/theaters | Create theater | Yes |
| GET | /api/theaters | List user's theaters | Yes |
| GET | /api/theaters/{id} | Get theater details | Yes |
| PUT | /api/theaters/{id} | Update theater | Yes |
| DELETE | /api/theaters/{id} | Delete theater | Yes |
| POST | /api/productions | Create production | Yes |
| GET | /api/productions | List productions | Yes |
| GET | /api/productions/{id} | Get production details | Yes |
| PUT | /api/productions/{id} | Update production | Yes |
| DELETE | /api/productions/{id} | Delete production | Yes |
| POST | /api/productions/{id}/schedule | Generate schedule | Yes |
| GET | /api/productions/{id}/schedule | Get schedule | Yes |
| POST | /api/productions/{id}/schedule/dates | Add rehearsal date | Yes |
| PUT | /api/productions/{id}/schedule/dates/{date_id} | Update rehearsal date | Yes |
| DELETE | /api/productions/{id}/schedule/dates/{date_id} | Delete rehearsal date | Yes |
| GET | /api/productions/{id}/bulletin | Get bulletin posts | Yes |
| POST | /api/productions/{id}/bulletin | Create bulletin post | Yes |
| PUT | /api/productions/{id}/bulletin/{post_id} | Update post | Yes |
| DELETE | /api/productions/{id}/bulletin/{post_id} | Delete post | Yes |
| POST | /api/productions/{id}/bulletin/{post_id}/pin | Pin post | Yes |
| GET | /api/productions/{id}/members | List members | Yes |
| POST | /api/productions/{id}/members | Add member | Yes |
| PUT | /api/productions/{id}/members/{user_id} | Update member role | Yes |
| DELETE | /api/productions/{id}/members/{user_id} | Remove member | Yes |
| DELETE | /api/productions/{id}/members/{user_id}/conflicts | Reset conflicts | Yes |
| GET | /api/productions/{id}/conflicts | Get conflicts (aggregated for director, personal for cast) | Yes |
| POST | /api/productions/{id}/conflicts | Submit conflicts | Yes (cast only) |
| GET | /api/productions/{id}/profile | Get cast profile | Yes |
| POST | /api/productions/{id}/profile | Create/update cast profile | Yes |
| DELETE | /api/productions/{id}/profile | Delete cast profile | Yes |
| POST | /api/invite/join | Join production via invite | No |
| GET | /api/invite/{token} | Validate invite token | No |
| GET | /api/chat/conversations | List conversations | Yes |
| POST | /api/chat/conversations | Create conversation | Yes |
| GET | /api/chat/conversations/{id}/messages | Get messages | Yes |
| POST | /api/chat/conversations/{id}/messages | Send message | Yes |
| DELETE | /api/chat/messages/{id} | Delete message | Yes |
| POST | /api/chat/conversations/{id}/mark-read | Mark as read | Yes |
| GET | /api/health | Health check | No |

---

## 7. Test Scenarios

| ID | Scenario | Expected Result |
|----|----------|-----------------|
| AUTH-01 | Register with email/password | User created, verification email sent |
| AUTH-02 | Login with correct password | Token returned |
| AUTH-03 | Login with wrong password | 401 "Invalid email or password" |
| AUTH-04 | Login rate limit exceeded (5/min/IP) | 429 Too Many Requests |
| AUTH-05 | Access protected route without session | 401 redirect to login |
| AUTH-06 | User clicks invite link, not logged in | Redirect to login, then auto-join as Cast |
| AUTH-07 | Director generates new invite link | Token created |
| AUTH-08 | Cast tries to access Director-only route | 403 Forbidden |
| AUTH-09 | Password reset happy path | Token emailed, new password set, sessions invalidated |
| AUTH-10 | Password reset with expired token | 400 "Reset link has expired" |
| AUTH-11 | Account lockout after 10 failed attempts | Account locked 30 min |
| AUTH-12 | Log out all devices | All sessions invalidated |
| AUTH-13 | Login with non-existent email | 401 "Invalid email or password" |
| AUTH-14 | Register with email that already exists | "Check your email for verification" (no leak) |
| AUTH-15 | Register with common breached password | Rejected: "This password is too common" |
| AUTH-16 | Invite link expired | Error: "This invite link has expired" |
| AUTH-17 | Invite link max uses reached | Error: "This invite link is no longer available" |
| AUTH-18 | Director elevates Cast to Staff | Role updated in production_members |
| AUTH-19 | Director demotes Staff to Cast | Role updated to cast |
| AUTH-20 | Director removes member from production | Member row deleted |
| AUTH-21 | User under 13 tries to register | Blocked at age gate |
| AUTH-22 | Email verification happy path | email_verified set to true |
| AUTH-23 | Unverified user tries to access protected endpoints | 401 with message |