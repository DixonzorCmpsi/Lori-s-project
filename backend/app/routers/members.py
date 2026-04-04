"""Members router."""

import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select

from app.database import async_session_maker
from app.models import (
    ProductionMember,
    ConflictSubmission,
    CastConflict,
    BulletinPost,
    User,
)
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


@router.get("/{production_id}/members")
async def list_members(
    production_id: str,
    current_user: dict = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """List production members."""
    await check_production_member(production_id, current_user["id"])

    async with async_session_maker() as session:
        stmt = (
            select(ProductionMember, User)
            .join(User)
            .where(
                ProductionMember.production_id == production_id,
            )
        )
        result = await session.execute(stmt)
        members = result.all()

        # Batch-fetch all conflict submissions for this production (avoids N+1)
        sub_stmt = select(ConflictSubmission.user_id).where(
            ConflictSubmission.production_id == production_id,
        )
        sub_result = await session.execute(sub_stmt)
        submitted_user_ids = {row[0] for row in sub_result.all()}

        member_list = []
        for member, user in members:
            has_conflicts = None
            if member.role == "cast":
                has_conflicts = "Submitted" if user.id in submitted_user_ids else "Pending"

            member_list.append(
                {
                    "id": member.id,
                    "user_id": user.id,
                    "name": user.name,
                    "role": member.role,
                    "joined_at": member.joined_at.isoformat(),
                    "conflicts": has_conflicts,
                    "conflicts_submitted": has_conflicts == "Submitted",
                }
            )

        return member_list


@router.get("/{production_id}/members/{user_id}")
async def get_member(
    production_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Get a specific member."""
    await check_production_member(production_id, current_user["id"])

    async with async_session_maker() as session:
        stmt = (
            select(ProductionMember, User)
            .join(User)
            .where(
                ProductionMember.production_id == production_id,
                ProductionMember.user_id == user_id,
            )
        )
        result = await session.execute(stmt)
        member_data = result.first()

        if not member_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "NOT_FOUND", "message": "Member not found"},
            )

        member, user = member_data

        return {
            "id": member.id,
            "user_id": user.id,
            "name": user.name,
            "role": member.role,
            "joined_at": member.joined_at.isoformat(),
        }


@router.post("/{production_id}/members/{user_id}/promote")
async def promote_member(
    production_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Promote a cast member to staff."""
    member = await check_production_member(production_id, current_user["id"])

    if member.role != "director":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "FORBIDDEN", "message": "Only director can promote"},
        )

    async with async_session_maker() as session:
        stmt = select(ProductionMember).where(
            ProductionMember.production_id == production_id,
            ProductionMember.user_id == user_id,
        )
        result = await session.execute(stmt)
        target = result.scalar_one_or_none()

        if not target:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "NOT_FOUND", "message": "Member not found"},
            )

        if target.role not in ("cast", "staff"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "VALIDATION_ERROR",
                    "message": "Cannot promote director",
                },
            )

        target.role = "staff"
        await session.commit()

        return {
            "user_id": target.user_id,
            "role": target.role,
        }


@router.post("/{production_id}/members/{user_id}/demote")
async def demote_member(
    production_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Demote a staff member to cast."""
    member = await check_production_member(production_id, current_user["id"])

    if member.role != "director":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "FORBIDDEN", "message": "Only director can demote"},
        )

    async with async_session_maker() as session:
        stmt = select(ProductionMember).where(
            ProductionMember.production_id == production_id,
            ProductionMember.user_id == user_id,
        )
        result = await session.execute(stmt)
        target = result.scalar_one_or_none()

        if not target:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "NOT_FOUND", "message": "Member not found"},
            )

        if target.role == "director":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "VALIDATION_ERROR",
                    "message": "Cannot demote director",
                },
            )

        target.role = "cast"
        await session.commit()

        return {
            "user_id": target.user_id,
            "role": target.role,
        }


@router.delete("/{production_id}/members/{user_id}")
async def remove_member(
    production_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Remove a member from production."""
    member = await check_production_member(production_id, current_user["id"])

    if member.role != "director":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "FORBIDDEN",
                "message": "Only director can remove members",
            },
        )

    async with async_session_maker() as session:
        stmt = select(ProductionMember).where(
            ProductionMember.production_id == production_id,
            ProductionMember.user_id == user_id,
        )
        result = await session.execute(stmt)
        target = result.scalar_one_or_none()

        if not target:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "NOT_FOUND", "message": "Member not found"},
            )

        if target.role == "director":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "VALIDATION_ERROR",
                    "message": "Cannot remove director",
                },
            )

        # Delete conflicts
        stmt = select(CastConflict).where(
            CastConflict.production_id == production_id,
            CastConflict.user_id == user_id,
        )
        result = await session.execute(stmt)
        conflicts = result.scalars().all()
        for c in conflicts:
            await session.delete(c)

        # Delete submission
        stmt = select(ConflictSubmission).where(
            ConflictSubmission.production_id == production_id,
            ConflictSubmission.user_id == user_id,
        )
        result = await session.execute(stmt)
        submission = result.scalar_one_or_none()
        if submission:
            await session.delete(submission)

        await session.delete(target)
        await session.commit()

        return {"message": "Member removed"}


@router.post("/{production_id}/members/{user_id}/reset-conflicts")
async def reset_conflicts(
    production_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Reset a cast member's conflicts."""
    member = await check_production_member(production_id, current_user["id"])

    if member.role != "director":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "FORBIDDEN",
                "message": "Only director can reset conflicts",
            },
        )

    async with async_session_maker() as session:
        # Check target is cast
        stmt = select(ProductionMember).where(
            ProductionMember.production_id == production_id,
            ProductionMember.user_id == user_id,
        )
        result = await session.execute(stmt)
        target = result.scalar_one_or_none()

        if not target or target.role != "cast":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "VALIDATION_ERROR",
                    "message": "Can only reset cast conflicts",
                },
            )

        # Delete conflicts
        stmt = select(CastConflict).where(
            CastConflict.production_id == production_id,
            CastConflict.user_id == user_id,
        )
        result = await session.execute(stmt)
        conflicts = result.scalars().all()
        for c in conflicts:
            await session.delete(c)

        # Delete submission
        stmt = select(ConflictSubmission).where(
            ConflictSubmission.production_id == production_id,
            ConflictSubmission.user_id == user_id,
        )
        result = await session.execute(stmt)
        submission = result.scalar_one_or_none()
        if submission:
            await session.delete(submission)

        # Create bulletin post
        post = BulletinPost(
            id=str(uuid.uuid4()),
            production_id=production_id,
            author_id=current_user["id"],
            title="Conflicts Reset",
            body="Your conflicts have been reset by the director. Please re-submit your conflicts.",
        )
        session.add(post)

        await session.commit()

        return {"message": "Conflicts reset"}
