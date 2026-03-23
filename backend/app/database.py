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

is_sqlite = settings.database_url.startswith("sqlite")

engine: AsyncEngine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    **(
        dict(
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20,
        )
        if not is_sqlite
        else dict(
            connect_args={"check_same_thread": False}
            if "memory" in settings.database_url
            else {},
        )
    ),
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
    """Create all tables. Use Alembic for migrations in production."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def close_db() -> None:
    await engine.dispose()
