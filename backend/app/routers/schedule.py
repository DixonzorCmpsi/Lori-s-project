"""Schedule router."""

import uuid
from datetime import date, datetime, time, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.database import async_session_maker
from app.models import Production, ProductionMember, RehearsalDate
from app.routers.auth import get_current_user
from app.services.business_logic import generate_schedule

router = APIRouter()


class ScheduleWizardRequest(BaseModel):
    selected_days: list[str]
    start_time: str
    end_time: str
    blocked_dates: list[str] = []
    tech_week_enabled: bool = False
    tech_week_days: int = 0
    dress_rehearsal_enabled: bool = False


class AddDateRequest(BaseModel):
    date: str
    start_time: str
    end_time: str
    type: str


class UpdateDateRequest(BaseModel):
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    note: Optional[str] = None


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


async def check_can_edit_schedule(member: ProductionMember):
    """Check if member can edit schedule."""
    if member.role not in ("director", "staff"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "FORBIDDEN", "message": "Not authorized to edit schedule"},
        )


@router.post("/{production_id}/schedule/generate", status_code=201)
async def generate_production_schedule(
    production_id: str,
    body: ScheduleWizardRequest,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Generate schedule for a production."""
    member = await check_production_member(production_id, current_user["id"])
    await check_can_edit_schedule(member)

    selected_days = body.selected_days
    start_time = body.start_time
    end_time = body.end_time
    blocked_dates = body.blocked_dates
    tech_week_enabled = body.tech_week_enabled
    tech_week_days = body.tech_week_days
    dress_rehearsal_enabled = body.dress_rehearsal_enabled

    # Get production dates
    async with async_session_maker() as session:
        stmt = select(Production).where(Production.id == production_id)
        result = await session.execute(stmt)
        production = result.scalar_one_or_none()

        if not production:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "NOT_FOUND", "message": "Production not found"},
            )

        # Parse blocked dates
        blocked = [date.fromisoformat(d) for d in blocked_dates]

        # Parse times
        start = time.fromisoformat(start_time)
        end = time.fromisoformat(end_time)

        # Generate schedule
        result = generate_schedule(
            first_rehearsal=production.first_rehearsal,
            opening_night=production.opening_night,
            closing_night=production.closing_night,
            selected_days=selected_days,
            start_time=start,
            end_time=end,
            blocked_dates=blocked,
            tech_week_enabled=tech_week_enabled,
            tech_week_days=tech_week_days,
            dress_rehearsal_enabled=dress_rehearsal_enabled,
        )

        if "error" in result:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": "VALIDATION_ERROR", "message": result["error"]},
            )

        # Create rehearsal dates in DB
        for d in result["dates"]:
            rehearsal = RehearsalDate(
                id=str(uuid.uuid4()),
                production_id=production_id,
                rehearsal_date=d["date"],
                start_time=d["start_time"],
                end_time=d["end_time"],
                type=d["type"],
            )
            session.add(rehearsal)

        await session.commit()

        return result


@router.get("/{production_id}/schedule")
async def get_schedule(
    production_id: str,
    current_user: dict = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Get production schedule."""
    member = await check_production_member(production_id, current_user["id"])

    async with async_session_maker() as session:
        if member.role == "cast":
            stmt = select(RehearsalDate).where(
                RehearsalDate.production_id == production_id,
                RehearsalDate.is_deleted == False,
            )
        else:
            stmt = select(RehearsalDate).where(
                RehearsalDate.production_id == production_id,
            )

        result = await session.execute(stmt)
        dates = result.scalars().all()

        return [
            {
                "id": d.id,
                "date": d.rehearsal_date.isoformat(),
                "start_time": d.start_time.strftime("%H:%M"),
                "end_time": d.end_time.strftime("%H:%M"),
                "type": d.type,
                "note": d.note,
                "is_cancelled": d.is_cancelled,
                "is_deleted": d.is_deleted,
            }
            for d in dates
        ]


@router.post("/{production_id}/schedule", status_code=201)
async def add_rehearsal_date(
    production_id: str,
    body: AddDateRequest,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Add a new rehearsal date."""
    member = await check_production_member(production_id, current_user["id"])
    await check_can_edit_schedule(member)

    date_str = body.date
    start_time = body.start_time
    end_time = body.end_time
    date_type = body.type

    if date_type not in ("regular", "tech", "dress", "performance", "blocked"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "VALIDATION_ERROR", "message": "Invalid type"},
        )

    async with async_session_maker() as session:
        rehearsal = RehearsalDate(
            id=str(uuid.uuid4()),
            production_id=production_id,
            rehearsal_date=date.fromisoformat(date_str),
            start_time=time.fromisoformat(start_time),
            end_time=time.fromisoformat(end_time),
            type=date_type,
        )
        session.add(rehearsal)
        await session.commit()

        return {
            "id": rehearsal.id,
            "date": rehearsal.rehearsal_date.isoformat(),
            "start_time": rehearsal.start_time.strftime("%H:%M"),
            "end_time": rehearsal.end_time.strftime("%H:%M"),
            "type": rehearsal.type,
        }


@router.patch("/{production_id}/schedule/{date_id}")
async def update_rehearsal_date(
    production_id: str,
    date_id: str,
    body: UpdateDateRequest,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Update a rehearsal date."""
    member = await check_production_member(production_id, current_user["id"])
    await check_can_edit_schedule(member)

    start_time = body.start_time
    end_time = body.end_time
    note = body.note

    async with async_session_maker() as session:
        stmt = select(RehearsalDate).where(
            RehearsalDate.id == date_id,
            RehearsalDate.production_id == production_id,
        )
        result = await session.execute(stmt)
        rehearsal = result.scalar_one_or_none()

        if not rehearsal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "NOT_FOUND", "message": "Date not found"},
            )

        if start_time:
            if time.fromisoformat(start_time) >= rehearsal.end_time:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "error": "VALIDATION_ERROR",
                        "message": "Start time must be before end time",
                    },
                )
            rehearsal.start_time = time.fromisoformat(start_time)

        if end_time:
            rehearsal.end_time = time.fromisoformat(end_time)

        if note is not None:
            if len(note) > 1000:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"error": "VALIDATION_ERROR", "message": "Note too long"},
                )
            rehearsal.note = note

        await session.commit()

        return {
            "id": rehearsal.id,
            "date": rehearsal.rehearsal_date.isoformat(),
            "start_time": rehearsal.start_time.strftime("%H:%M"),
            "end_time": rehearsal.end_time.strftime("%H:%M"),
            "note": rehearsal.note,
        }


@router.post("/{production_id}/schedule/{date_id}/cancel")
async def cancel_rehearsal(
    production_id: str,
    date_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Cancel a rehearsal."""
    member = await check_production_member(production_id, current_user["id"])
    await check_can_edit_schedule(member)

    async with async_session_maker() as session:
        stmt = select(RehearsalDate).where(
            RehearsalDate.id == date_id,
            RehearsalDate.production_id == production_id,
        )
        result = await session.execute(stmt)
        rehearsal = result.scalar_one_or_none()

        if not rehearsal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "NOT_FOUND", "message": "Date not found"},
            )

        rehearsal.is_cancelled = True
        await session.commit()

        return {
            "id": rehearsal.id,
            "is_cancelled": rehearsal.is_cancelled,
        }


@router.delete("/{production_id}/schedule/{date_id}")
async def delete_rehearsal(
    production_id: str,
    date_id: str,
    permanent: bool = False,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Delete (soft or hard) a rehearsal date."""
    member = await check_production_member(production_id, current_user["id"])
    await check_can_edit_schedule(member)

    async with async_session_maker() as session:
        stmt = select(RehearsalDate).where(
            RehearsalDate.id == date_id,
            RehearsalDate.production_id == production_id,
        )
        result = await session.execute(stmt)
        rehearsal = result.scalar_one_or_none()

        if not rehearsal:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "NOT_FOUND", "message": "Date not found"},
            )

        if permanent:
            # Hard delete - remove conflicts too
            from app.models import CastConflict

            stmt = select(CastConflict).where(CastConflict.rehearsal_date_id == date_id)
            result = await session.execute(stmt)
            conflicts = result.scalars().all()
            for c in conflicts:
                await session.delete(c)

            await session.delete(rehearsal)
        else:
            # Soft delete
            rehearsal.is_deleted = True
            rehearsal.deleted_at = datetime.utcnow()

        await session.commit()

        return {"message": "Rehearsal deleted"}
