"""Database configuration and session management."""

from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()

# Convert URL to async driver (Supabase PostgreSQL only)
_raw_url = settings.database_url
if _raw_url.startswith("postgresql+asyncpg://"):
    _db_url = _raw_url
elif _raw_url.startswith("postgresql://"):
    _db_url = _raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)
else:
    raise RuntimeError(
        f"Only PostgreSQL (Supabase) is supported. Got: {_raw_url[:30]}..."
    )

engine: AsyncEngine = create_async_engine(
    _db_url,
    echo=settings.debug,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    connect_args={"statement_cache_size": 0},  # Required for Supabase PgBouncer
)

async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


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


async def init_db() -> None:
    """Create all tables and run lightweight migrations."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

        # Lightweight migrations — safe to re-run (idempotent)
        from sqlalchemy import text

        # Drop old unique constraint on conflict_submissions (allows multiple submissions)
        await conn.execute(text("""
            DO $$ BEGIN
                ALTER TABLE conflict_submissions DROP CONSTRAINT IF EXISTS uq_conflict_submission;
            EXCEPTION WHEN undefined_table THEN NULL;
            END $$;
        """))

        # Add new columns if missing (create_all won't add to existing tables)
        for col_sql in [
            "ALTER TABLE productions ADD COLUMN IF NOT EXISTS extra_conflict_windows INTEGER DEFAULT 0",
            "ALTER TABLE production_members ADD COLUMN IF NOT EXISTS extra_conflict_windows INTEGER",
            "ALTER TABLE production_members ADD COLUMN IF NOT EXISTS conflicts_used INTEGER DEFAULT 0",
            "ALTER TABLE conflict_submissions ADD COLUMN IF NOT EXISTS window_index INTEGER DEFAULT 0",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN DEFAULT TRUE",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS parental_consent BOOLEAN DEFAULT FALSE",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_email VARCHAR(320)",
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS parent_phone VARCHAR(20)",
        ]:
            await conn.execute(text(col_sql))


async def close_db() -> None:
    await engine.dispose()
