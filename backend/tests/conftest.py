"""Test configuration and fixtures for Digital Call Board backend."""

import os
import uuid
import hashlib
import asyncio
from datetime import date, datetime, time, timedelta
from typing import Any, AsyncGenerator, Generator, Callable

import pytest
import pytest_asyncio
from fastapi import Request, HTTPException, status
from httpx import ASGITransport, AsyncClient
from jose import jwt, JWTError
from sqlalchemy import select, event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

TEST_SECRET = "test-secret-for-testing-purposes-only"

# ---------------------------------------------------------------------------
# Well-known test IDs --- deterministic UUIDs from string names
# ---------------------------------------------------------------------------

def str_to_uuid(s: str) -> str:
    """Convert a string to a deterministic UUID.
    Used for user IDs from JWT tokens."""
    return str(uuid.UUID(bytes=hashlib.sha256(s.encode()).digest()[:16]))

# Pre-compute well-known IDs
# User IDs use UUID conversion (since JWTs contain the raw string, and
# test_get_current_user converts to UUID for DB lookup)
DIRECTOR_USER_ID = str_to_uuid("director-id")
STAFF_USER_ID = str_to_uuid("staff-member-id")
CAST_USER_ID = str_to_uuid("cast-member-id")
OTHER_CAST_USER_ID = str_to_uuid("other-cast-user-id")
OUTSIDER_USER_ID = str_to_uuid("outsider-id")

# Production/theater/date IDs also use UUID conversion for DB consistency.
# The conftest adds URL rewriting middleware so tests can use raw strings
# like "prod-id" in URLs and they get mapped to the UUID version.
THEATER_ID = str_to_uuid("theater-id")
PRODUCTION_ID = str_to_uuid("prod-id")

# Map of test user-id strings to their roles in the default production
ROLE_MAP = {
    "director-id": "director",
    "director-a-id": "director",
    "staff-id": "staff",
    "staff-member-id": "staff",
    "staff-to-be-id": "cast",  # starts as cast
    "cast-id": "cast",
    "cast-member-id": "cast",
    "cast-member-1": "cast",
    "cast-member-2": "cast",
    "other-cast-user-id": "cast",
    "other-cast-id": "cast",
    "some-cast-id": "cast",
}

# Users NOT in the default production
NON_MEMBERS = {"outsider-id", "non-member-id", "other-user-id", "prod-a-member", "non-member-id"}


# ---------------------------------------------------------------------------
# Shared engine & session maker (one connection for all tests, uses Supabase)
# ---------------------------------------------------------------------------

from dotenv import load_dotenv as _load_dotenv
_load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

_raw_url = os.environ.get("DATABASE_URL", "")
if _raw_url.startswith("postgresql://"):
    _db_url = _raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)
elif _raw_url.startswith("postgresql+asyncpg://"):
    _db_url = _raw_url
else:
    raise RuntimeError(f"Tests require a PostgreSQL DATABASE_URL, got: {_raw_url!r}")


# ---------------------------------------------------------------------------
# Re-seed production data after the entire test session
# ---------------------------------------------------------------------------

@pytest.fixture(scope="session", autouse=True)
def reseed_after_tests():
    """Re-seed production data after all tests complete."""
    yield
    # After all tests, re-seed the database
    import subprocess, sys
    backend_dir = os.path.dirname(__file__) + "/.."
    subprocess.run(
        [sys.executable, "seed_data.py"],
        cwd=backend_dir,
        capture_output=True,
    )
    subprocess.run(
        [sys.executable, "seed_admin.py"],
        cwd=backend_dir,
        capture_output=True,
    )


# ---------------------------------------------------------------------------
# App instance fixture --- uses real PostgreSQL with per-test cleanup
# ---------------------------------------------------------------------------

async def _create_app_instance():
    """Core setup: create test app with clean DB."""
    engine = create_async_engine(_db_url, pool_pre_ping=True, pool_size=5, max_overflow=10)
    session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    # Patch all modules that use the DB engine/session
    import app.database as db_mod
    db_mod.engine = engine
    db_mod.async_session_maker = session_maker

    import app.routers.auth as auth_mod
    auth_mod.async_session_maker = session_maker
    from app.config import Settings
    auth_mod.settings = Settings(database_url=_db_url, nextauth_secret=TEST_SECRET)

    # Patch all routers that import async_session_maker directly
    for mod_name in [
        "app.routers.theaters", "app.routers.productions", "app.routers.bulletin",
        "app.routers.schedule", "app.routers.conflicts", "app.routers.members",
        "app.routers.invite", "app.routers.chat", "app.routers.cast_profile",
        "app.routers.join",
    ]:
        try:
            import importlib
            mod = importlib.import_module(mod_name)
            if hasattr(mod, "async_session_maker"):
                mod.async_session_maker = session_maker
            if hasattr(mod, "_chat_rate_limits"):
                mod._chat_rate_limits.clear()
        except ImportError:
            pass

    from app.database import Base
    from app.models import User, Theater, Production, ProductionMember, RehearsalDate

    # Create tables (idempotent) and seed data
    async def setup_db():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        # Clean all tables before seeding using TRUNCATE CASCADE
        async with engine.begin() as conn:
            from sqlalchemy import text
            await conn.execute(text(
                "TRUNCATE TABLE messages, conversation_participants, conversations, "
                "cast_conflicts, conflict_submissions, attendance, "
                "scene_roles, scenes, cast_profiles, invite_tokens, "
                "bulletin_posts, rehearsal_dates, production_members, productions, "
                "theaters, chat_rate_limits, password_reset_tokens, "
                "email_verification_tokens, users CASCADE"
            ))

        async with session_maker() as session:
            # Create director user
            director = User(
                id=DIRECTOR_USER_ID,
                email="director-id@test.example.com",
                name="Test Director",
                password_hash="$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.BNANJCHD0H0Hq",
                age_range="18+",
                email_verified=True,
                token_version=0,
            )
            session.add(director)

            # Create theater
            theater = Theater(
                id=THEATER_ID,
                owner_id=DIRECTOR_USER_ID,
                name="Test Theater",
                city="Springfield",
                state="IL",
            )
            session.add(theater)

            # Create production
            today = date.today()
            production = Production(
                id=PRODUCTION_ID,
                theater_id=THEATER_ID,
                name="Test Production",
                estimated_cast_size=30,
                first_rehearsal=today + timedelta(days=30),
                opening_night=today + timedelta(days=90),
                closing_night=today + timedelta(days=97),
            )
            session.add(production)

            # Create director membership
            session.add(ProductionMember(
                id=str(uuid.uuid4()),
                production_id=PRODUCTION_ID,
                user_id=DIRECTOR_USER_ID,
                role="director",
            ))

            # Create staff user + membership
            staff = User(
                id=STAFF_USER_ID,
                email="staff-member-id@test.example.com",
                name="Test Staff",
                password_hash="$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.BNANJCHD0H0Hq",
                age_range="18+",
                email_verified=True,
                token_version=0,
            )
            session.add(staff)
            session.add(ProductionMember(
                id=str(uuid.uuid4()),
                production_id=PRODUCTION_ID,
                user_id=STAFF_USER_ID,
                role="staff",
            ))

            # Create cast user + membership
            cast = User(
                id=CAST_USER_ID,
                email="cast-member-id@test.example.com",
                name="Test Cast",
                password_hash="$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.BNANJCHD0H0Hq",
                age_range="18+",
                email_verified=True,
                token_version=0,
            )
            session.add(cast)
            session.add(ProductionMember(
                id=str(uuid.uuid4()),
                production_id=PRODUCTION_ID,
                user_id=CAST_USER_ID,
                role="cast",
            ))

            # Create a second cast member
            cast2 = User(
                id=OTHER_CAST_USER_ID,
                email="other-cast@test.example.com",
                name="Other Cast",
                password_hash="$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.BNANJCHD0H0Hq",
                age_range="18+",
                email_verified=True,
                token_version=0,
            )
            session.add(cast2)
            session.add(ProductionMember(
                id=str(uuid.uuid4()),
                production_id=PRODUCTION_ID,
                user_id=OTHER_CAST_USER_ID,
                role="cast",
            ))

            # Create additional cast members for boundary tests
            for cast_name in ["cast-member-1", "cast-member-2", "some-cast-id", "other-cast-id"]:
                cid = str_to_uuid(cast_name)
                u = User(
                    id=cid, email=f"{cast_name}@test.example.com", name=f"Cast {cast_name}",
                    password_hash="$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.BNANJCHD0H0Hq",
                    age_range="18+", email_verified=True, token_version=0,
                )
                session.add(u)
                session.add(ProductionMember(
                    id=str(uuid.uuid4()), production_id=PRODUCTION_ID, user_id=cid, role="cast",
                ))

            # Create a removable user
            removable = User(
                id=str_to_uuid("removable-user-id"), email="removable@test.example.com",
                name="Removable User",
                password_hash="$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.BNANJCHD0H0Hq",
                age_range="18+", email_verified=True, token_version=0,
            )
            session.add(removable)
            session.add(ProductionMember(
                id=str(uuid.uuid4()), production_id=PRODUCTION_ID,
                user_id=str_to_uuid("removable-user-id"), role="cast",
            ))

            # Create a Google OAuth user with age_range=None (incomplete profile)
            google_user = User(
                id=str_to_uuid("google-user-id"), email="google@test.example.com",
                name="Google User", google_id="google-sub-123",
                password_hash=None,
                age_range=None, email_verified=True, token_version=0,
            )
            session.add(google_user)

            # Create rehearsal dates for schedule/conflict tests
            date_names = ["date-1", "date-2", "date-3", "date-4", "date-5",
                          "date-id", "some-date-id"]
            for i, name in enumerate(date_names):
                rd = RehearsalDate(
                    id=str_to_uuid(name),
                    production_id=PRODUCTION_ID,
                    rehearsal_date=today + timedelta(days=30 + i * 3),
                    start_time=time(18, 0),
                    end_time=time(21, 0),
                    type="regular",
                )
                session.add(rd)

            # Create bulletin posts
            from app.models import BulletinPost
            post = BulletinPost(
                id=str_to_uuid("post-id"),
                production_id=PRODUCTION_ID,
                author_id=DIRECTOR_USER_ID,
                title="Test Post",
                body="Test post body",
                is_pinned=False,
            )
            session.add(post)

            staff_post = BulletinPost(
                id=str_to_uuid("staff-post-id"),
                production_id=PRODUCTION_ID,
                author_id=STAFF_USER_ID,
                title="Staff Post",
                body="Staff post body",
                is_pinned=False,
            )
            session.add(staff_post)

            post1 = BulletinPost(
                id=str_to_uuid("post-1"),
                production_id=PRODUCTION_ID,
                author_id=DIRECTOR_USER_ID,
                title="Post 1",
                body="Post 1 body",
                is_pinned=False,
            )
            session.add(post1)

            post2 = BulletinPost(
                id=str_to_uuid("post-2"),
                production_id=PRODUCTION_ID,
                author_id=DIRECTOR_USER_ID,
                title="Post 2",
                body="Post 2 body",
                is_pinned=False,
            )
            session.add(post2)

            own_post = BulletinPost(
                id=str_to_uuid("own-post-id"),
                production_id=PRODUCTION_ID,
                author_id=STAFF_USER_ID,
                title="Staff Own Post",
                body="Staff own post body",
                is_pinned=False,
            )
            session.add(own_post)

            any_post = BulletinPost(
                id=str_to_uuid("any-post-id"),
                production_id=PRODUCTION_ID,
                author_id=CAST_USER_ID,
                title="Any Post",
                body="Any post body",
                is_pinned=False,
            )
            session.add(any_post)

            dir_post = BulletinPost(
                id=str_to_uuid("director-post-id"),
                production_id=PRODUCTION_ID,
                author_id=DIRECTOR_USER_ID,
                title="Director Post",
                body="Director post body",
                is_pinned=False,
            )
            session.add(dir_post)

            # Create a conversation + messages for chat tests
            from app.models import Conversation, ConversationParticipant, Message
            conv = Conversation(
                id=str_to_uuid("conv-id"),
                production_id=PRODUCTION_ID,
            )
            session.add(conv)
            session.add(ConversationParticipant(
                id=str(uuid.uuid4()), conversation_id=str_to_uuid("conv-id"), user_id=DIRECTOR_USER_ID,
            ))
            session.add(ConversationParticipant(
                id=str(uuid.uuid4()), conversation_id=str_to_uuid("conv-id"), user_id=CAST_USER_ID,
            ))
            msg1 = Message(
                id=str_to_uuid("message-id"),
                conversation_id=str_to_uuid("conv-id"),
                sender_id=DIRECTOR_USER_ID,
                body="Test message from director",
                is_read=False,
                is_deleted=False,
            )
            session.add(msg1)
            msg2 = Message(
                id=str_to_uuid("cast-message-id"),
                conversation_id=str_to_uuid("conv-id"),
                sender_id=CAST_USER_ID,
                body="Test message from cast",
                is_read=False,
                is_deleted=False,
            )
            session.add(msg2)
            old_msg = Message(
                id=str_to_uuid("old-message-id"),
                conversation_id=str_to_uuid("conv-id"),
                sender_id=CAST_USER_ID,
                body="Old message",
                is_read=False,
                is_deleted=False,
                created_at=datetime.utcnow() - timedelta(minutes=10),
            )
            session.add(old_msg)

            # Create cast profile for headshot upload tests
            from app.models import CastProfile
            cast_profile = CastProfile(
                id=str(uuid.uuid4()),
                production_id=PRODUCTION_ID,
                user_id=CAST_USER_ID,
                display_name="Test Cast Member",
            )
            session.add(cast_profile)

            # Create invite tokens for join tests
            from app.models import InviteToken
            invite = InviteToken(
                id=str(uuid.uuid4()),
                production_id=PRODUCTION_ID,
                token="valid-token",
                expires_at=datetime.utcnow() + timedelta(days=30),
                max_uses=100,
                use_count=0,
            )
            session.add(invite)

            invite2 = InviteToken(
                id=str(uuid.uuid4()),
                production_id=PRODUCTION_ID,
                token="valid-invite-token",
                expires_at=datetime.utcnow() + timedelta(days=30),
                max_uses=100,
                use_count=0,
            )
            session.add(invite2)

            expired_invite = InviteToken(
                id=str(uuid.uuid4()),
                production_id=PRODUCTION_ID,
                token="expired-token",
                expires_at=datetime.utcnow() - timedelta(days=1),
                max_uses=100,
                use_count=0,
            )
            session.add(expired_invite)

            maxed_invite = InviteToken(
                id=str(uuid.uuid4()),
                production_id=PRODUCTION_ID,
                token="maxed-out-token",
                expires_at=datetime.utcnow() + timedelta(days=30),
                max_uses=100,
                use_count=100,
            )
            session.add(maxed_invite)

            prod_a_invite = InviteToken(
                id=str(uuid.uuid4()),
                production_id=PRODUCTION_ID,
                token="prod-a-invite-token",
                expires_at=datetime.utcnow() + timedelta(days=30),
                max_uses=100,
                use_count=0,
            )
            session.add(prod_a_invite)

            await session.commit()

    await setup_db()

    # Create app
    from app.main import create_app
    app = create_app()

    # URL rewriting: wrap the app so raw test IDs in URLs get mapped to UUIDs
    ID_MAP = {}
    for raw_id in [
        "prod-id", "prod-a-id", "prod-b-id", "theater-id",
        "date-1", "date-2", "date-3", "date-4", "date-5", "date-id",
        "some-date-id", "date-id-from-prod-b",
        "post-id", "post-1", "post-2", "director-post-id", "staff-post-id",
        "own-post-id", "any-post-id",
        "message-id", "old-message-id", "cast-message-id", "msg-id",
        "conv-id", "conversation-id",
        "some-theater-id",
        "cast-user-id", "cast-member-id", "other-cast-id", "some-cast-id",
        "staff-member-id", "other-staff-id", "staff-to-be-id",
        "director-id", "director-user-id",
        "removable-user-id", "removed-member-id",
        "other-user", "other-user-id",
    ]:
        ID_MAP[raw_id] = str_to_uuid(raw_id)

    # Override get_db
    async def override_get_db():
        async with session_maker() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[db_mod.get_db] = override_get_db

    # Override get_current_user
    async def test_get_current_user(request: Request):
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"error": "UNAUTHORIZED", "message": "Authentication required"},
            )

        token_str = auth_header.split(" ")[1]
        try:
            payload = jwt.decode(token_str, TEST_SECRET, algorithms=["HS256"])
            original_user_id = payload.get("sub")
            token_version = payload.get("token_version", 0)
            if not original_user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail={"error": "UNAUTHORIZED", "message": "Invalid token"},
                )
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"error": "UNAUTHORIZED", "message": "Invalid token"},
            )

        db_user_id = str_to_uuid(original_user_id)

        async with session_maker() as session:
            result = await session.execute(select(User).where(User.id == db_user_id))
            user = result.scalar_one_or_none()

            if not user:
                user = User(
                    id=db_user_id,
                    email=f"{original_user_id}@test.example.com",
                    name=f"Test User {original_user_id[:12]}",
                    password_hash="$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.BNANJCHD0H0Hq",
                    age_range="18+",
                    email_verified=True,
                    token_version=token_version,
                )
                session.add(user)

                role = ROLE_MAP.get(original_user_id)
                if role and original_user_id not in NON_MEMBERS:
                    session.add(ProductionMember(
                        id=str(uuid.uuid4()),
                        production_id=PRODUCTION_ID,
                        user_id=db_user_id,
                        role=role,
                    ))

                await session.commit()
                result = await session.execute(select(User).where(User.id == db_user_id))
                user = result.scalar_one_or_none()

            if user.token_version != token_version:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail={"error": "UNAUTHORIZED", "message": "Session expired"},
                )

            return {
                "id": user.id,
                "email": user.email,
                "name": user.name,
                "role": "user",
            }

    from app.routers.auth import get_current_user
    app.dependency_overrides[get_current_user] = test_get_current_user

    return app, engine


@pytest_asyncio.fixture(scope="function")
async def app_instance():
    """Per-test app instance with fresh DB."""
    app, engine = await _create_app_instance()
    yield app
    await engine.dispose()


@pytest_asyncio.fixture(scope="class")
async def class_app_instance():
    """Shared app instance for flow test classes (state persists across test methods)."""
    app, engine = await _create_app_instance()
    yield app
    await engine.dispose()


# ---------------------------------------------------------------------------
# Client fixture
# ---------------------------------------------------------------------------

_RAW_IDS = [
    "prod-id", "prod-a-id", "prod-b-id", "theater-id", "cast-id", "staff-id",
    "date-1", "date-2", "date-3", "date-4", "date-5", "date-id",
    "some-date-id", "date-id-from-prod-b",
    "post-id", "post-1", "post-2", "director-post-id", "staff-post-id",
    "own-post-id", "any-post-id",
    "message-id", "old-message-id", "cast-message-id", "msg-id",
    "conv-id", "conversation-id",
    "some-theater-id",
    "cast-user-id", "cast-member-id", "other-cast-id", "some-cast-id",
    "other-cast-user-id", "cast-member-1", "cast-member-2",
    "staff-member-id", "other-staff-id", "staff-to-be-id",
    "director-id", "director-user-id",
    "removable-user-id", "removed-member-id",
    "other-user", "other-user-id",
    "non-member-id", "outsider-id",
    "user-to-delete", "user-to-delete-id",
    "google-user-id", "unverified-user-id", "unverified-cast-id",
    "revoked-user-id", "demoted-user-id",
    "prod-a-member", "prod-a-member-id",
    "director-a", "director-a-id",
    "any-user", "user-id",
    "some-cast-id",
]
_ID_TO_UUID = {raw: str_to_uuid(raw) for raw in _RAW_IDS}


def _rewrite_url(url: str) -> str:
    """Rewrite raw test IDs in URL paths to their UUID versions."""
    if "?" in url:
        path, query = url.split("?", 1)
    else:
        path, query = url, None

    for raw, uid in _ID_TO_UUID.items():
        path = path.replace(f"/{raw}/", f"/{uid}/")
        if path.endswith(f"/{raw}"):
            path = path[: -len(raw)] + uid

    return f"{path}?{query}" if query else path


def _rewrite_json(data):
    """Recursively rewrite raw test IDs in JSON request bodies."""
    if isinstance(data, str):
        return _ID_TO_UUID.get(data, data)
    if isinstance(data, dict):
        return {k: _rewrite_json(v) for k, v in data.items()}
    if isinstance(data, list):
        return [_rewrite_json(item) for item in data]
    return data


_UUID_TO_ID = {uid: raw for raw, uid in _ID_TO_UUID.items()}


def _unrewrite_json(data):
    """Recursively convert UUIDs in response bodies back to raw test IDs."""
    if isinstance(data, str):
        return _UUID_TO_ID.get(data, data)
    if isinstance(data, dict):
        return {k: _unrewrite_json(v) for k, v in data.items()}
    if isinstance(data, list):
        return [_unrewrite_json(item) for item in data]
    return data


class RewritingClient(AsyncClient):
    """AsyncClient that rewrites raw test IDs to UUIDs in requests,
    and UUIDs back to raw test IDs in responses."""

    async def request(self, method, url, **kwargs):
        url = _rewrite_url(str(url))
        if "json" in kwargs and kwargs["json"] is not None:
            kwargs["json"] = _rewrite_json(kwargs["json"])
        response = await super().request(method, url, **kwargs)
        original_json = response.json

        def patched_json(**kw):
            data = original_json(**kw)
            return _unrewrite_json(data)

        response.json = patched_json
        return response


@pytest_asyncio.fixture
async def client(app_instance) -> AsyncGenerator[AsyncClient, None]:
    """Async HTTP test client with URL rewriting (per-test isolation)."""
    transport = ASGITransport(app=app_instance)
    async with RewritingClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest_asyncio.fixture(scope="class")
async def class_client(class_app_instance) -> AsyncGenerator[AsyncClient, None]:
    """Shared client for flow test classes (state persists across test methods)."""
    transport = ASGITransport(app=class_app_instance)
    async with RewritingClient(transport=transport, base_url="http://test") as ac:
        yield ac


# ---------------------------------------------------------------------------
# Auth helpers
# ---------------------------------------------------------------------------

def create_test_token(user_id: str, token_version: int = 0) -> str:
    """Create a test JWT."""
    payload = {
        "sub": user_id,
        "token_version": token_version,
        "exp": datetime.utcnow() + timedelta(days=1),
    }
    return jwt.encode(payload, TEST_SECRET, algorithm="HS256")


@pytest.fixture
def auth_headers() -> Callable[[str, int], dict]:
    """Generate auth headers for a given user ID."""
    def _auth_headers(user_id: str, token_version: int = 0) -> dict:
        token = create_test_token(user_id, token_version)
        return {"Authorization": f"Bearer {token}"}
    return _auth_headers


# ---------------------------------------------------------------------------
# DB session fixture (for direct DB access in tests)
# ---------------------------------------------------------------------------

@pytest_asyncio.fixture
async def db_session(app_instance, tmp_path) -> AsyncGenerator[AsyncSession, None]:
    """Provide a DB session for direct database access in tests."""
    import app.database as db_mod
    async with db_mod.async_session_maker() as session:
        yield session


# ---------------------------------------------------------------------------
# Factory fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def make_user(db_session: AsyncSession):
    async def _make_user(email=None, name="Test User", password="SecurePass123!", age_range="18+", email_verified=True, google_id=None):
        from app.models import User
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        user = User(
            id=str(uuid.uuid4()),
            email=email or f"user-{uuid.uuid4().hex[:8]}@example.com",
            name=name,
            password_hash=pwd_context.hash(password) if password else None,
            age_range=age_range,
            email_verified=email_verified,
            google_id=google_id,
        )
        db_session.add(user)
        await db_session.commit()
        return {"id": user.id, "email": user.email, "name": user.name, "age_range": user.age_range, "email_verified": user.email_verified}
    return _make_user


@pytest.fixture
def make_theater(db_session: AsyncSession):
    async def _make_theater(owner_id=None, name="Lincoln High School", city="Springfield", state="IL"):
        from app.models import Theater
        theater = Theater(id=str(uuid.uuid4()), owner_id=owner_id or str(uuid.uuid4()), name=name, city=city, state=state)
        db_session.add(theater)
        await db_session.commit()
        return {"id": theater.id, "owner_id": theater.owner_id, "name": theater.name, "city": theater.city, "state": theater.state}
    return _make_theater


@pytest.fixture
def make_production(db_session: AsyncSession):
    async def _make_production(theater_id=None, name="Into the Woods", estimated_cast_size=30, first_rehearsal=None, opening_night=None, closing_night=None):
        from app.models import Production
        today = date.today()
        production = Production(
            id=str(uuid.uuid4()), theater_id=theater_id or str(uuid.uuid4()), name=name,
            estimated_cast_size=estimated_cast_size,
            first_rehearsal=first_rehearsal or (today + timedelta(days=30)),
            opening_night=opening_night or (today + timedelta(days=90)),
            closing_night=closing_night or (today + timedelta(days=97)),
        )
        db_session.add(production)
        await db_session.commit()
        return {"id": production.id, "theater_id": production.theater_id, "name": production.name}
    return _make_production


@pytest.fixture
def make_member(db_session: AsyncSession):
    async def _make_member(production_id, user_id, role="cast"):
        from app.models import ProductionMember
        member = ProductionMember(id=str(uuid.uuid4()), production_id=production_id, user_id=user_id, role=role)
        db_session.add(member)
        await db_session.commit()
        return {"id": member.id, "production_id": member.production_id, "user_id": member.user_id, "role": member.role}
    return _make_member


@pytest.fixture
def schedule_wizard_input():
    today = date.today()
    return {
        "first_rehearsal": (today + timedelta(days=30)).isoformat(),
        "opening_night": (today + timedelta(days=90)).isoformat(),
        "closing_night": (today + timedelta(days=97)).isoformat(),
        "selected_days": ["monday", "wednesday", "friday"],
        "start_time": "18:00",
        "end_time": "21:00",
        "blocked_dates": [],
        "tech_week_enabled": True,
        "tech_week_days": 5,
        "dress_rehearsal_enabled": True,
    }


# Constants
VALID_PASSWORD = "SecurePass123!"
WEAK_PASSWORD = "password"
SHORT_PASSWORD = "short"
VALID_EMAIL = "testuser@example.com"
VALID_DOB_ADULT = "1990-01-15"
VALID_DOB_MINOR = "2015-06-01"
VALID_DOB_TEEN = "2010-03-20"
