"""Who is called when, plus double-booking detection.

A rehearsal date with explicit cast assignments calls only those people. A date with no
assignments calls the full cast ("full company"). Staff and directors are always available
to every call and are not listed as "called".
"""

import datetime as dt
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    CastAssignment,
    ProductionMember,
    RehearsalDate,
    SignupEntry,
    SignupSlot,
    User,
)


async def cast_ids(production_id: str, db: AsyncSession) -> list[str]:
    rows = await db.execute(
        select(ProductionMember.user_id).where(
            ProductionMember.production_id == production_id, ProductionMember.role == "cast"
        )
    )
    return [r[0] for r in rows.all()]


async def explicit_assignments(production_id: str, db: AsyncSession) -> dict[str, set[str]]:
    """rehearsal_date_id -> user ids explicitly assigned."""
    rows = await db.execute(
        select(CastAssignment.rehearsal_date_id, CastAssignment.user_id).where(
            CastAssignment.production_id == production_id
        )
    )
    out: dict[str, set[str]] = {}
    for date_id, user_id in rows.all():
        out.setdefault(date_id, set()).add(user_id)
    return out


async def called_for_date(
    production_id: str, rehearsal_date_id: str, db: AsyncSession
) -> tuple[list[str], bool]:
    """Return (called cast user ids, is_full_company) for one rehearsal date."""
    rows = await db.execute(
        select(CastAssignment.user_id).where(
            CastAssignment.production_id == production_id,
            CastAssignment.rehearsal_date_id == rehearsal_date_id,
        )
    )
    assigned = [r[0] for r in rows.all()]
    if assigned:
        return assigned, False
    return await cast_ids(production_id, db), True


def times_overlap(a_start: dt.time, a_end: dt.time, b_start: dt.time, b_end: dt.time) -> bool:
    return a_start < b_end and b_start < a_end


def _item(rd: RehearsalDate) -> dict[str, Any]:
    return {
        "id": rd.id,
        "type": rd.type,
        "start_time": rd.start_time.strftime("%H:%M"),
        "end_time": rd.end_time.strftime("%H:%M"),
        "location": rd.location,
    }


async def find_double_bookings(production_id: str, db: AsyncSession) -> list[dict[str, Any]]:
    """Find rooms used twice, people called twice, and sign-ups that clash with a call."""
    dates = (
        (
            await db.execute(
                select(RehearsalDate).where(
                    RehearsalDate.production_id == production_id,
                    RehearsalDate.is_deleted == False,  # noqa: E712
                    RehearsalDate.is_cancelled == False,  # noqa: E712
                    RehearsalDate.type != "blocked",
                )
            )
        )
        .scalars()
        .all()
    )
    explicit = await explicit_assignments(production_id, db)
    all_cast = set(await cast_ids(production_id, db))

    def called(rd: RehearsalDate) -> set[str]:
        return explicit.get(rd.id) or all_cast

    names: dict[str, str] = {}

    async def name_of(user_id: str) -> str:
        if user_id not in names:
            user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
            names[user_id] = user.name if user else "Unknown"
        return names[user_id]

    found: list[dict[str, Any]] = []
    by_day: dict[dt.date, list[RehearsalDate]] = {}
    for rd in dates:
        by_day.setdefault(rd.rehearsal_date, []).append(rd)

    for day, group in sorted(by_day.items()):
        for i, a in enumerate(group):
            for b in group[i + 1 :]:
                if not times_overlap(a.start_time, a.end_time, b.start_time, b.end_time):
                    continue
                if (
                    a.location
                    and b.location
                    and a.location.strip().lower() == b.location.strip().lower()
                ):
                    found.append(
                        {
                            "kind": "room",
                            "date": day.isoformat(),
                            "location": a.location,
                            "items": [_item(a), _item(b)],
                            "people": [],
                        }
                    )
                shared = called(a) & called(b)
                if shared and explicit.get(a.id) is None and explicit.get(b.id) is None:
                    found.append(
                        {
                            "kind": "overlap",
                            "date": day.isoformat(),
                            "location": None,
                            "items": [_item(a), _item(b)],
                            "people": [],
                        }
                    )
                elif shared:
                    found.append(
                        {
                            "kind": "person",
                            "date": day.isoformat(),
                            "location": None,
                            "items": [_item(a), _item(b)],
                            "people": [
                                {"user_id": u, "name": await name_of(u)} for u in sorted(shared)
                            ],
                        }
                    )

    # Sign-ups that clash with a call the person is in
    slots = (
        (await db.execute(select(SignupSlot).where(SignupSlot.production_id == production_id)))
        .scalars()
        .all()
    )
    for slot in slots:
        entries = (
            (await db.execute(select(SignupEntry).where(SignupEntry.slot_id == slot.id)))
            .scalars()
            .all()
        )
        for entry in entries:
            for rd in by_day.get(slot.slot_date, []):
                if entry.user_id in called(rd) and times_overlap(
                    slot.start_time, slot.end_time, rd.start_time, rd.end_time
                ):
                    found.append(
                        {
                            "kind": "signup",
                            "date": slot.slot_date.isoformat(),
                            "location": slot.location,
                            "items": [_item(rd)],
                            "slot": {
                                "id": slot.id,
                                "title": slot.title,
                                "start_time": slot.start_time.strftime("%H:%M"),
                                "end_time": slot.end_time.strftime("%H:%M"),
                            },
                            "people": [
                                {"user_id": entry.user_id, "name": await name_of(entry.user_id)}
                            ],
                        }
                    )
    found.sort(key=lambda f: (f["date"], f["kind"]))
    return found
