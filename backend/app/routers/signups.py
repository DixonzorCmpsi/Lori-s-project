"""Open calls — crew shifts and tasks that members sign up for — and double-booking checks."""

import datetime as dt
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import RehearsalDate, SignupEntry, SignupSlot
from app.routers.auth import get_current_user
from app.services.access import (
    get_production,
    invalid,
    not_found,
    require_member,
    require_staff,
    require_writable,
    user_names,
)
from app.services.callsheet import called_for_date, find_double_bookings, times_overlap
from app.services.email import send_signup_notice_email

router = APIRouter(prefix="/productions/{production_id}/signups", tags=["signups"])
checks_router = APIRouter(prefix="/productions/{production_id}", tags=["schedule-checks"])


class SlotBody(BaseModel):
    title: str
    description: str | None = None
    date: str
    start_time: str
    end_time: str
    location: str | None = None
    capacity: int = 1


class SlotUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    date: str | None = None
    start_time: str | None = None
    end_time: str | None = None
    location: str | None = None
    capacity: int | None = None


def _parse(body_date: str, start: str, end: str) -> tuple[dt.date, dt.time, dt.time]:
    try:
        day = dt.date.fromisoformat(body_date)
        s, e = dt.time.fromisoformat(start), dt.time.fromisoformat(end)
    except ValueError:
        raise invalid("Use YYYY-MM-DD for the date and HH:MM for times")
    if s >= e:
        raise invalid("Start time must be before end time")
    return day, s, e


def _check_text(title: str, description: str | None, location: str | None, capacity: int) -> None:
    if not title.strip() or len(title) > 200:
        raise invalid("Title is required (200 characters or fewer)")
    if description and len(description) > 1000:
        raise invalid("Description must be 1000 characters or fewer")
    if location and len(location) > 200:
        raise invalid("Location must be 200 characters or fewer")
    if not 1 <= capacity <= 200:
        raise invalid("Spots must be between 1 and 200")


async def _slot_json(slot: SignupSlot, user_id: str, db: AsyncSession) -> dict[str, Any]:
    entries = (
        (await db.execute(select(SignupEntry).where(SignupEntry.slot_id == slot.id)))
        .scalars()
        .all()
    )
    names = await user_names([e.user_id for e in entries], db)
    people = [
        {"user_id": e.user_id, "name": names[e.user_id].name if e.user_id in names else "Unknown"}
        for e in entries
    ]
    people.sort(key=lambda p: p["name"].lower())
    return {
        "id": slot.id,
        "title": slot.title,
        "description": slot.description,
        "date": slot.slot_date.isoformat(),
        "start_time": slot.start_time.strftime("%H:%M"),
        "end_time": slot.end_time.strftime("%H:%M"),
        "location": slot.location,
        "capacity": slot.capacity,
        "filled": len(entries),
        "full": len(entries) >= slot.capacity,
        "people": people,
        "mine": any(e.user_id == user_id for e in entries),
    }


async def _get_slot(production_id: str, slot_id: str, db: AsyncSession) -> SignupSlot:
    slot = (
        await db.execute(
            select(SignupSlot).where(
                SignupSlot.id == slot_id, SignupSlot.production_id == production_id
            )
        )
    ).scalar_one_or_none()
    if not slot:
        raise not_found("Sign-up slot not found")
    return slot


@router.get("")
async def list_slots(
    production_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    await require_member(production_id, user["id"], db)
    slots = (
        (
            await db.execute(
                select(SignupSlot)
                .where(SignupSlot.production_id == production_id)
                .order_by(SignupSlot.slot_date, SignupSlot.start_time)
            )
        )
        .scalars()
        .all()
    )
    return [await _slot_json(s, user["id"], db) for s in slots]


@router.post("", status_code=201)
async def create_slot(
    production_id: str,
    body: SlotBody,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await require_staff(production_id, user["id"], db)
    await require_writable(production_id, db)
    _check_text(body.title, body.description, body.location, body.capacity)
    day, start, end = _parse(body.date, body.start_time, body.end_time)
    slot = SignupSlot(
        production_id=production_id,
        title=body.title.strip(),
        description=(body.description or "").strip() or None,
        slot_date=day,
        start_time=start,
        end_time=end,
        location=(body.location or "").strip() or None,
        capacity=body.capacity,
        created_by=user["id"],
    )
    db.add(slot)
    await db.flush()
    return await _slot_json(slot, user["id"], db)


@router.patch("/{slot_id}")
async def update_slot(
    production_id: str,
    slot_id: str,
    body: SlotUpdate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await require_staff(production_id, user["id"], db)
    await require_writable(production_id, db)
    slot = await _get_slot(production_id, slot_id, db)
    title = body.title if body.title is not None else slot.title
    description = body.description if body.description is not None else slot.description
    location = body.location if body.location is not None else slot.location
    capacity = body.capacity if body.capacity is not None else slot.capacity
    _check_text(title, description, location, capacity)
    filled = len(
        (await db.execute(select(SignupEntry).where(SignupEntry.slot_id == slot.id)))
        .scalars()
        .all()
    )
    if capacity < filled:
        raise invalid(f"{filled} people are already signed up; remove some before lowering spots")
    day, start, end = _parse(
        body.date or slot.slot_date.isoformat(),
        body.start_time or slot.start_time.strftime("%H:%M"),
        body.end_time or slot.end_time.strftime("%H:%M"),
    )
    slot.title, slot.description = title.strip(), (description or "").strip() or None
    slot.location, slot.capacity = (location or "").strip() or None, capacity
    slot.slot_date, slot.start_time, slot.end_time = day, start, end
    await db.flush()
    return await _slot_json(slot, user["id"], db)


@router.delete("/{slot_id}", status_code=204)
async def delete_slot(
    production_id: str,
    slot_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_staff(production_id, user["id"], db)
    await require_writable(production_id, db)
    await db.delete(await _get_slot(production_id, slot_id, db))


@router.post("/{slot_id}/join")
async def join_slot(
    production_id: str,
    slot_id: str,
    force: bool = False,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Sign up for a slot. Warns (409 DOUBLE_BOOKED) if it clashes with a call or another
    sign-up; send force=true to sign up anyway."""
    member = await require_member(production_id, user["id"], db)
    production = await require_writable(production_id, db)
    slot = await _get_slot(production_id, slot_id, db)

    mine = (
        await db.execute(
            select(SignupEntry).where(
                SignupEntry.slot_id == slot.id, SignupEntry.user_id == user["id"]
            )
        )
    ).scalar_one_or_none()
    if mine:
        return await _slot_json(slot, user["id"], db)

    if slot.slot_date < dt.date.today():
        raise invalid("That slot is in the past")
    filled = len(
        (await db.execute(select(SignupEntry).where(SignupEntry.slot_id == slot.id)))
        .scalars()
        .all()
    )
    if filled >= slot.capacity:
        raise invalid("That slot is full", code="FULL", status_code=409)

    if not force:
        clashes: list[str] = []
        others = (
            (
                await db.execute(
                    select(SignupSlot)
                    .join(SignupEntry, SignupEntry.slot_id == SignupSlot.id)
                    .where(
                        SignupSlot.production_id == production_id,
                        SignupSlot.slot_date == slot.slot_date,
                        SignupSlot.id != slot.id,
                        SignupEntry.user_id == user["id"],
                    )
                )
            )
            .scalars()
            .all()
        )
        for other in others:
            if times_overlap(slot.start_time, slot.end_time, other.start_time, other.end_time):
                clashes.append(f"your sign-up for {other.title}")
        if member.role == "cast":
            dates = (
                (
                    await db.execute(
                        select(RehearsalDate).where(
                            RehearsalDate.production_id == production_id,
                            RehearsalDate.rehearsal_date == slot.slot_date,
                            RehearsalDate.is_deleted == False,  # noqa: E712
                            RehearsalDate.is_cancelled == False,  # noqa: E712
                            RehearsalDate.type != "blocked",
                        )
                    )
                )
                .scalars()
                .all()
            )
            for rd in dates:
                called, _ = await called_for_date(production_id, rd.id, db)
                if user["id"] in called and times_overlap(
                    slot.start_time, slot.end_time, rd.start_time, rd.end_time
                ):
                    clashes.append(
                        f"your {rd.type} call {rd.start_time.strftime('%H:%M')}-{rd.end_time.strftime('%H:%M')}"
                    )
        if clashes:
            raise invalid(
                "This overlaps " + " and ".join(clashes) + ".",
                code="DOUBLE_BOOKED",
                status_code=409,
            )

    db.add(SignupEntry(slot_id=slot.id, user_id=user["id"]))
    await db.flush()

    from app.models import User

    me = (await db.execute(select(User).where(User.id == user["id"]))).scalar_one_or_none()
    if me and me.email_notifications:
        send_signup_notice_email(
            me.email,
            production.name,
            production_id,
            slot.title,
            f"{slot.slot_date.strftime('%a %b %d')} {slot.start_time.strftime('%H:%M')}-"
            f"{slot.end_time.strftime('%H:%M')}",
        )
    return await _slot_json(slot, user["id"], db)


@router.delete("/{slot_id}/join", status_code=204)
async def leave_slot(
    production_id: str,
    slot_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_member(production_id, user["id"], db)
    await require_writable(production_id, db)
    await _get_slot(production_id, slot_id, db)
    entry = (
        await db.execute(
            select(SignupEntry).where(
                SignupEntry.slot_id == slot_id, SignupEntry.user_id == user["id"]
            )
        )
    ).scalar_one_or_none()
    if not entry:
        raise not_found("You are not signed up for this slot")
    await db.delete(entry)


@router.delete("/{slot_id}/entries/{user_id}", status_code=204)
async def remove_entry(
    production_id: str,
    slot_id: str,
    user_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_staff(production_id, user["id"], db)
    await require_writable(production_id, db)
    await _get_slot(production_id, slot_id, db)
    entry = (
        await db.execute(
            select(SignupEntry).where(
                SignupEntry.slot_id == slot_id, SignupEntry.user_id == user_id
            )
        )
    ).scalar_one_or_none()
    if not entry:
        raise not_found("That person is not signed up")
    await db.delete(entry)


@checks_router.get("/double-bookings")
async def double_bookings(
    production_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """Staff: rooms used twice, people called to overlapping calls, and sign-ups that clash."""
    await require_staff(production_id, user["id"], db)
    await get_production(production_id, db)
    return await find_double_bookings(production_id, db)
