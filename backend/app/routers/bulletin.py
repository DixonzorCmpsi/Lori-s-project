"""Bulletin board router."""

import uuid
from datetime import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from app.database import async_session_maker
from app.models import Production, ProductionMember, BulletinPost
from app.routers.auth import get_current_user
from app.services.business_logic import sanitize_markdown, FIELD_MAX_LENGTHS

router = APIRouter()


class CreatePostRequest(BaseModel):
    title: str
    body: str


class UpdatePostRequest(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None


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


@router.get("/{production_id}/bulletin")
async def get_bulletin_posts(
    production_id: str,
    current_user: dict = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Get all bulletin posts."""
    await check_production_member(production_id, current_user["id"])

    async with async_session_maker() as session:
        stmt = (
            select(BulletinPost)
            .where(
                BulletinPost.production_id == production_id,
            )
            .order_by(BulletinPost.is_pinned.desc(), BulletinPost.created_at.desc())
        )

        result = await session.execute(stmt)
        posts = result.scalars().all()

        return [
            {
                "id": p.id,
                "title": p.title,
                "body": p.body,
                "author_id": p.author_id,
                "is_pinned": p.is_pinned,
                "created_at": p.created_at.isoformat(),
                "updated_at": p.updated_at.isoformat()
                if p.updated_at != p.created_at
                else None,
            }
            for p in posts
        ]


@router.post("/{production_id}/bulletin", status_code=201)
async def create_bulletin_post(
    production_id: str,
    body: CreatePostRequest,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Create a new bulletin post."""
    member = await check_production_member(production_id, current_user["id"])

    title = body.title
    post_body = body.body

    if member.role not in ("director", "staff"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "FORBIDDEN", "message": "Not authorized to post"},
        )

    # Check production is not archived
    async with async_session_maker() as session:
        stmt = select(Production).where(Production.id == production_id)
        result = await session.execute(stmt)
        production = result.scalar_one_or_none()

        if production and production.is_archived:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "FORBIDDEN",
                    "message": "Production is archived - read only",
                },
            )

        # Validate
        if len(title) > FIELD_MAX_LENGTHS.get("post_title", 200):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": "VALIDATION_ERROR", "message": "Title too long"},
            )

        if len(post_body) > FIELD_MAX_LENGTHS.get("post_body", 10000):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"error": "VALIDATION_ERROR", "message": "Body too long"},
            )

        # Sanitize markdown
        sanitized_body = sanitize_markdown(post_body)

        post = BulletinPost(
            id=str(uuid.uuid4()),
            production_id=production_id,
            author_id=current_user["id"],
            title=title,
            body=sanitized_body,
        )
        session.add(post)
        await session.commit()

        return {
            "id": post.id,
            "title": post.title,
            "body": post.body,
            "author_id": post.author_id,
            "is_pinned": post.is_pinned,
            "created_at": post.created_at.isoformat(),
        }


@router.patch("/{production_id}/bulletin/{post_id}")
async def update_bulletin_post(
    production_id: str,
    post_id: str,
    body: UpdatePostRequest,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Update a bulletin post."""
    member = await check_production_member(production_id, current_user["id"])

    title = body.title
    post_body = body.body

    async with async_session_maker() as session:
        stmt = select(BulletinPost).where(
            BulletinPost.id == post_id,
            BulletinPost.production_id == production_id,
        )
        result = await session.execute(stmt)
        post = result.scalar_one_or_none()

        if not post:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "NOT_FOUND", "message": "Post not found"},
            )

        # Check permissions: director can edit any, staff can edit own only
        if member.role == "cast":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": "FORBIDDEN", "message": "Not authorized"},
            )

        if member.role == "staff" and post.author_id != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "FORBIDDEN",
                    "message": "Cannot edit other people's posts",
                },
            )

        if title is not None:
            post.title = title

        if post_body is not None:
            post.body = sanitize_markdown(post_body)

        await session.commit()

        return {
            "id": post.id,
            "title": post.title,
            "body": post.body,
            "updated_at": post.updated_at.isoformat(),
        }


@router.delete("/{production_id}/bulletin/{post_id}")
async def delete_bulletin_post(
    production_id: str,
    post_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Delete a bulletin post."""
    member = await check_production_member(production_id, current_user["id"])

    async with async_session_maker() as session:
        stmt = select(BulletinPost).where(
            BulletinPost.id == post_id,
            BulletinPost.production_id == production_id,
        )
        result = await session.execute(stmt)
        post = result.scalar_one_or_none()

        if not post:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "NOT_FOUND", "message": "Post not found"},
            )

        # Check permissions
        if member.role == "cast":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": "FORBIDDEN", "message": "Cannot delete posts"},
            )

        if member.role == "staff" and post.author_id != current_user["id"]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "FORBIDDEN",
                    "message": "Cannot delete other people's posts",
                },
            )

        await session.delete(post)
        await session.commit()

        return {"message": "Post deleted"}


@router.post("/{production_id}/bulletin/{post_id}/pin")
async def pin_bulletin_post(
    production_id: str,
    post_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Pin/unpin a bulletin post."""
    member = await check_production_member(production_id, current_user["id"])

    if member.role not in ("director", "staff"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "FORBIDDEN", "message": "Not authorized"},
        )

    async with async_session_maker() as session:
        stmt = select(BulletinPost).where(
            BulletinPost.id == post_id,
            BulletinPost.production_id == production_id,
        )
        result = await session.execute(stmt)
        post = result.scalar_one_or_none()

        if not post:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "NOT_FOUND", "message": "Post not found"},
            )

        # Unpin previous pinned post
        stmt = select(BulletinPost).where(
            BulletinPost.production_id == production_id,
            BulletinPost.is_pinned == True,
        )
        result = await session.execute(stmt)
        prev_pinned = result.scalar_one_or_none()

        if prev_pinned:
            prev_pinned.is_pinned = False

        # Toggle pin
        post.is_pinned = not post.is_pinned
        await session.commit()

        return {
            "id": post.id,
            "is_pinned": post.is_pinned,
        }
