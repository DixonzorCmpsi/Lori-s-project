"""Cast profile router."""

import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.database import async_session_maker
from app.models import ProductionMember, CastProfile
from app.routers.auth import get_current_user
from app.services.business_logic import FIELD_MAX_LENGTHS

router = APIRouter()


class CreateProfileRequest(BaseModel):
    display_name: str
    phone: Optional[str] = None
    role_character: Optional[str] = None


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


@router.get("/{production_id}/profile")
async def get_profile(
    production_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Get cast profile."""
    await check_production_member(production_id, current_user["id"])

    async with async_session_maker() as session:
        stmt = select(CastProfile).where(
            CastProfile.production_id == production_id,
            CastProfile.user_id == current_user["id"],
        )
        result = await session.execute(stmt)
        profile = result.scalar_one_or_none()

        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "NOT_FOUND", "message": "Profile not found"},
            )

        return {
            "id": profile.id,
            "display_name": profile.display_name,
            "phone": profile.phone,
            "role_character": profile.role_character,
            "headshot_url": profile.headshot_url,
        }


@router.post("/{production_id}/profile", status_code=201)
async def create_profile(
    production_id: str,
    body: CreateProfileRequest,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Create cast profile."""
    member = await check_production_member(production_id, current_user["id"])

    display_name = body.display_name
    phone = body.phone
    role_character = body.role_character

    if member.role != "cast":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "VALIDATION_ERROR",
                "message": "Only cast members need profiles",
            },
        )

    # Validate
    if len(display_name) > FIELD_MAX_LENGTHS.get("display_name", 200):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "VALIDATION_ERROR", "message": "Display name too long"},
        )

    if phone and len(phone) > FIELD_MAX_LENGTHS.get("phone", 20):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "VALIDATION_ERROR", "message": "Phone too long"},
        )

    if role_character and len(role_character) > FIELD_MAX_LENGTHS.get(
        "role_character", 200
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "VALIDATION_ERROR", "message": "Role too long"},
        )

    async with async_session_maker() as session:
        # Check if already exists
        stmt = select(CastProfile).where(
            CastProfile.production_id == production_id,
            CastProfile.user_id == current_user["id"],
        )
        result = await session.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"error": "CONFLICT", "message": "Profile already exists"},
            )

        profile = CastProfile(
            id=str(uuid.uuid4()),
            production_id=production_id,
            user_id=current_user["id"],
            display_name=display_name,
            phone=phone,
            role_character=role_character,
        )
        session.add(profile)
        await session.commit()

        return {
            "id": profile.id,
            "display_name": profile.display_name,
            "phone": profile.phone,
            "role_character": profile.role_character,
        }


@router.post("/{production_id}/profile/headshot")
async def upload_headshot(
    production_id: str,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Upload headshot image."""
    member = await check_production_member(production_id, current_user["id"])

    if member.role != "cast":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "VALIDATION_ERROR",
                "message": "Only cast members upload headshots",
            },
        )

    # Validate file size (5MB max)
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail={"error": "PAYLOAD_TOO_LARGE", "message": "File exceeds 5MB limit"},
        )

    # Validate magic bytes (JPEG: FF D8 FF, PNG: 89 50 4E 47)
    magic = contents[:4]
    if not (
        magic[:3] == b"\xff\xd8\xff"  # JPEG
        or magic == b"\x89PNG"  # PNG
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "VALIDATION_ERROR",
                "message": "Only JPEG and PNG files accepted",
            },
        )

    # Generate UUID filename
    filename = f"{uuid.uuid4()}.jpg"

    # In production, would upload to Supabase Storage
    # For now, just save the reference
    headshot_url = f"/uploads/headshots/{filename}"

    async with async_session_maker() as session:
        stmt = select(CastProfile).where(
            CastProfile.production_id == production_id,
            CastProfile.user_id == current_user["id"],
        )
        result = await session.execute(stmt)
        profile = result.scalar_one_or_none()

        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "NOT_FOUND", "message": "Profile not found"},
            )

        profile.headshot_url = headshot_url
        await session.commit()

        return {"headshot_url": headshot_url}


@router.delete("/{production_id}/profile/headshot")
async def delete_headshot(
    production_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Delete headshot."""
    member = await check_production_member(production_id, current_user["id"])

    if member.role != "cast":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error": "VALIDATION_ERROR",
                "message": "Only cast members can delete headshots",
            },
        )

    async with async_session_maker() as session:
        stmt = select(CastProfile).where(
            CastProfile.production_id == production_id,
            CastProfile.user_id == current_user["id"],
        )
        result = await session.execute(stmt)
        profile = result.scalar_one_or_none()

        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "NOT_FOUND", "message": "Profile not found"},
            )

        profile.headshot_url = None
        await session.commit()

        return {"message": "Headshot deleted"}
