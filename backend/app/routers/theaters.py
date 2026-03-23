"""Theaters router."""

import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.database import async_session_maker
from app.models import Theater, User, Production
from app.routers.auth import get_current_user
from app.services.business_logic import check_permission, FIELD_MAX_LENGTHS

router = APIRouter()


class CreateTheaterRequest(BaseModel):
    name: str = Field(..., max_length=200)
    city: str = Field(..., max_length=100)
    state: str = Field(..., max_length=100)


class UpdateTheaterRequest(BaseModel):
    name: Optional[str] = Field(None, max_length=200)
    city: Optional[str] = Field(None, max_length=100)
    state: Optional[str] = Field(None, max_length=100)


def require_director(current_user: dict, member_role: str = None) -> None:
    """Require director role."""
    if member_role and member_role != "director":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "FORBIDDEN", "message": "Directors only"},
        )


async def get_user_role(user_id: str, production_id: str = None) -> str:
    """Get user's role in a production."""
    from app.models import ProductionMember

    async with async_session_maker() as session:
        if production_id:
            stmt = select(ProductionMember).where(
                ProductionMember.user_id == user_id,
                ProductionMember.production_id == production_id,
            )
            result = await session.execute(stmt)
            member = result.scalar_one_or_none()
            return member.role if member else None
    return None


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_theater(
    body: CreateTheaterRequest,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Create a new theater."""
    name = body.name
    city = body.city
    state = body.state

    # Validate field lengths
    if len(name) > 200:
        raise HTTPException(status_code=400, detail={"error": "VALIDATION_ERROR", "message": "Invalid input", "fields": [{"field": "name", "message": "Must be 200 characters or fewer"}]})
    if len(city) > 100:
        raise HTTPException(status_code=400, detail={"error": "VALIDATION_ERROR", "message": "Invalid input", "fields": [{"field": "city", "message": "Must be 100 characters or fewer"}]})
    if len(state) > 100:
        raise HTTPException(status_code=400, detail={"error": "VALIDATION_ERROR", "message": "Invalid input", "fields": [{"field": "state", "message": "Must be 100 characters or fewer"}]})

    # Check if user already has a theater
    async with async_session_maker() as session:
        stmt = select(Theater).where(Theater.owner_id == current_user["id"])
        result = await session.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error": "CONFLICT", "message": "You already have a theater."},
            )

        # Validate field lengths
        if len(name) > FIELD_MAX_LENGTHS.get("theater_name", 200):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "VALIDATION_ERROR",
                    "message": "Invalid input",
                    "fields": [
                        {
                            "field": "name",
                            "message": f"Must be {FIELD_MAX_LENGTHS.get('theater_name', 200)} characters or fewer",
                        }
                    ],
                },
            )

        if len(city) > FIELD_MAX_LENGTHS.get("city", 100):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "VALIDATION_ERROR",
                    "message": "Invalid input",
                    "fields": [
                        {
                            "field": "city",
                            "message": f"Must be {FIELD_MAX_LENGTHS.get('city', 100)} characters or fewer",
                        }
                    ],
                },
            )

        if len(state) > FIELD_MAX_LENGTHS.get("state", 100):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "error": "VALIDATION_ERROR",
                    "message": "Invalid input",
                    "fields": [
                        {
                            "field": "state",
                            "message": f"Must be {FIELD_MAX_LENGTHS.get('state', 100)} characters or fewer",
                        }
                    ],
                },
            )

        theater = Theater(
            id=str(uuid.uuid4()),
            owner_id=current_user["id"],
            name=name,
            city=city,
            state=state,
        )
        session.add(theater)
        await session.commit()

        return {
            "id": theater.id,
            "name": theater.name,
            "city": theater.city,
            "state": theater.state,
            "created_at": theater.created_at.isoformat(),
        }


@router.get("")
async def list_theatros(
    current_user: dict = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """List user's theaters."""
    async with async_session_maker() as session:
        stmt = select(Theater).where(Theater.owner_id == current_user["id"])
        result = await session.execute(stmt)
        theaters = result.scalars().all()

        return [
            {
                "id": t.id,
                "name": t.name,
                "city": t.city,
                "state": t.state,
                "created_at": t.created_at.isoformat(),
            }
            for t in theaters
        ]


@router.get("/{theater_id}")
async def get_theater(
    theater_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Get a specific theater."""
    async with async_session_maker() as session:
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

        return {
            "id": theater.id,
            "name": theater.name,
            "city": theater.city,
            "state": theater.state,
            "created_at": theater.created_at.isoformat(),
        }


@router.put("/{theater_id}")
async def update_theater(
    theater_id: str,
    name: str = None,
    city: str = None,
    state: str = None,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Update a theater."""
    async with async_session_maker() as session:
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

        if name is not None:
            if len(name) > FIELD_MAX_LENGTHS.get("theater_name", 200):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"error": "VALIDATION_ERROR", "message": "Name too long"},
                )
            theater.name = name

        if city is not None:
            if len(city) > FIELD_MAX_LENGTHS.get("city", 100):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"error": "VALIDATION_ERROR", "message": "City too long"},
                )
            theater.city = city

        if state is not None:
            if len(state) > FIELD_MAX_LENGTHS.get("state", 100):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={"error": "VALIDATION_ERROR", "message": "State too long"},
                )
            theater.state = state

        await session.commit()

        return {
            "id": theater.id,
            "name": theater.name,
            "city": theater.city,
            "state": theater.state,
        }


@router.delete("/{theater_id}")
async def delete_theater(
    theater_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Delete a theater."""
    async with async_session_maker() as session:
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

        await session.delete(theater)
        await session.commit()

        return {"message": "Theater deleted"}
