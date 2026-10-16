"""Attendance, call sheets and late/absent notices.

Cast check in to a call, tell the stage manager when they will be late or absent, and
staff see a call sheet (who is called, who is here) plus a per-person attendance report.
"""

import datetime as dt
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import (
    Attendance,
    AttendanceNotice,
    CastConflict,
    ProductionMember,
    RehearsalDate,
    User,
)
from app.routers.auth import get_current_user
from app.services.access import (
    invalid,
    not_found,
    require_member,
    require_staff,
    require_writable,
    user_names,
)
from app.services.callsheet import (
    called_for_date,
    cast_ids,
    explicit_assignments,
    find_double_bookings,
)
from app.services.email import send_absence_notice_email

router = APIRouter(prefix="/productions/{production_id}/attendance", tags=["attendance"])
callsheet_router = APIRouter(prefix="/productions/{production_id}/call-sheet", tags=["call-sheet"])

STATUSES = ("present", "late", "absent", "excused")


class CheckInRequest(BaseModel):
    rehearsal_date_id: str


class NoticeRequest(BaseModel):
    rehearsal_date_id: str
    kind: str  # late | absent
    minutes_late: int | None = None
    note: str | None = None


async def _get_date(production_id: str, rehearsal_date_id: str, db: AsyncSession) -> RehearsalDate:
    rd = (
        await db.execute(
            select(RehearsalDate).where(
                RehearsalDate.id == rehearsal_date_id,
                RehearsalDate.production_id == production_id,
                RehearsalDate.is_deleted == False,  # noqa: E712
            )
        )
    ).scalar_one_or_none()
    if not rd:
        raise not_found("Rehearsal date not found")
    return rd


def _date_json(rd: RehearsalDate) -> dict[str, Any]:
    return {
        "id": rd.id,
        "date": rd.rehearsal_date.isoformat(),
        "start_time": rd.start_time.strftime("%H:%M"),
        "end_time": rd.end_time.strftime("%H:%M"),
        "type": rd.type,
        "location": rd.location,
        "note": rd.note,
        "is_cancelled": rd.is_cancelled,
    }


def _notice_json(n: AttendanceNotice | None) -> dict[str, Any] | None:
    if not n:
        return None
    return {
        "kind": n.kind,
        "minutes_late": n.minutes_late,
        "note": n.note,
        "created_at": n.created_at.isoformat(),
    }


# ---------------------------------------------------------------------------
# Check-in
# ---------------------------------------------------------------------------


@router.post("/check-in", status_code=201)
async def check_in(
    production_id: str,
    body: CheckInRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """A member checks in for a rehearsal date."""
    await require_member(production_id, user["id"], db)
    await require_writable(production_id, db)

    rd = await _get_date(production_id, body.rehearsal_date_id, db)
    if rd.is_cancelled:
        raise not_found("Rehearsal date not found or cancelled")

    existing = (
        await db.execute(
            select(Attendance).where(
                Attendance.rehearsal_date_id == body.rehearsal_date_id,
                Attendance.user_id == user["id"],
            )
        )
    ).scalar_one_or_none()
    if existing:
        return {
            "id": existing.id,
            "status": existing.status,
            "checked_in_at": existing.checked_in_at.isoformat(),
            "already_checked_in": True,
        }

    record = Attendance(
        production_id=production_id,
        rehearsal_date_id=body.rehearsal_date_id,
        user_id=user["id"],
        status="present",
    )
    db.add(record)
    await db.flush()
    return {
        "id": record.id,
        "status": record.status,
        "checked_in_at": record.checked_in_at.isoformat(),
        "already_checked_in": False,
    }


# ---------------------------------------------------------------------------
# Late / absent notices (cast tell staff ahead of time)
# ---------------------------------------------------------------------------


@router.post("/notice", status_code=201)
async def send_notice(
    production_id: str,
    body: NoticeRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Tell the stage manager you will be late or absent. Replaces any earlier notice."""
    await require_member(production_id, user["id"], db)
    production = await require_writable(production_id, db)

    if body.kind not in ("late", "absent"):
        raise invalid("Kind must be late or absent")
    minutes = body.minutes_late
    if body.kind == "late":
        if minutes is None or not 1 <= minutes <= 240:
            raise invalid("Say how many minutes late (1 to 240)")
    else:
        minutes = None
    note = (body.note or "").strip() or None
    if note and len(note) > 500:
        raise invalid("Note must be 500 characters or fewer")

    rd = await _get_date(production_id, body.rehearsal_date_id, db)
    if rd.is_cancelled:
        raise invalid("That rehearsal is cancelled")
    if rd.rehearsal_date < dt.date.today() - dt.timedelta(days=1):
        raise invalid("That rehearsal has already happened")

    notice = (
        await db.execute(
            select(AttendanceNotice).where(
                AttendanceNotice.rehearsal_date_id == rd.id,
                AttendanceNotice.user_id == user["id"],
            )
        )
    ).scalar_one_or_none()
    if notice:
        notice.kind, notice.minutes_late, notice.note = body.kind, minutes, note
    else:
        notice = AttendanceNotice(
            production_id=production_id,
            rehearsal_date_id=rd.id,
            user_id=user["id"],
            kind=body.kind,
            minutes_late=minutes,
            note=note,
        )
        db.add(notice)
    await db.flush()

    # Tell staff and directors who have email turned on
    when = f"{rd.rehearsal_date.strftime('%a %b %d')} at {rd.start_time.strftime('%H:%M')}"
    detail = f"{minutes} minutes late" if body.kind == "late" else "absent"
    if note:
        detail += f" — {note}"
    staff = (
        await db.execute(
            select(User)
            .join(ProductionMember, ProductionMember.user_id == User.id)
            .where(
                ProductionMember.production_id == production_id,
                ProductionMember.role.in_(("director", "staff")),
                User.email_notifications == True,  # noqa: E712
            )
        )
    ).scalars()
    for person in staff:
        send_absence_notice_email(
            person.email,
            production.name,
            production_id,
            user.get("name") or "A cast member",
            "late" if body.kind == "late" else "absent",
            when,
            detail,
        )
    return {"rehearsal_date_id": rd.id, **(_notice_json(notice) or {})}


@router.delete("/notice/{rehearsal_date_id}", status_code=204)
async def withdraw_notice(
    production_id: str,
    rehearsal_date_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_member(production_id, user["id"], db)
    notice = (
        await db.execute(
            select(AttendanceNotice).where(
                AttendanceNotice.rehearsal_date_id == rehearsal_date_id,
                AttendanceNotice.user_id == user["id"],
                AttendanceNotice.production_id == production_id,
            )
        )
    ).scalar_one_or_none()
    if not notice:
        raise not_found("No notice to withdraw")
    await db.delete(notice)


# ---------------------------------------------------------------------------
# Reports (declared before the /{rehearsal_date_id} routes so they are not shadowed)
# ---------------------------------------------------------------------------


@router.get("/by-member")
async def attendance_by_member(
    production_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """Staff: attendance totals per cast member across all past calls."""
    await require_staff(production_id, user["id"], db)

    today = dt.date.today()
    dates = (
        (
            await db.execute(
                select(RehearsalDate).where(
                    RehearsalDate.production_id == production_id,
                    RehearsalDate.is_deleted == False,  # noqa: E712
                    RehearsalDate.is_cancelled == False,  # noqa: E712
                    RehearsalDate.type != "blocked",
                    RehearsalDate.rehearsal_date <= today,
                )
            )
        )
        .scalars()
        .all()
    )
    everyone = await cast_ids(production_id, db)
    explicit = await explicit_assignments(production_id, db)
    records = (
        (await db.execute(select(Attendance).where(Attendance.production_id == production_id)))
        .scalars()
        .all()
    )
    status_of = {(r.rehearsal_date_id, r.user_id): r.status for r in records}
    names = await user_names(everyone, db)

    rows = []
    for uid in everyone:
        counts = {"present": 0, "late": 0, "absent": 0, "excused": 0, "unmarked": 0}
        called = 0
        for rd in dates:
            assigned = explicit.get(rd.id)
            if assigned is not None and uid not in assigned:
                continue
            called += 1
            counts[status_of.get((rd.id, uid), "unmarked")] += 1
        denominator = called - counts["excused"]
        rate = (
            round((counts["present"] + counts["late"]) / denominator * 100) if denominator else None
        )
        rows.append(
            {
                "user_id": uid,
                "name": names[uid].name if uid in names else "Unknown",
                "called": called,
                **counts,
                "rate": rate,
            }
        )
    rows.sort(
        key=lambda r: (r["rate"] is None, r["rate"] if r["rate"] is not None else 0, r["name"])
    )
    return rows


@router.get("")
async def get_attendance_summary(
    production_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """Staff: one row per rehearsal date with how many people have checked in."""
    await require_staff(production_id, user["id"], db)

    dates = (
        (
            await db.execute(
                select(RehearsalDate)
                .where(
                    RehearsalDate.production_id == production_id,
                    RehearsalDate.is_deleted == False,  # noqa: E712
                )
                .order_by(RehearsalDate.rehearsal_date.desc())
            )
        )
        .scalars()
        .all()
    )
    records = (
        (await db.execute(select(Attendance).where(Attendance.production_id == production_id)))
        .scalars()
        .all()
    )
    checked: dict[str, int] = {}
    for r in records:
        checked[r.rehearsal_date_id] = checked.get(r.rehearsal_date_id, 0) + 1
    everyone = await cast_ids(production_id, db)
    explicit = await explicit_assignments(production_id, db)

    return [
        {
            "rehearsal_date_id": d.id,
            "date": d.rehearsal_date.isoformat(),
            "type": d.type,
            "checked_in": checked.get(d.id, 0),
            "total": len(explicit.get(d.id) or everyone),
            "is_cancelled": d.is_cancelled,
        }
        for d in dates
    ]


@router.get("/{rehearsal_date_id}")
async def get_attendance(
    production_id: str,
    rehearsal_date_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Attendance for one date. Staff see everyone called; cast see only their own."""
    member = await require_member(production_id, user["id"], db)
    await _get_date(production_id, rehearsal_date_id, db)

    if member.role in ("director", "staff"):
        called, _ = await called_for_date(production_id, rehearsal_date_id, db)
        records = (
            (
                await db.execute(
                    select(Attendance).where(Attendance.rehearsal_date_id == rehearsal_date_id)
                )
            )
            .scalars()
            .all()
        )
        by_user = {r.user_id: r for r in records}
        names = await user_names(called, db)
        return {
            "rehearsal_date_id": rehearsal_date_id,
            "checked_in": [
                {
                    "user_id": r.user_id,
                    "name": names[r.user_id].name if r.user_id in names else None,
                    "status": r.status,
                    "checked_in_at": r.checked_in_at.isoformat(),
                }
                for r in records
            ],
            "not_checked_in": [
                {"user_id": uid, "name": names[uid].name if uid in names else None}
                for uid in called
                if uid not in by_user
            ],
            "total_members": len(called),
            "total_checked_in": len([uid for uid in called if uid in by_user]),
        }

    record = (
        await db.execute(
            select(Attendance).where(
                Attendance.rehearsal_date_id == rehearsal_date_id,
                Attendance.user_id == user["id"],
            )
        )
    ).scalar_one_or_none()
    return {
        "rehearsal_date_id": rehearsal_date_id,
        "checked_in": record is not None,
        "status": record.status if record else None,
        "checked_in_at": record.checked_in_at.isoformat() if record else None,
    }


@router.put("/{rehearsal_date_id}/status/{user_id}")
async def update_attendance_status(
    production_id: str,
    rehearsal_date_id: str,
    user_id: str,
    status: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Staff mark a member present, late, absent or excused (works before they check in)."""
    await require_staff(production_id, user["id"], db)
    await require_writable(production_id, db)
    if status not in STATUSES:
        raise invalid("Status must be present, late, absent, or excused", code="INVALID")
    await _get_date(production_id, rehearsal_date_id, db)
    await require_member(production_id, user_id, db)

    record = (
        await db.execute(
            select(Attendance).where(
                Attendance.rehearsal_date_id == rehearsal_date_id, Attendance.user_id == user_id
            )
        )
    ).scalar_one_or_none()
    if record:
        record.status = status
    else:
        db.add(
            Attendance(
                production_id=production_id,
                rehearsal_date_id=rehearsal_date_id,
                user_id=user_id,
                status=status,
            )
        )
    await db.flush()
    return {"user_id": user_id, "status": status}


@router.delete("/{rehearsal_date_id}/status/{user_id}", status_code=204)
async def clear_attendance_status(
    production_id: str,
    rehearsal_date_id: str,
    user_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Staff: clear a mark so the person shows as not yet marked."""
    await require_staff(production_id, user["id"], db)
    await require_writable(production_id, db)
    record = (
        await db.execute(
            select(Attendance).where(
                Attendance.rehearsal_date_id == rehearsal_date_id,
                Attendance.user_id == user_id,
                Attendance.production_id == production_id,
            )
        )
    ).scalar_one_or_none()
    if record:
        await db.delete(record)


# ---------------------------------------------------------------------------
# Call sheet
# ---------------------------------------------------------------------------


@callsheet_router.get("/{rehearsal_date_id}")
async def get_call_sheet(
    production_id: str,
    rehearsal_date_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Everything about one call: details, who is called, who is here, late/absent notices."""
    member = await require_member(production_id, user["id"], db)
    rd = await _get_date(production_id, rehearsal_date_id, db)
    is_staff = member.role in ("director", "staff")

    called_ids, full_company = await called_for_date(production_id, rehearsal_date_id, db)
    names = await user_names(called_ids, db)

    attendance = {
        a.user_id: a
        for a in (
            await db.execute(
                select(Attendance).where(Attendance.rehearsal_date_id == rehearsal_date_id)
            )
        )
        .scalars()
        .all()
    }
    notices = {
        n.user_id: n
        for n in (
            await db.execute(
                select(AttendanceNotice).where(
                    AttendanceNotice.rehearsal_date_id == rehearsal_date_id
                )
            )
        )
        .scalars()
        .all()
    }
    conflicts = {
        c[0]
        for c in (
            await db.execute(
                select(CastConflict.user_id).where(
                    CastConflict.rehearsal_date_id == rehearsal_date_id
                )
            )
        ).all()
    }

    called = []
    for uid in sorted(called_ids, key=lambda u: names[u].name.lower() if u in names else ""):
        row: dict[str, Any] = {
            "user_id": uid,
            "name": names[uid].name if uid in names else "Unknown",
        }
        if is_staff:
            att = attendance.get(uid)
            row.update(
                {
                    "status": att.status if att else None,
                    "checked_in_at": att.checked_in_at.isoformat() if att else None,
                    "notice": _notice_json(notices.get(uid)),
                    "has_conflict": uid in conflicts,
                }
            )
        called.append(row)

    mine_att = attendance.get(user["id"])
    result: dict[str, Any] = {
        "date": _date_json(rd),
        "full_company": full_company,
        "called": called,
        "my": {
            "called": user["id"] in called_ids or member.role in ("director", "staff"),
            "status": mine_att.status if mine_att else None,
            "checked_in_at": mine_att.checked_in_at.isoformat() if mine_att else None,
            "notice": _notice_json(notices.get(user["id"])),
        },
    }
    if is_staff:
        statuses = [attendance[u].status if u in attendance else None for u in called_ids]
        result["summary"] = {
            "called": len(called_ids),
            "present": statuses.count("present"),
            "late": statuses.count("late"),
            "absent": statuses.count("absent"),
            "excused": statuses.count("excused"),
            "unmarked": statuses.count(None),
            "notices": len([u for u in called_ids if u in notices]),
        }
        result["warnings"] = [
            w
            for w in await find_double_bookings(production_id, db)
            if any(i["id"] == rehearsal_date_id for i in w["items"])
        ]
    return result
