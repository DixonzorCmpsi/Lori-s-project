"""Rehearsal reports — the stage manager's end-of-day notes, split by department and sent to a
distribution list. Recipients can confirm they have read it."""

import datetime as dt
import html
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import (
    Acknowledgement,
    Attendance,
    AttendanceNotice,
    ProductionMember,
    RehearsalDate,
    RehearsalReport,
    User,
)
from app.routers.auth import get_current_user
from app.services.access import (
    forbidden,
    get_production,
    invalid,
    not_found,
    require_member,
    require_staff,
    require_writable,
    user_names,
)
from app.services.callsheet import called_for_date
from app.services.email import send_report_email

router = APIRouter(prefix="/productions/{production_id}/reports", tags=["reports"])

SECTIONS: list[tuple[str, str]] = [
    ("general", "General"),
    ("scenic", "Scenic"),
    ("props", "Props"),
    ("costumes", "Costumes"),
    ("hair_makeup", "Hair & makeup"),
    ("sound", "Sound"),
    ("lighting", "Lighting"),
    ("projection", "Projection"),
    ("fight", "Fight & movement"),
    ("publicity", "Publicity"),
    ("cast_notes", "Cast notes"),
    ("follow_up", "Follow-up for tomorrow"),
]
SECTION_KEYS = {key for key, _ in SECTIONS}
MAX_SECTION_LENGTH = 5000


class ReportBody(BaseModel):
    title: str
    report_date: str
    rehearsal_date_id: str | None = None
    sections: dict[str, str] = {}
    distribution: list[str] = []


class ReportUpdate(BaseModel):
    title: str | None = None
    report_date: str | None = None
    rehearsal_date_id: str | None = None
    sections: dict[str, str] | None = None
    distribution: list[str] | None = None


def _clean_sections(raw: dict[str, str]) -> dict[str, str]:
    cleaned: dict[str, str] = {}
    for key, value in raw.items():
        if key not in SECTION_KEYS:
            raise invalid(f"Unknown section: {key}")
        text = (value or "").strip()
        if len(text) > MAX_SECTION_LENGTH:
            raise invalid(f"The {key} section is too long")
        if text:
            cleaned[key] = text
    return cleaned


async def _clean_distribution(
    production_id: str, user_ids: list[str], db: AsyncSession
) -> list[str]:
    unique = list(dict.fromkeys(user_ids))
    if not unique:
        return []
    found = {
        row[0]
        for row in (
            await db.execute(
                select(ProductionMember.user_id).where(
                    ProductionMember.production_id == production_id,
                    ProductionMember.user_id.in_(unique),
                )
            )
        ).all()
    }
    missing = [u for u in unique if u not in found]
    if missing:
        raise invalid("Everyone on the distribution list must be in this production")
    return unique


async def _check_date(production_id: str, rehearsal_date_id: str | None, db: AsyncSession) -> None:
    if not rehearsal_date_id:
        return
    exists = (
        await db.execute(
            select(RehearsalDate.id).where(
                RehearsalDate.id == rehearsal_date_id,
                RehearsalDate.production_id == production_id,
            )
        )
    ).first()
    if not exists:
        raise invalid("That rehearsal date is not in this production")


def _parse_date(value: str) -> dt.date:
    try:
        return dt.date.fromisoformat(value)
    except ValueError:
        raise invalid("Report date must be YYYY-MM-DD")


async def _get_report(production_id: str, report_id: str, db: AsyncSession) -> RehearsalReport:
    report = (
        await db.execute(
            select(RehearsalReport).where(
                RehearsalReport.id == report_id, RehearsalReport.production_id == production_id
            )
        )
    ).scalar_one_or_none()
    if not report:
        raise not_found("Report not found")
    return report


def _summary_json(r: RehearsalReport, author: str | None) -> dict[str, Any]:
    return {
        "id": r.id,
        "title": r.title,
        "report_date": r.report_date.isoformat(),
        "rehearsal_date_id": r.rehearsal_date_id,
        "status": r.status,
        "sent_at": r.sent_at.isoformat() if r.sent_at else None,
        "author_id": r.author_id,
        "author_name": author,
        "recipient_count": len(r.distribution or []),
        "created_at": r.created_at.isoformat(),
    }


async def attendance_snapshot(
    production_id: str, rehearsal_date_id: str | None, db: AsyncSession
) -> dict[str, Any] | None:
    """Who was late, absent or excused on the linked rehearsal, ready to drop into a report."""
    if not rehearsal_date_id:
        return None
    called_ids, _ = await called_for_date(production_id, rehearsal_date_id, db)
    records = (
        (
            await db.execute(
                select(Attendance).where(Attendance.rehearsal_date_id == rehearsal_date_id)
            )
        )
        .scalars()
        .all()
    )
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
    status_of = {r.user_id: r.status for r in records}
    names = await user_names(list(set(called_ids) | set(notices)), db)

    def name(uid: str) -> str:
        return names[uid].name if uid in names else "Unknown"

    late = []
    for uid in called_ids:
        if status_of.get(uid) == "late":
            n = notices.get(uid)
            late.append(
                {"name": name(uid), "minutes": n.minutes_late if n and n.kind == "late" else None}
            )
    return {
        "called": len(called_ids),
        "present": len([u for u in called_ids if status_of.get(u) == "present"]),
        "late": late,
        "absent": [name(u) for u in called_ids if status_of.get(u) == "absent"],
        "excused": [name(u) for u in called_ids if status_of.get(u) == "excused"],
        "not_marked": len([u for u in called_ids if u not in status_of]),
        "notices": [
            {"name": name(u), "kind": n.kind, "minutes_late": n.minutes_late, "note": n.note}
            for u, n in notices.items()
        ],
    }


def _sections_html(sections: dict[str, str]) -> str:
    parts = []
    for key, label in SECTIONS:
        text = sections.get(key)
        if not text:
            continue
        body = html.escape(text).replace("\n", "<br>")
        parts.append(
            f'<h3 style="color:#2a2a2a;font-size:14px;margin:16px 0 4px;">{html.escape(label)}</h3>'
            f'<div style="color:#555;font-size:14px;line-height:1.6;">{body}</div>'
        )
    return "".join(parts) or '<p style="color:#888;">No notes.</p>'


@router.get("/template")
async def report_template(
    production_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await require_staff(production_id, user["id"], db)
    return {"sections": [{"key": k, "label": label} for k, label in SECTIONS]}


@router.get("/snapshot/{rehearsal_date_id}")
async def report_snapshot(
    production_id: str,
    rehearsal_date_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Staff: attendance details for a rehearsal, to paste into a report."""
    await require_staff(production_id, user["id"], db)
    await _check_date(production_id, rehearsal_date_id, db)
    snapshot = await attendance_snapshot(production_id, rehearsal_date_id, db)
    return snapshot or {}


@router.get("")
async def list_reports(
    production_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """Staff see every report. Anyone else sees the sent reports they were included on."""
    member = await require_member(production_id, user["id"], db)
    reports = (
        (
            await db.execute(
                select(RehearsalReport)
                .where(RehearsalReport.production_id == production_id)
                .order_by(RehearsalReport.report_date.desc(), RehearsalReport.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    if member.role not in ("director", "staff"):
        reports = [
            r for r in reports if r.status == "sent" and user["id"] in (r.distribution or [])
        ]
    names = await user_names(list({r.author_id for r in reports}), db)
    return [
        _summary_json(r, names[r.author_id].name if r.author_id in names else None) for r in reports
    ]


@router.post("", status_code=201)
async def create_report(
    production_id: str,
    body: ReportBody,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await require_staff(production_id, user["id"], db)
    await require_writable(production_id, db)
    title = body.title.strip()
    if not title or len(title) > 200:
        raise invalid("Title is required (200 characters or fewer)")
    await _check_date(production_id, body.rehearsal_date_id, db)
    report = RehearsalReport(
        production_id=production_id,
        rehearsal_date_id=body.rehearsal_date_id,
        report_date=_parse_date(body.report_date),
        title=title,
        author_id=user["id"],
        sections=_clean_sections(body.sections),
        distribution=await _clean_distribution(production_id, body.distribution, db),
        status="draft",
    )
    db.add(report)
    await db.flush()
    return _summary_json(report, user.get("name"))


@router.get("/{report_id}")
async def get_report(
    production_id: str,
    report_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    member = await require_member(production_id, user["id"], db)
    report = await _get_report(production_id, report_id, db)
    is_staff = member.role in ("director", "staff")
    is_recipient = report.status == "sent" and user["id"] in (report.distribution or [])
    if not (is_staff or is_recipient):
        raise forbidden("You are not on this report's distribution list")

    names = await user_names(list(set(report.distribution or []) | {report.author_id}), db)
    acks = {
        a.user_id: a.acknowledged_at
        for a in (
            await db.execute(
                select(Acknowledgement).where(
                    Acknowledgement.kind == "report", Acknowledgement.target_id == report.id
                )
            )
        )
        .scalars()
        .all()
    }
    recipient_roles = {
        m.user_id: m.role
        for m in (
            await db.execute(
                select(ProductionMember).where(
                    ProductionMember.production_id == production_id,
                    ProductionMember.user_id.in_(report.distribution or ["none"]),
                )
            )
        )
        .scalars()
        .all()
    }
    result = _summary_json(
        report, names[report.author_id].name if report.author_id in names else None
    )
    result.update(
        {
            "sections": report.sections or {},
            "distribution": report.distribution or [],
            "my_acknowledged": user["id"] in acks,
            "attendance": await attendance_snapshot(production_id, report.rehearsal_date_id, db),
        }
    )
    if is_staff:
        result["recipients"] = [
            {
                "user_id": uid,
                "name": names[uid].name if uid in names else "Unknown",
                "role": recipient_roles.get(uid, "cast"),
                "acknowledged_at": acks[uid].isoformat() if uid in acks else None,
            }
            for uid in (report.distribution or [])
        ]
    return result


@router.put("/{report_id}")
async def update_report(
    production_id: str,
    report_id: str,
    body: ReportUpdate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await require_staff(production_id, user["id"], db)
    await require_writable(production_id, db)
    report = await _get_report(production_id, report_id, db)
    if body.title is not None:
        title = body.title.strip()
        if not title or len(title) > 200:
            raise invalid("Title is required (200 characters or fewer)")
        report.title = title
    if body.report_date is not None:
        report.report_date = _parse_date(body.report_date)
    if body.rehearsal_date_id is not None:
        await _check_date(production_id, body.rehearsal_date_id or None, db)
        report.rehearsal_date_id = body.rehearsal_date_id or None
    if body.sections is not None:
        report.sections = _clean_sections(body.sections)
    if body.distribution is not None:
        report.distribution = await _clean_distribution(production_id, body.distribution, db)
    await db.flush()
    return _summary_json(report, user.get("name"))


@router.delete("/{report_id}", status_code=204)
async def delete_report(
    production_id: str,
    report_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    member = await require_staff(production_id, user["id"], db)
    await require_writable(production_id, db)
    report = await _get_report(production_id, report_id, db)
    if member.role != "director" and report.author_id != user["id"]:
        raise forbidden("Only the author or the director can delete a report")
    await db.delete(report)


@router.post("/{report_id}/send")
async def send_report(
    production_id: str,
    report_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Mark the report as sent and email it to everyone on the distribution list."""
    await require_staff(production_id, user["id"], db)
    await require_writable(production_id, db)
    production = await get_production(production_id, db)
    report = await _get_report(production_id, report_id, db)
    if not report.distribution:
        raise invalid("Add at least one person to the distribution list before sending")
    if not report.sections:
        raise invalid("Add some notes before sending")

    report.status = "sent"
    report.sent_at = dt.datetime.utcnow()
    await db.flush()

    recipients = (
        (await db.execute(select(User).where(User.id.in_(report.distribution)))).scalars().all()
    )
    sections_html = _sections_html(report.sections or {})
    emailed = 0
    for person in recipients:
        if person.email_notifications and send_report_email(
            person.email,
            production.name,
            production_id,
            report.title,
            user.get("name") or "Stage management",
            sections_html,
        ):
            emailed += 1
    return {
        "id": report.id,
        "status": report.status,
        "sent_at": report.sent_at.isoformat(),
        "recipients": len(recipients),
        "emailed": emailed,
    }


@router.post("/{report_id}/ack")
async def acknowledge_report(
    production_id: str,
    report_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await require_member(production_id, user["id"], db)
    report = await _get_report(production_id, report_id, db)
    if report.status != "sent" or user["id"] not in (report.distribution or []):
        raise forbidden("You are not on this report's distribution list")
    existing = (
        await db.execute(
            select(Acknowledgement).where(
                Acknowledgement.kind == "report",
                Acknowledgement.target_id == report.id,
                Acknowledgement.user_id == user["id"],
            )
        )
    ).scalar_one_or_none()
    if not existing:
        existing = Acknowledgement(
            production_id=production_id, kind="report", target_id=report.id, user_id=user["id"]
        )
        db.add(existing)
        await db.flush()
    return {
        "report_id": report.id,
        "acknowledged": True,
        "at": existing.acknowledged_at.isoformat(),
    }
