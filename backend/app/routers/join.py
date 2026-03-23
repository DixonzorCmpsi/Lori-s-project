"""Join router - handles invite link joining."""

import uuid
from datetime import datetime, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
from sqlalchemy import select

from app.database import async_session_maker
from app.models import ProductionMember, InviteToken, User
from app.routers.auth import get_current_user

router = APIRouter(tags=["join"])


@router.get("/join")
async def validate_invite_token(
    token: str,
    request: Request,
) -> dict[str, Any]:
    """Validate an invite token - check if it's valid."""
    # Check if user is already authenticated
    auth_header = request.headers.get("Authorization")

    async with async_session_maker() as session:
        stmt = select(InviteToken).where(InviteToken.token == token)
        result = await session.execute(stmt)
        invite = result.scalar_one_or_none()

        if not invite:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": "NOT_FOUND",
                    "message": "Invalid invite token",
                },
            )

        if invite.expires_at < datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "VALIDATION_ERROR",
                    "message": "This invite link has expired",
                },
            )

        if invite.use_count >= invite.max_uses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "VALIDATION_ERROR",
                    "message": "This invite link is no longer available",
                },
            )

        # If user is authenticated, they can proceed to join
        if auth_header:
            return {
                "valid": True,
                "production_id": invite.production_id,
                "message": "Token valid, user can join",
            }

        # If not authenticated, return 401 to prompt login
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": "UNAUTHORIZED",
                "message": "Please log in to join this production",
            },
        )


@router.post("/join")
async def join_production(
    body: dict = Body(...),
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Join a production using an invite token."""
    token = body.get("token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "VALIDATION_ERROR",
                "message": "Token is required",
            },
        )

    async with async_session_maker() as session:
        stmt = select(InviteToken).where(InviteToken.token == token)
        result = await session.execute(stmt)
        invite = result.scalar_one_or_none()

        if not invite:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": "NOT_FOUND",
                    "message": "Invalid invite token",
                },
            )

        if invite.expires_at < datetime.utcnow():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "VALIDATION_ERROR",
                    "message": "This invite link has expired",
                },
            )

        if invite.use_count >= invite.max_uses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "VALIDATION_ERROR",
                    "message": "This invite link is no longer available",
                },
            )

        stmt = select(ProductionMember).where(
            ProductionMember.production_id == invite.production_id,
            ProductionMember.user_id == current_user["id"],
        )
        result = await session.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            return {
                "production_id": invite.production_id,
                "role": existing.role,
                "message": "Already a member",
            }

        member = ProductionMember(
            id=str(uuid.uuid4()),
            production_id=invite.production_id,
            user_id=current_user["id"],
            role="cast",
        )
        session.add(member)

        invite.use_count += 1

        await session.commit()

        return {
            "production_id": invite.production_id,
            "role": "cast",
        }
