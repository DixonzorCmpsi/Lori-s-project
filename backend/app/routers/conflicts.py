"""Conflicts router."""

import uuid
from datetime import datetime
from typing import Any, Optional, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.database import async_session_maker
from app.models import (
    ProductionMember,
    ConflictSubmission,
    CastConflict,
    RehearsalDate,
    BulletinPost,
)
from app.routers.auth import get_current_user
from app.services.business_logic import FIELD_MAX_LENGTHS

router = APIRouter()


class ConflictDate(BaseModel):
    rehearsal_date_id: str
    reason: Optional[str] = None


class SubmitConflictsRequest(BaseModel):
    dates: List[ConflictDate]


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


@router.post("/{production_id}/conflicts", status_code=201)
async def submit_conflicts(
    production_id: str,
    body: SubmitConflictsRequest,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Submit conflict dates."""
    member = await check_production_member(production_id, current_user["id"])

    if member.role != "cast":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": "FORBIDDEN",
                "message": "Only cast members can submit conflicts",
            },
        )

    async with async_session_maker() as session:
        # Check if already submitted
        stmt = select(ConflictSubmission).where(
            ConflictSubmission.production_id == production_id,
            ConflictSubmission.user_id == current_user["id"],
        )
        result = await session.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error": "CONFLICT", "message": "Conflicts already submitted"},
            )

        # Create submission
        submission = ConflictSubmission(
            id=str(uuid.uuid4()),
            production_id=production_id,
            user_id=current_user["id"],
        )
        session.add(submission)

        # Create conflicts
        conflicts = []
        for d in body.dates:
            rehearsal_date_id = d.rehearsal_date_id
            reason = d.reason

            # Validate rehearsal date exists and belongs to this production
            stmt = select(RehearsalDate).where(
                RehearsalDate.id == rehearsal_date_id,
                RehearsalDate.production_id == production_id,
                RehearsalDate.is_deleted == False,
            )
            result = await session.execute(stmt)
            rehearsal = result.scalar_one_or_none()

            if not rehearsal:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "error": "VALIDATION_ERROR",
                        "message": f"Invalid rehearsal date ID: {rehearsal_date_id}",
                    },
                )

            if reason and len(reason) > FIELD_MAX_LENGTHS.get("conflict_reason", 500):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"error": "VALIDATION_ERROR", "message": "Reason too long"},
                )

            conflict = CastConflict(
                id=str(uuid.uuid4()),
                production_id=production_id,
                user_id=current_user["id"],
                rehearsal_date_id=rehearsal_date_id,
                submission_id=submission.id,
                reason=reason,
            )
            session.add(conflict)
            conflicts.append(conflict)

        await session.commit()

        return {
            "id": submission.id,
            "submitted_at": submission.submitted_at.isoformat(),
            "conflicts": [
                {
                    "id": c.id,
                    "rehearsal_date_id": c.rehearsal_date_id,
                    "reason": c.reason,
                }
                for c in conflicts
            ],
        }


@router.delete("/{production_id}/conflicts")
async def delete_conflicts(
    production_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Cast cannot self-delete conflicts. Only Director can reset via member endpoint."""
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail={"error": "FORBIDDEN", "message": "Cannot delete conflicts. Contact your director."},
    )


@router.get("/{production_id}/conflicts")
async def get_conflicts(
    production_id: str,
    current_user: dict = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Get conflicts for a production."""
    member = await check_production_member(production_id, current_user["id"])

    async with async_session_maker() as session:
        if member.role in ("director", "staff"):
            # Get all conflicts
            stmt = select(CastConflict).where(
                CastConflict.production_id == production_id,
            )
            result = await session.execute(stmt)
            conflicts = result.scalars().all()

            # Group by rehearsal date
            from collections import defaultdict

            by_date = defaultdict(list)
            for c in conflicts:
                by_date[c.rehearsal_date_id].append(c)

            # Get rehearsal dates with counts
            stmt = select(RehearsalDate).where(
                RehearsalDate.production_id == production_id,
                RehearsalDate.is_deleted == False,
            )
            result = await session.execute(stmt)
            dates = result.scalars().all()

            return [
                {
                    "date": d.rehearsal_date.isoformat(),
                    "type": d.type,
                    "conflict_count": len(by_date.get(d.id, [])),
                    "conflicts": [
                        {"user_id": c.user_id, "reason": c.reason}
                        for c in by_date.get(d.id, [])
                    ],
                }
                for d in dates
            ]
        else:
            # Cast member - get only their own
            stmt = select(CastConflict).where(
                CastConflict.production_id == production_id,
                CastConflict.user_id == current_user["id"],
            )
            result = await session.execute(stmt)
            conflicts = result.scalars().all()

            return [
                {
                    "rehearsal_date_id": c.rehearsal_date_id,
                    "reason": c.reason,
                    "user_id": c.user_id,
                }
                for c in conflicts
            ]
