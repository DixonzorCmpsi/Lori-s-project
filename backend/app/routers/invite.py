"""Invite router."""

import uuid
import secrets
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.database import async_session_maker
from app.models import ProductionMember, InviteToken
from app.routers.auth import get_current_user

router = APIRouter()


async def check_production_member(production_id: str, user_id: str) -> ProductionMember:
    """Check user is a member of production."""
    async with async_session_maker() as session:
        stmt = select(ProductionMember).where(
            ProductionMember.user_id == user_id,
            ProductionMember.production_id == production_id,
        )
        result = await session.execute(stmt)
        member = result.scalar_one_or_none()

        if not member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "FORBIDDEN",
                    "message": "Not a member of this production",
                },
            )
        return member


@router.get("/{production_id}/invite")
async def get_invite_info(
    production_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Get invite link info."""
    member = await check_production_member(production_id, current_user["id"])

    if member.role == "cast":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "FORBIDDEN", "message": "Not authorized"},
        )

    async with async_session_maker() as session:
        stmt = (
            select(InviteToken)
            .where(
                InviteToken.production_id == production_id,
            )
            .order_by(InviteToken.created_at.desc())
            .limit(1)
        )

        result = await session.execute(stmt)
        token = result.scalar_one_or_none()

        if not token:
            return {"exists": False}

        return {
            "token": token.token,
            "expires_at": token.expires_at.isoformat(),
            "max_uses": token.max_uses,
            "use_count": token.use_count,
        }


@router.post("/{production_id}/invite", status_code=201)
async def generate_invite(
    production_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Generate a new invite link."""
    member = await check_production_member(production_id, current_user["id"])

    if member.role not in ("director", "staff"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "FORBIDDEN", "message": "Not authorized"},
        )

    async with async_session_maker() as session:
        token = secrets.token_urlsafe(32)

        invite = InviteToken(
            id=str(uuid.uuid4()),
            production_id=production_id,
            token=token,
            expires_at=datetime.utcnow() + timedelta(days=30),
            max_uses=100,
            use_count=0,
        )
        session.add(invite)
        await session.commit()

        return {
            "token": invite.token,
            "expires_at": invite.expires_at.isoformat(),
            "max_uses": invite.max_uses,
            "use_count": invite.use_count,
        }


@router.post("/{production_id}/invite/regenerate")
async def regenerate_invite(
    production_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Regenerate invite link (invalidates old)."""
    member = await check_production_member(production_id, current_user["id"])

    if member.role != "director":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "FORBIDDEN", "message": "Only director can regenerate"},
        )

    async with async_session_maker() as session:
        # Invalidate old tokens
        stmt = select(InviteToken).where(InviteToken.production_id == production_id)
        result = await session.execute(stmt)
        tokens = result.scalars().all()

        for t in tokens:
            t.use_count = t.max_uses  # Deactivate

        # Create new token
        token = secrets.token_urlsafe(32)

        invite = InviteToken(
            id=str(uuid.uuid4()),
            production_id=production_id,
            token=token,
            expires_at=datetime.utcnow() + timedelta(days=30),
            max_uses=100,
            use_count=0,
        )
        session.add(invite)
        await session.commit()

        return {
            "token": invite.token,
            "expires_at": invite.expires_at.isoformat(),
            "max_uses": invite.max_uses,
        }
