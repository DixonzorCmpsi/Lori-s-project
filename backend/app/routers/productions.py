"""Productions router."""

import uuid
from datetime import date, datetime, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.database import async_session_maker
from app.models import Production, ProductionMember, Theater, User
from app.routers.auth import get_current_user
from app.services.business_logic import validate_production_dates, FIELD_MAX_LENGTHS

router = APIRouter()


class CreateProductionRequest(BaseModel):
    name: str
    theater_id: str
    estimated_cast_size: int
    first_rehearsal: str
    opening_night: str
    closing_night: str


class UpdateProductionRequest(BaseModel):
    name: Optional[str] = None


@router.post("", status_code=201)
async def create_production(
    body: CreateProductionRequest,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Create a new production."""
    theater_id = body.theater_id
    name = body.name
    estimated_cast_size = body.estimated_cast_size
    first_rehearsal = body.first_rehearsal
    opening_night = body.opening_night
    closing_night = body.closing_night

    try:
        first_reh_date = date.fromisoformat(first_rehearsal)
        opening_date = date.fromisoformat(opening_night)
        closing_date = date.fromisoformat(closing_night)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "VALIDATION_ERROR", "message": "Invalid date format"},
        )

    # Validate dates are in the future
    today = date.today()
    if first_reh_date < today:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "VALIDATION_ERROR", "message": "Dates must be in the future"},
        )

    # Validate date ordering
    validation = validate_production_dates(first_reh_date, opening_date, closing_date)
    if not validation["valid"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "VALIDATION_ERROR",
                "message": "Invalid date ordering: first_rehearsal <= opening_night <= closing_night",
            },
        )

    # Check for active production
    async with async_session_maker() as session:
        # Check theater exists and belongs to user
        stmt = select(Theater).where(Theater.id == theater_id)
        result = await session.execute(stmt)
        theater = result.scalar_one_or_none()

        if not theater:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "NOT_FOUND", "message": "Theater not found"},
            )

        if theater.owner_id != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": "FORBIDDEN", "message": "Not authorized"},
            )

        # Check for active production
        stmt = select(Production).where(
            Production.theater_id == theater_id,
            Production.is_archived == False,
        )
        result = await session.execute(stmt)
        active = result.scalar_one_or_none()

        if active:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "error": "CONFLICT",
                    "message": "You already have an active production.",
                },
            )

        # Validate field lengths
        if len(name) > FIELD_MAX_LENGTHS.get("production_name", 200):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "VALIDATION_ERROR",
                    "message": "Name too long",
                    "fields": [
                        {
                            "field": "name",
                            "message": f"Must be {FIELD_MAX_LENGTHS.get('production_name', 200)} characters or fewer",
                        }
                    ],
                },
            )

        if estimated_cast_size < 1 or estimated_cast_size > 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "VALIDATION_ERROR",
                    "message": "Cast size must be between 1 and 200",
                },
            )

        production = Production(
            id=str(uuid.uuid4()),
            theater_id=theater_id,
            name=name,
            estimated_cast_size=estimated_cast_size,
            first_rehearsal=first_reh_date,
            opening_night=opening_date,
            closing_night=closing_date,
        )
        session.add(production)

        # Auto-join as director
        member = ProductionMember(
            production_id=production.id,
            user_id=current_user["id"],
            role="director",
        )
        session.add(member)
        await session.commit()

        return {
            "id": production.id,
            "name": production.name,
            "estimated_cast_size": production.estimated_cast_size,
            "first_rehearsal": production.first_rehearsal.isoformat(),
            "opening_night": production.opening_night.isoformat(),
            "closing_night": production.closing_night.isoformat(),
            "is_archived": production.is_archived,
            "created_at": production.created_at.isoformat(),
        }


@router.get("")
async def list_productions(
    current_user: dict = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """List user's productions."""
    # Check if user has completed profile (age_range set)
    async with async_session_maker() as session:
        user_result = await session.execute(select(User).where(User.id == current_user["id"]))
        user = user_result.scalar_one_or_none()
        if user and user.age_range is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": "FORBIDDEN", "message": "Please complete your profile first"},
            )
        stmt = select(ProductionMember).where(
            ProductionMember.user_id == current_user["id"]
        )
        result = await session.execute(stmt)
        members = result.scalars().all()

        production_ids = [m.production_id for m in members]

        if not production_ids:
            return []

        stmt = select(Production).where(Production.id.in_(production_ids))
        result = await session.execute(stmt)
        productions = result.scalars().all()

        return [
            {
                "id": p.id,
                "name": p.name,
                "first_rehearsal": p.first_rehearsal.isoformat(),
                "opening_night": p.opening_night.isoformat(),
                "closing_night": p.closing_night.isoformat(),
                "is_archived": p.is_archived,
            }
            for p in productions
        ]


@router.get("/{production_id}")
async def get_production(
    production_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Get a production."""
    async with async_session_maker() as session:
        # Check membership
        stmt = select(ProductionMember).where(
            ProductionMember.user_id == current_user["id"],
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

        stmt = select(Production).where(Production.id == production_id)
        result = await session.execute(stmt)
        production = result.scalar_one_or_none()

        if not production:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "NOT_FOUND", "message": "Production not found"},
            )

        return {
            "id": production.id,
            "name": production.name,
            "first_rehearsal": production.first_rehearsal.isoformat(),
            "opening_night": production.opening_night.isoformat(),
            "closing_night": production.closing_night.isoformat(),
            "is_archived": production.is_archived,
            "archived_at": production.archived_at.isoformat()
            if production.archived_at
            else None,
            "role": member.role,
        }


@router.patch("/{production_id}")
async def update_production(
    production_id: str,
    body: UpdateProductionRequest,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Update a production."""
    name = body.name

    async with async_session_maker() as session:
        stmt = select(ProductionMember).where(
            ProductionMember.user_id == current_user["id"],
            ProductionMember.production_id == production_id,
        )
        result = await session.execute(stmt)
        member = result.scalar_one_or_none()

        if not member or member.role not in ("director", "staff"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": "FORBIDDEN", "message": "Not authorized"},
            )

        stmt = select(Production).where(Production.id == production_id)
        result = await session.execute(stmt)
        production = result.scalar_one_or_none()

        if not production:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "NOT_FOUND", "message": "Production not found"},
            )

        if name is not None:
            if len(name) > FIELD_MAX_LENGTHS.get("production_name", 200):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"error": "VALIDATION_ERROR", "message": "Name too long"},
                )
            production.name = name

        await session.commit()

        return {
            "id": production.id,
            "name": production.name,
        }


@router.delete("/{production_id}")
async def delete_production(
    production_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Delete a production."""
    async with async_session_maker() as session:
        stmt = select(ProductionMember).where(
            ProductionMember.user_id == current_user["id"],
            ProductionMember.production_id == production_id,
            ProductionMember.role == "director",
        )
        result = await session.execute(stmt)
        member = result.scalar_one_or_none()

        if not member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "FORBIDDEN",
                    "message": "Only director can delete production",
                },
            )

        stmt = select(Production).where(Production.id == production_id)
        result = await session.execute(stmt)
        production = result.scalar_one_or_none()

        if not production:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "NOT_FOUND", "message": "Production not found"},
            )

        await session.delete(production)
        await session.commit()

        return {"message": "Production deleted"}


@router.post("/{production_id}/archive")
async def archive_production(
    production_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Archive a production."""
    async with async_session_maker() as session:
        stmt = select(ProductionMember).where(
            ProductionMember.user_id == current_user["id"],
            ProductionMember.production_id == production_id,
            ProductionMember.role == "director",
        )
        result = await session.execute(stmt)
        member = result.scalar_one_or_none()

        if not member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": "FORBIDDEN", "message": "Only director can archive"},
            )

        stmt = select(Production).where(Production.id == production_id)
        result = await session.execute(stmt)
        production = result.scalar_one_or_none()

        if not production:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "NOT_FOUND", "message": "Production not found"},
            )

        production.is_archived = True
        production.archived_at = datetime.utcnow()

        # Deactivate invite tokens
        from app.models import InviteToken

        stmt = select(InviteToken).where(InviteToken.production_id == production_id)
        result = await session.execute(stmt)
        tokens = result.scalars().all()
        for token in tokens:
            token.use_count = token.max_uses  # Deactivate

        await session.commit()

        return {
            "id": production.id,
            "is_archived": production.is_archived,
            "archived_at": production.archived_at.isoformat(),
        }


@router.post("/{production_id}/unarchive")
async def unarchive_production(
    production_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Unarchive a production within 90-day window."""
    async with async_session_maker() as session:
        stmt = select(ProductionMember).where(
            ProductionMember.user_id == current_user["id"],
            ProductionMember.production_id == production_id,
            ProductionMember.role == "director",
        )
        result = await session.execute(stmt)
        member = result.scalar_one_or_none()

        if not member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": "FORBIDDEN", "message": "Only director can unarchive"},
            )

        stmt = select(Production).where(Production.id == production_id)
        result = await session.execute(stmt)
        production = result.scalar_one_or_none()

        if not production:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "NOT_FOUND", "message": "Production not found"},
            )

        if production.archived_at:
            days_since_archive = (datetime.utcnow() - production.archived_at).days
            if days_since_archive > 90:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "error": "VALIDATION_ERROR",
                        "message": "Cannot unarchive after 90 days",
                    },
                )

        production.is_archived = False
        production.archived_at = None
        await session.commit()

        return {
            "id": production.id,
            "is_archived": production.is_archived,
        }
