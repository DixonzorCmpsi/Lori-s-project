"""Personal calendar feed — each member gets a secret .ics link to subscribe to in
Google Calendar, Apple Calendar or Outlook. The feed lists only the calls that member is in."""

import datetime as dt
import secrets
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Production, ProductionMember, RehearsalDate, SignupEntry, SignupSlot
from app.routers.auth import get_current_user
from app.services.access import require_member
from app.services.callsheet import cast_ids, explicit_assignments

router = APIRouter(tags=["calendar"])

TYPE_LABELS = {
    "regular": "Rehearsal",
    "tech": "Tech rehearsal",
    "dress": "Dress rehearsal",
    "performance": "Performance",
}


def _escape(text: str) -> str:
    return (
        text.replace("\\", "\\\\")
        .replace(";", "\\;")
        .replace(",", "\\,")
        .replace("\r\n", "\\n")
        .replace("\n", "\\n")
    )


def _fold(line: str) -> str:
    """Fold a content line to 75 octets as required by RFC 5545."""
    raw = line.encode("utf-8")
    if len(raw) <= 75:
        return line
    parts, current = [], b""
    for ch in line:
        encoded = ch.encode("utf-8")
        limit = 75 if not parts else 74
        if len(current) + len(encoded) > limit:
            parts.append(current)
            current = b""
        current += encoded
    parts.append(current)
    return "\r\n ".join(p.decode("utf-8") for p in parts)


def _stamp(day: dt.date, at: dt.time) -> str:
    return dt.datetime.combine(day, at).strftime("%Y%m%dT%H%M%S")


def build_calendar(
    production_name: str,
    rehearsals: list[RehearsalDate],
    signups: list[SignupSlot],
) -> str:
    now = dt.datetime.now(dt.UTC).strftime("%Y%m%dT%H%M%SZ")
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Digital Call Board//Calls//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{_escape(production_name)}",
        "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
        "X-PUBLISHED-TTL:PT1H",
    ]
    for rd in rehearsals:
        label = TYPE_LABELS.get(rd.type, "Rehearsal")
        lines += [
            "BEGIN:VEVENT",
            f"UID:{rd.id}@callboard",
            f"DTSTAMP:{now}",
            f"DTSTART:{_stamp(rd.rehearsal_date, rd.start_time)}",
            f"DTEND:{_stamp(rd.rehearsal_date, rd.end_time)}",
            f"SUMMARY:{_escape(f'{production_name}: {label}')}",
        ]
        if rd.location:
            lines.append(f"LOCATION:{_escape(rd.location)}")
        if rd.note:
            lines.append(f"DESCRIPTION:{_escape(rd.note)}")
        lines.append("STATUS:CANCELLED" if rd.is_cancelled else "STATUS:CONFIRMED")
        lines.append("END:VEVENT")
    for slot in signups:
        lines += [
            "BEGIN:VEVENT",
            f"UID:signup-{slot.id}@callboard",
            f"DTSTAMP:{now}",
            f"DTSTART:{_stamp(slot.slot_date, slot.start_time)}",
            f"DTEND:{_stamp(slot.slot_date, slot.end_time)}",
            f"SUMMARY:{_escape(f'{production_name}: {slot.title}')}",
        ]
        if slot.location:
            lines.append(f"LOCATION:{_escape(slot.location)}")
        if slot.description:
            lines.append(f"DESCRIPTION:{_escape(slot.description)}")
        lines += ["STATUS:CONFIRMED", "END:VEVENT"]
    lines.append("END:VCALENDAR")
    return "\r\n".join(_fold(line) for line in lines) + "\r\n"


async def _ensure_token(member: ProductionMember, db: AsyncSession) -> str:
    if not member.calendar_token:
        member.calendar_token = secrets.token_urlsafe(32)
        await db.flush()
    return member.calendar_token


@router.get("/productions/{production_id}/calendar-link")
async def get_calendar_link(
    production_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Your private subscription link. Anyone with the link can read your calls, so keep it secret."""
    member = await require_member(production_id, user["id"], db)
    token = await _ensure_token(member, db)
    return {"token": token, "path": f"/api/calendar/{token}.ics"}


@router.post("/productions/{production_id}/calendar-link/reset")
async def reset_calendar_link(
    production_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Make a new link and stop the old one working (use this if the link leaks)."""
    member = await require_member(production_id, user["id"], db)
    member.calendar_token = secrets.token_urlsafe(32)
    await db.flush()
    return {"token": member.calendar_token, "path": f"/api/calendar/{member.calendar_token}.ics"}


@router.get("/calendar/{token}.ics")
async def calendar_feed(token: str, db: AsyncSession = Depends(get_db)) -> Response:
    """Public feed, secured by the secret token in the URL (calendar apps cannot send headers)."""
    member = (
        await db.execute(select(ProductionMember).where(ProductionMember.calendar_token == token))
    ).scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail={"error": "NOT_FOUND", "message": "Not found"})
    production = (
        await db.execute(select(Production).where(Production.id == member.production_id))
    ).scalar_one()

    dates = (
        (
            await db.execute(
                select(RehearsalDate)
                .where(
                    RehearsalDate.production_id == member.production_id,
                    RehearsalDate.is_deleted == False,  # noqa: E712
                    RehearsalDate.type != "blocked",
                )
                .order_by(RehearsalDate.rehearsal_date, RehearsalDate.start_time)
            )
        )
        .scalars()
        .all()
    )
    if member.role == "cast":
        explicit = await explicit_assignments(member.production_id, db)
        everyone = set(await cast_ids(member.production_id, db))
        dates = [d for d in dates if member.user_id in (explicit.get(d.id) or everyone)]

    slots = (
        (
            await db.execute(
                select(SignupSlot)
                .join(SignupEntry, SignupEntry.slot_id == SignupSlot.id)
                .where(
                    SignupSlot.production_id == member.production_id,
                    SignupEntry.user_id == member.user_id,
                )
            )
        )
        .scalars()
        .all()
    )
    body = build_calendar(production.name, dates, slots)
    return Response(
        content=body,
        media_type="text/calendar; charset=utf-8",
        headers={
            "Cache-Control": "no-cache",
            "Content-Disposition": 'inline; filename="calls.ics"',
        },
    )
