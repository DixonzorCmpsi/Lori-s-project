"""One call for the dashboard: what needs this member's attention right now."""

import datetime as dt
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import (
    Acknowledgement,
    Attendance,
    AttendanceNotice,
    BulletinPost,
    FormSignature,
    FormTemplate,
    RehearsalDate,
)
from app.routers.acknowledgements import ack_status
from app.routers.auth import get_current_user
from app.services.access import members_with_users, require_member, user_names
from app.services.callsheet import called_for_date, find_double_bookings

router = APIRouter(prefix="/productions/{production_id}", tags=["attention"])


def _date_json(rd: RehearsalDate) -> dict[str, Any]:
    return {
        "id": rd.id,
        "date": rd.rehearsal_date.isoformat(),
        "start_time": rd.start_time.strftime("%H:%M"),
        "end_time": rd.end_time.strftime("%H:%M"),
        "type": rd.type,
        "location": rd.location,
    }


@router.get("/attention")
async def attention(
    production_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    member = await require_member(production_id, user["id"], db)
    is_staff = member.role in ("director", "staff")
    today = dt.date.today()

    # Items waiting on me
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
    done = {
        row[0]
        for row in (
            await db.execute(
                select(Acknowledgement.target_id).where(
                    Acknowledgement.kind == "bulletin", Acknowledgement.user_id == user["id"]
                )
            )
        ).all()
    }
    pending_acks = [
        {"kind": "bulletin", "id": p.id, "title": p.title} for p in posts if p.id not in done
    ]

    forms = (
        (
            await db.execute(
                select(FormTemplate).where(
                    FormTemplate.production_id == production_id,
                    FormTemplate.is_active == True,  # noqa: E712
                )
            )
        )
        .scalars()
        .all()
    )
    signed = {
        row[0]
        for row in (
            await db.execute(
                select(FormSignature.form_id).where(FormSignature.user_id == user["id"])
            )
        ).all()
    }
    forms_to_sign = [
        {"id": f.id, "title": f.title}
        for f in forms
        if f.id not in signed and (f.audience == "all" or member.role == "cast")
    ]

    # My next call
    upcoming = (
        (
            await db.execute(
                select(RehearsalDate)
                .where(
                    RehearsalDate.production_id == production_id,
                    RehearsalDate.is_deleted == False,  # noqa: E712
                    RehearsalDate.is_cancelled == False,  # noqa: E712
                    RehearsalDate.type != "blocked",
                    RehearsalDate.rehearsal_date >= today,
                )
                .order_by(RehearsalDate.rehearsal_date, RehearsalDate.start_time)
                .limit(30)
            )
        )
        .scalars()
        .all()
    )
    next_call = None
    for rd in upcoming:
        called, _ = await called_for_date(production_id, rd.id, db)
        if member.role != "cast" or user["id"] in called:
            att = (
                await db.execute(
                    select(Attendance).where(
                        Attendance.rehearsal_date_id == rd.id, Attendance.user_id == user["id"]
                    )
                )
            ).scalar_one_or_none()
            notice = (
                await db.execute(
                    select(AttendanceNotice).where(
                        AttendanceNotice.rehearsal_date_id == rd.id,
                        AttendanceNotice.user_id == user["id"],
                    )
                )
            ).scalar_one_or_none()
            next_call = {
                **_date_json(rd),
                "is_today": rd.rehearsal_date == today,
                "my_status": att.status if att else None,
                "my_notice": {"kind": notice.kind, "minutes_late": notice.minutes_late}
                if notice
                else None,
            }
            break

    result: dict[str, Any] = {
        "pending_acks": pending_acks,
        "forms_to_sign": forms_to_sign,
        "next_call": next_call,
    }

    if is_staff:
        unconfirmed = []
        for p in [p for p in (await _all_ack_posts(production_id, db))]:
            status = await ack_status(production_id, "bulletin", p.id, p.author_id, db)
            if status["pending"]:
                unconfirmed.append(
                    {
                        "id": p.id,
                        "title": p.title,
                        "pending": len(status["pending"]),
                        "total": len(status["pending"]) + len(status["acknowledged"]),
                    }
                )
        incomplete_forms = []
        everyone = await members_with_users(production_id, db)
        for f in forms:
            required = [
                person.id for m, person in everyone if f.audience == "all" or m.role == "cast"
            ]
            have = {
                row[0]
                for row in (
                    await db.execute(
                        select(FormSignature.user_id).where(FormSignature.form_id == f.id)
                    )
                ).all()
            }
            missing = len([u for u in required if u not in have])
            if missing:
                incomplete_forms.append(
                    {"id": f.id, "title": f.title, "pending": missing, "total": len(required)}
                )

        notices = (
            (
                await db.execute(
                    select(AttendanceNotice)
                    .join(RehearsalDate, RehearsalDate.id == AttendanceNotice.rehearsal_date_id)
                    .where(
                        AttendanceNotice.production_id == production_id,
                        RehearsalDate.rehearsal_date >= today,
                    )
                    .order_by(RehearsalDate.rehearsal_date)
                )
            )
            .scalars()
            .all()
        )
        names = await user_names([n.user_id for n in notices], db)
        date_by_id = {
            d.id: d
            for d in (
                await db.execute(
                    select(RehearsalDate).where(
                        RehearsalDate.id.in_([n.rehearsal_date_id for n in notices] or ["none"])
                    )
                )
            )
            .scalars()
            .all()
        }
        result.update(
            {
                "unconfirmed_posts": unconfirmed,
                "incomplete_forms": incomplete_forms,
                "notices": [
                    {
                        "user_id": n.user_id,
                        "name": names[n.user_id].name if n.user_id in names else "Unknown",
                        "kind": n.kind,
                        "minutes_late": n.minutes_late,
                        "note": n.note,
                        "rehearsal_date_id": n.rehearsal_date_id,
                        "date": date_by_id[n.rehearsal_date_id].rehearsal_date.isoformat(),
                        "start_time": date_by_id[n.rehearsal_date_id].start_time.strftime("%H:%M"),
                    }
                    for n in notices
                    if n.rehearsal_date_id in date_by_id
                ],
                "double_booking_count": len(await find_double_bookings(production_id, db)),
            }
        )
    return result


async def _all_ack_posts(production_id: str, db: AsyncSession) -> list[BulletinPost]:
    return list(
        (
            await db.execute(
                select(BulletinPost)
                .where(
                    BulletinPost.production_id == production_id,
                    BulletinPost.requires_ack == True,  # noqa: E712
                )
                .order_by(BulletinPost.created_at.desc())
                .limit(20)
            )
        )
        .scalars()
        .all()
    )
