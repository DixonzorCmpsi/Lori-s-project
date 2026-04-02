"""Cast assignment router — assign cast members to specific rehearsal dates."""

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select, delete

from app.database import async_session_maker
from app.models import (
    ProductionMember, RehearsalDate, CastAssignment,
    CastProfile, ConflictSubmission, CastConflict, User,
)
from app.routers.auth import get_current_user

router = APIRouter()


class AssignRequest(BaseModel):
    user_id: str
    rehearsal_date_id: str


class BulkAssignRequest(BaseModel):
    user_id: str
    rehearsal_date_ids: list[str]


async def _check_staff(production_id: str, user_id: str) -> ProductionMember:
    async with async_session_maker() as session:
        stmt = select(ProductionMember).where(
            ProductionMember.production_id == production_id,
            ProductionMember.user_id == user_id,
        )
        result = await session.execute(stmt)
        member = result.scalar_one_or_none()
        if not member:
            raise HTTPException(status_code=403, detail={"error": "FORBIDDEN", "message": "Not a member"})
        if member.role not in ("director", "staff"):
            raise HTTPException(status_code=403, detail={"error": "FORBIDDEN", "message": "Staff only"})
        return member


@router.get("/{production_id}/assignments")
async def list_assignments(
    production_id: str,
    user_id: str = None,
    current_user: dict = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """List cast assignments. Filter by user_id optionally."""
    async with async_session_maker() as session:
        # Check membership
        stmt = select(ProductionMember).where(
            ProductionMember.production_id == production_id,
            ProductionMember.user_id == current_user["id"],
        )
        result = await session.execute(stmt)
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail={"error": "FORBIDDEN", "message": "Not a member"})

        stmt = select(CastAssignment).where(CastAssignment.production_id == production_id)
        if user_id:
            stmt = stmt.where(CastAssignment.user_id == user_id)
        result = await session.execute(stmt)
        assignments = result.scalars().all()

        # Fetch rehearsal date info
        date_ids = [a.rehearsal_date_id for a in assignments]
        dates_map = {}
        if date_ids:
            stmt = select(RehearsalDate).where(RehearsalDate.id.in_(date_ids))
            result = await session.execute(stmt)
            dates_map = {d.id: d for d in result.scalars().all()}

        return [
            {
                "id": a.id,
                "user_id": a.user_id,
                "rehearsal_date_id": a.rehearsal_date_id,
                "date": dates_map[a.rehearsal_date_id].rehearsal_date.isoformat() if a.rehearsal_date_id in dates_map else None,
                "type": dates_map[a.rehearsal_date_id].type if a.rehearsal_date_id in dates_map else None,
                "start_time": dates_map[a.rehearsal_date_id].start_time.strftime("%H:%M") if a.rehearsal_date_id in dates_map else None,
                "end_time": dates_map[a.rehearsal_date_id].end_time.strftime("%H:%M") if a.rehearsal_date_id in dates_map else None,
            }
            for a in assignments
        ]


@router.post("/{production_id}/assignments", status_code=201)
async def assign_cast(
    production_id: str,
    body: AssignRequest,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Assign a cast member to a rehearsal date."""
    await _check_staff(production_id, current_user["id"])

    async with async_session_maker() as session:
        # Verify the target user is a member
        stmt = select(ProductionMember).where(
            ProductionMember.production_id == production_id,
            ProductionMember.user_id == body.user_id,
        )
        result = await session.execute(stmt)
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail={"error": "NOT_FOUND", "message": "User not in production"})

        # Verify rehearsal date exists
        stmt = select(RehearsalDate).where(
            RehearsalDate.id == body.rehearsal_date_id,
            RehearsalDate.production_id == production_id,
        )
        result = await session.execute(stmt)
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=404, detail={"error": "NOT_FOUND", "message": "Date not found"})

        # Check not already assigned
        stmt = select(CastAssignment).where(
            CastAssignment.rehearsal_date_id == body.rehearsal_date_id,
            CastAssignment.user_id == body.user_id,
        )
        result = await session.execute(stmt)
        if result.scalar_one_or_none():
            return {"message": "Already assigned"}

        assignment = CastAssignment(
            id=str(uuid.uuid4()),
            production_id=production_id,
            rehearsal_date_id=body.rehearsal_date_id,
            user_id=body.user_id,
        )
        session.add(assignment)
        await session.commit()
        return {"id": assignment.id, "user_id": body.user_id, "rehearsal_date_id": body.rehearsal_date_id}


@router.put("/{production_id}/assignments/bulk")
async def bulk_assign_cast(
    production_id: str,
    body: BulkAssignRequest,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Replace all assignments for a user with the given dates."""
    await _check_staff(production_id, current_user["id"])

    async with async_session_maker() as session:
        # Clear existing assignments for this user
        await session.execute(
            delete(CastAssignment).where(
                CastAssignment.production_id == production_id,
                CastAssignment.user_id == body.user_id,
            )
        )

        added = 0
        for date_id in body.rehearsal_date_ids:
            session.add(CastAssignment(
                id=str(uuid.uuid4()),
                production_id=production_id,
                rehearsal_date_id=date_id,
                user_id=body.user_id,
            ))
            added += 1

        await session.commit()
        return {"added": added}


@router.delete("/{production_id}/assignments")
async def unassign_cast(
    production_id: str,
    user_id: str,
    rehearsal_date_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Remove a cast assignment."""
    await _check_staff(production_id, current_user["id"])

    async with async_session_maker() as session:
        stmt = select(CastAssignment).where(
            CastAssignment.production_id == production_id,
            CastAssignment.user_id == user_id,
            CastAssignment.rehearsal_date_id == rehearsal_date_id,
        )
        result = await session.execute(stmt)
        assignment = result.scalar_one_or_none()
        if assignment:
            await session.delete(assignment)
            await session.commit()
        return {"message": "Unassigned"}


@router.get("/{production_id}/members/{user_id}/details")
async def get_member_details(
    production_id: str,
    user_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Get detailed info about a cast member: profile, conflicts, assignments."""
    async with async_session_maker() as session:
        # Check caller is a member
        stmt = select(ProductionMember).where(
            ProductionMember.production_id == production_id,
            ProductionMember.user_id == current_user["id"],
        )
        result = await session.execute(stmt)
        caller = result.scalar_one_or_none()
        if not caller:
            raise HTTPException(status_code=403, detail={"error": "FORBIDDEN", "message": "Not a member"})

        # Get target member
        stmt = select(ProductionMember).where(
            ProductionMember.production_id == production_id,
            ProductionMember.user_id == user_id,
        )
        result = await session.execute(stmt)
        member = result.scalar_one_or_none()
        if not member:
            raise HTTPException(status_code=404, detail={"error": "NOT_FOUND", "message": "Member not found"})

        # Get user info
        stmt = select(User).where(User.id == user_id)
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()

        # Get cast profile
        stmt = select(CastProfile).where(
            CastProfile.production_id == production_id,
            CastProfile.user_id == user_id,
        )
        result = await session.execute(stmt)
        profile = result.scalar_one_or_none()

        # Get conflict submission + conflicts
        conflicts = []
        stmt = select(ConflictSubmission).where(
            ConflictSubmission.production_id == production_id,
            ConflictSubmission.user_id == user_id,
        )
        result = await session.execute(stmt)
        submission = result.scalar_one_or_none()
        if submission:
            stmt = select(CastConflict).where(CastConflict.submission_id == submission.id)
            result = await session.execute(stmt)
            cast_conflicts = result.scalars().all()
            # Resolve date info
            conflict_date_ids = [c.rehearsal_date_id for c in cast_conflicts]
            if conflict_date_ids:
                stmt = select(RehearsalDate).where(RehearsalDate.id.in_(conflict_date_ids))
                result = await session.execute(stmt)
                date_map = {d.id: d for d in result.scalars().all()}
                conflicts = [
                    {
                        "date": date_map[c.rehearsal_date_id].rehearsal_date.isoformat() if c.rehearsal_date_id in date_map else None,
                        "reason": c.reason,
                    }
                    for c in cast_conflicts
                ]

        # Get assignments
        stmt = select(CastAssignment).where(
            CastAssignment.production_id == production_id,
            CastAssignment.user_id == user_id,
        )
        result = await session.execute(stmt)
        assignments = result.scalars().all()
        assignment_date_ids = [a.rehearsal_date_id for a in assignments]
        assigned_dates = []
        if assignment_date_ids:
            stmt = select(RehearsalDate).where(RehearsalDate.id.in_(assignment_date_ids))
            result = await session.execute(stmt)
            for d in result.scalars().all():
                assigned_dates.append({
                    "id": d.id,
                    "date": d.rehearsal_date.isoformat(),
                    "type": d.type,
                    "start_time": d.start_time.strftime("%H:%M"),
                    "end_time": d.end_time.strftime("%H:%M"),
                })

        return {
            "user_id": user_id,
            "name": user.name if user else None,
            "email": user.email if user else None,
            "role": member.role,
            "display_name": profile.display_name if profile else None,
            "character": profile.role_character if profile else None,
            "phone": profile.phone if profile else None,
            "headshot_url": profile.headshot_url if profile else None,
            "conflicts_submitted": submission is not None,
            "conflicts": conflicts,
            "assigned_dates": assigned_dates,
        }
