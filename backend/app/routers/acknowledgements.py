"""Acknowledgement tracking — who has confirmed they saw an announcement or report."""

import time
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Acknowledgement, BulletinPost, User
from app.routers.auth import get_current_user
from app.services.access import (
    get_production,
    invalid,
    members_with_users,
    not_found,
    require_member,
    require_staff,
    require_writable,
)
from app.services.email import send_ack_reminder_email

router = APIRouter(prefix="/productions/{production_id}", tags=["acknowledgements"])

# Reminders are limited to one per post every few minutes so staff can't spam the cast.
REMIND_COOLDOWN_SECONDS = 300
_last_reminder: dict[str, float] = {}


async def _get_post(production_id: str, post_id: str, db: AsyncSession) -> BulletinPost:
    post = (
        await db.execute(
            select(BulletinPost).where(
                BulletinPost.id == post_id, BulletinPost.production_id == production_id
            )
        )
    ).scalar_one_or_none()
    if not post:
        raise not_found("Post not found")
    return post


async def ack_status(
    production_id: str, kind: str, target_id: str, author_id: str | None, db: AsyncSession
) -> dict[str, list[dict[str, Any]]]:
    """Split production members into who has and has not acknowledged a target."""
    acks = (
        (
            await db.execute(
                select(Acknowledgement).where(
                    Acknowledgement.kind == kind, Acknowledgement.target_id == target_id
                )
            )
        )
        .scalars()
        .all()
    )
    acked_at = {a.user_id: a.acknowledged_at for a in acks}
    done, pending = [], []
    for member, user in await members_with_users(production_id, db):
        if user.id == author_id:
            continue
        entry = {"user_id": user.id, "name": user.name, "role": member.role}
        if user.id in acked_at:
            done.append({**entry, "acknowledged_at": acked_at[user.id].isoformat()})
        else:
            pending.append(entry)
    done.sort(key=lambda e: e["name"].lower())
    pending.sort(key=lambda e: e["name"].lower())
    return {"acknowledged": done, "pending": pending}


@router.post("/bulletin/{post_id}/ack")
async def acknowledge_post(
    production_id: str,
    post_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """The current member confirms they have read a post. Safe to call more than once."""
    await require_member(production_id, user["id"], db)
    post = await _get_post(production_id, post_id, db)
    if not post.requires_ack:
        raise invalid("This post does not ask for confirmation")

    existing = (
        await db.execute(
            select(Acknowledgement).where(
                Acknowledgement.kind == "bulletin",
                Acknowledgement.target_id == post_id,
                Acknowledgement.user_id == user["id"],
            )
        )
    ).scalar_one_or_none()
    if not existing:
        existing = Acknowledgement(
            production_id=production_id, kind="bulletin", target_id=post_id, user_id=user["id"]
        )
        db.add(existing)
        await db.flush()
    return {"post_id": post_id, "acknowledged": True, "at": existing.acknowledged_at.isoformat()}


@router.get("/bulletin/{post_id}/acks")
async def list_post_acks(
    production_id: str,
    post_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Staff: who has and has not confirmed a post."""
    await require_staff(production_id, user["id"], db)
    post = await _get_post(production_id, post_id, db)
    status = await ack_status(production_id, "bulletin", post_id, post.author_id, db)
    return {
        "post_id": post_id,
        "title": post.title,
        "requires_ack": post.requires_ack,
        **status,
    }


@router.post("/bulletin/{post_id}/acks/remind")
async def remind_pending(
    production_id: str,
    post_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Staff: email a reminder to everyone who has not confirmed yet."""
    await require_staff(production_id, user["id"], db)
    await require_writable(production_id, db)
    production = await get_production(production_id, db)
    post = await _get_post(production_id, post_id, db)
    if not post.requires_ack:
        raise invalid("This post does not ask for confirmation")

    now = time.monotonic()
    last = _last_reminder.get(post_id)
    if last is not None and now - last < REMIND_COOLDOWN_SECONDS:
        raise invalid(
            "A reminder was just sent. Please wait a few minutes before sending another.",
            code="RATE_LIMITED",
            status_code=429,
        )

    status = await ack_status(production_id, "bulletin", post_id, post.author_id, db)
    pending_ids = [p["user_id"] for p in status["pending"]]
    emailed = 0
    if pending_ids:
        users = (await db.execute(select(User).where(User.id.in_(pending_ids)))).scalars().all()
        for u in users:
            if u.email_notifications and send_ack_reminder_email(
                u.email, production.name, production_id, post.title
            ):
                emailed += 1
    _last_reminder[post_id] = now
    return {"pending": len(pending_ids), "emailed": emailed}


@router.get("/acks/pending")
async def my_pending_acks(
    production_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """Items that ask for the current member's confirmation and have not got it yet."""
    await require_member(production_id, user["id"], db)
    posts = (
        (
            await db.execute(
                select(BulletinPost)
                .where(
                    BulletinPost.production_id == production_id,
                    BulletinPost.requires_ack == True,  # noqa: E712
                    BulletinPost.author_id != user["id"],
                )
                .order_by(BulletinPost.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    if not posts:
        return []
    done = {
        t
        for (t,) in (
            await db.execute(
                select(Acknowledgement.target_id).where(
                    Acknowledgement.kind == "bulletin",
                    Acknowledgement.user_id == user["id"],
                    Acknowledgement.target_id.in_([p.id for p in posts]),
                )
            )
        ).all()
    }
    return [
        {"kind": "bulletin", "id": p.id, "title": p.title, "created_at": p.created_at.isoformat()}
        for p in posts
        if p.id not in done
    ]
