"""Shared access-control helpers for routers that use the per-request `get_db` session."""

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Production, ProductionMember, User

STAFF_ROLES = ("director", "staff")


def forbidden(message: str) -> HTTPException:
    return HTTPException(status_code=403, detail={"error": "FORBIDDEN", "message": message})


def not_found(message: str) -> HTTPException:
    return HTTPException(status_code=404, detail={"error": "NOT_FOUND", "message": message})


def invalid(message: str, code: str = "VALIDATION_ERROR", status_code: int = 400) -> HTTPException:
    return HTTPException(status_code=status_code, detail={"error": code, "message": message})


async def require_member(production_id: str, user_id: str, db: AsyncSession) -> ProductionMember:
    member = (
        await db.execute(
            select(ProductionMember).where(
                ProductionMember.production_id == production_id,
                ProductionMember.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if not member:
        raise forbidden("Not a member of this production")
    return member


async def require_staff(production_id: str, user_id: str, db: AsyncSession) -> ProductionMember:
    member = await require_member(production_id, user_id, db)
    if member.role not in STAFF_ROLES:
        raise forbidden("Staff or director required")
    return member


async def get_production(production_id: str, db: AsyncSession) -> Production:
    production = (
        await db.execute(select(Production).where(Production.id == production_id))
    ).scalar_one_or_none()
    if not production:
        raise not_found("Production not found")
    return production


async def require_writable(production_id: str, db: AsyncSession) -> Production:
    """The production must exist and not be archived (archived productions are read-only)."""
    production = await get_production(production_id, db)
    if production.is_archived:
        raise forbidden("Production is archived - read only")
    return production


async def user_names(user_ids: list[str], db: AsyncSession) -> dict[str, User]:
    """Map user id -> User for the given ids."""
    if not user_ids:
        return {}
    rows = (await db.execute(select(User).where(User.id.in_(user_ids)))).scalars().all()
    return {u.id: u for u in rows}


async def members_with_users(
    production_id: str, db: AsyncSession, roles: tuple[str, ...] | None = None
) -> list[tuple[ProductionMember, User]]:
    stmt = (
        select(ProductionMember, User)
        .join(User, User.id == ProductionMember.user_id)
        .where(ProductionMember.production_id == production_id)
    )
    if roles:
        stmt = stmt.where(ProductionMember.role.in_(roles))
    return [(m, u) for m, u in (await db.execute(stmt)).all()]
