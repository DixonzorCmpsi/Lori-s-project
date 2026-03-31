"""Integration test fixtures — shared state for stateful flow tests.

Flow tests (TestCastFullFlow, TestDirectorFullFlow, etc.) are ordered step
sequences where each test depends on state created by earlier steps.  We use
a module-level engine + flag so the expensive TRUNCATE+seed cycle runs once
per test class, not once per test method.
"""

import pytest
import pytest_asyncio
from collections.abc import AsyncGenerator
from typing import Callable
from httpx import ASGITransport, AsyncClient

from tests.conftest import RewritingClient, create_test_token

# Track which class already has a seeded DB so we skip re-seeding
_seeded_classes: set = set()


@pytest_asyncio.fixture(scope="function")
async def app_instance(request):
    """Per-function app instance that only seeds once per test class."""
    from tests.conftest import _create_app_instance

    cls_name = request.cls.__name__ if request.cls else None

    if cls_name and cls_name in _seeded_classes:
        # Reuse existing DB state — just create engine + app without truncating
        from tests.conftest import _db_url
        from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
        import app.database as db_mod
        from app.config import Settings

        engine = create_async_engine(_db_url, pool_pre_ping=True, pool_size=5, max_overflow=10)
        session_maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

        db_mod.engine = engine
        db_mod.async_session_maker = session_maker

        import app.routers.auth as auth_mod
        auth_mod.async_session_maker = session_maker
        auth_mod.settings = Settings(database_url=_db_url, nextauth_secret="test-secret-for-testing-purposes-only")

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

        from app.main import create_app
        app = create_app()

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

        # Override get_current_user (same as parent conftest)
        from tests.conftest import (
            str_to_uuid, ROLE_MAP, NON_MEMBERS, PRODUCTION_ID,
            DIRECTOR_USER_ID, STAFF_USER_ID, CAST_USER_ID,
        )
        from app.models import User, ProductionMember
        from sqlalchemy import select
        from fastapi import Request, HTTPException, status
        from jose import jwt, JWTError
        import uuid

        TEST_SECRET = "test-secret-for-testing-purposes-only"

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
                    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                        detail={"error": "UNAUTHORIZED", "message": "Invalid token"})
            except JWTError:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                    detail={"error": "UNAUTHORIZED", "message": "Invalid token"})

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
                        age_range="18+", email_verified=True, token_version=token_version,
                    )
                    session.add(user)
                    role = ROLE_MAP.get(original_user_id)
                    if role and original_user_id not in NON_MEMBERS:
                        session.add(ProductionMember(
                            id=str(uuid.uuid4()), production_id=PRODUCTION_ID,
                            user_id=db_user_id, role=role,
                        ))
                    await session.commit()
                    result = await session.execute(select(User).where(User.id == db_user_id))
                    user = result.scalar_one_or_none()
                if user.token_version != token_version:
                    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                        detail={"error": "UNAUTHORIZED", "message": "Session expired"})
                return {"id": user.id, "email": user.email, "name": user.name, "role": "user"}

        from app.routers.auth import get_current_user
        app.dependency_overrides[get_current_user] = test_get_current_user

        yield app
        await engine.dispose()
    else:
        # First test in class — do full setup
        app, engine = await _create_app_instance()
        if cls_name:
            _seeded_classes.add(cls_name)
        yield app
        await engine.dispose()


@pytest.fixture
def auth_headers() -> Callable[[str, int], dict]:
    """Generate auth headers for a given user ID."""
    def _auth_headers(user_id: str, token_version: int = 0) -> dict:
        token = create_test_token(user_id, token_version)
        return {"Authorization": f"Bearer {token}"}
    return _auth_headers
