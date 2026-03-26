"""Attendance / check-in system — cast members check in for rehearsals."""

from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Attendance, ProductionMember, RehearsalDate
from app.routers.auth import get_current_user

router = APIRouter(prefix="/productions/{production_id}/attendance", tags=["attendance"])


class CheckInRequest(BaseModel):
    rehearsal_date_id: str


async def _require_member(production_id: str, user_id: str, db: AsyncSession) -> ProductionMember:
    result = await db.execute(
        select(ProductionMember).where(
            ProductionMember.production_id == production_id,
            ProductionMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=403, detail={"error": "FORBIDDEN", "message": "Not a production member"})
    return member


async def _require_staff(production_id: str, user_id: str, db: AsyncSession):
    member = await _require_member(production_id, user_id, db)
    if member.role not in ("director", "staff"):
        raise HTTPException(status_code=403, detail={"error": "FORBIDDEN", "message": "Staff or director required"})
    return member


@router.post("/check-in", status_code=201)
async def check_in(production_id: str, body: CheckInRequest, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """Cast member checks in for a rehearsal date."""
    member = await _require_member(production_id, user["sub"], db)

    # Verify rehearsal date exists and belongs to this production
    rd = (await db.execute(
        select(RehearsalDate).where(
            RehearsalDate.id == body.rehearsal_date_id,
            RehearsalDate.production_id == production_id,
            RehearsalDate.is_deleted == False,
            RehearsalDate.is_cancelled == False,
        )
    )).scalar_one_or_none()
    if not rd:
        raise HTTPException(status_code=404, detail={"error": "NOT_FOUND", "message": "Rehearsal date not found or cancelled"})

    # Check if already checked in
    existing = (await db.execute(
        select(Attendance).where(
            Attendance.rehearsal_date_id == body.rehearsal_date_id,
            Attendance.user_id == user["sub"],
        )
    )).scalar_one_or_none()
    if existing:
        return {"id": existing.id, "status": existing.status, "checked_in_at": existing.checked_in_at.isoformat(), "already_checked_in": True}

    record = Attendance(
        production_id=production_id,
        rehearsal_date_id=body.rehearsal_date_id,
        user_id=user["sub"],
        status="present",
    )
    db.add(record)
    await db.flush()

    return {"id": record.id, "status": record.status, "checked_in_at": record.checked_in_at.isoformat(), "already_checked_in": False}


@router.get("/{rehearsal_date_id}")
async def get_attendance(production_id: str, rehearsal_date_id: str, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """Get attendance for a specific rehearsal date. Directors see all, cast sees own."""
    member = await _require_member(production_id, user["sub"], db)

    if member.role in ("director", "staff"):
        # Directors see everyone's attendance
        records = (await db.execute(
            select(Attendance).where(Attendance.rehearsal_date_id == rehearsal_date_id)
        )).scalars().all()

        # Get all production members to find who's missing
        all_members = (await db.execute(
            select(ProductionMember).where(ProductionMember.production_id == production_id)
        )).scalars().all()

        checked_in_ids = {r.user_id for r in records}

        return {
            "rehearsal_date_id": rehearsal_date_id,
            "checked_in": [
                {"user_id": r.user_id, "status": r.status, "checked_in_at": r.checked_in_at.isoformat()}
                for r in records
            ],
            "not_checked_in": [
                {"user_id": m.user_id, "role": m.role}
                for m in all_members if m.user_id not in checked_in_ids
            ],
            "total_members": len(all_members),
            "total_checked_in": len(records),
        }
    else:
        # Cast sees only own check-in status
        record = (await db.execute(
            select(Attendance).where(
                Attendance.rehearsal_date_id == rehearsal_date_id,
                Attendance.user_id == user["sub"],
            )
        )).scalar_one_or_none()

        return {
            "rehearsal_date_id": rehearsal_date_id,
            "checked_in": record is not None,
            "status": record.status if record else None,
            "checked_in_at": record.checked_in_at.isoformat() if record else None,
        }


@router.put("/{rehearsal_date_id}/status/{user_id}")
async def update_attendance_status(
    production_id: str, rehearsal_date_id: str, user_id: str,
    status: str,
    user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> dict[str, Any]:
    """Director marks a member as late/absent/excused."""
    await _require_staff(production_id, user["sub"], db)

    if status not in ("present", "late", "absent", "excused"):
        raise HTTPException(status_code=400, detail={"error": "INVALID", "message": "Status must be present, late, absent, or excused"})

    record = (await db.execute(
        select(Attendance).where(
            Attendance.rehearsal_date_id == rehearsal_date_id,
            Attendance.user_id == user_id,
        )
    )).scalar_one_or_none()

    if record:
        record.status = status
    else:
        # Create record with the given status (e.g. marking absent before they check in)
        record = Attendance(
            production_id=production_id,
            rehearsal_date_id=rehearsal_date_id,
            user_id=user_id,
            status=status,
        )
        db.add(record)

    await db.flush()
    return {"user_id": user_id, "status": status}


@router.get("")
async def get_attendance_summary(production_id: str, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> list[dict[str, Any]]:
    """Get attendance summary across all rehearsal dates for this production."""
    await _require_staff(production_id, user["sub"], db)

    # Get all rehearsal dates
    dates = (await db.execute(
        select(RehearsalDate).where(
            RehearsalDate.production_id == production_id,
            RehearsalDate.is_deleted == False,
        ).order_by(RehearsalDate.rehearsal_date.desc())
    )).scalars().all()

    total_members = (await db.execute(
        select(func.count(ProductionMember.id)).where(ProductionMember.production_id == production_id)
    )).scalar() or 0

    summary = []
    for d in dates:
        count = (await db.execute(
            select(func.count(Attendance.id)).where(Attendance.rehearsal_date_id == d.id)
        )).scalar() or 0

        summary.append({
            "rehearsal_date_id": d.id,
            "date": d.rehearsal_date.isoformat(),
            "type": d.type,
            "checked_in": count,
            "total": total_members,
            "is_cancelled": d.is_cancelled,
        })

    return summary
