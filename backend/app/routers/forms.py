"""Forms — permission slips, waivers and policies that members e-sign by typing their name.

Signatures cannot be changed after the fact. A form's text cannot be edited once anyone has
signed it (publish a new form instead), so the record always shows exactly what was agreed.
Members under 18 (13-17 on this app) also give a guardian's name and email.
"""

import time
from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import FormSignature, FormTemplate, User
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
from app.services.audit import log_action
from app.services.email import send_form_reminder_email

router = APIRouter(prefix="/productions/{production_id}/forms", tags=["forms"])

REMIND_COOLDOWN_SECONDS = 300
_last_reminder: dict[str, float] = {}


class FormBody(BaseModel):
    title: str
    body: str
    requires_guardian: bool = True
    audience: str = "all"


class FormUpdate(BaseModel):
    title: str | None = None
    body: str | None = None
    requires_guardian: bool | None = None
    audience: str | None = None
    is_active: bool | None = None


class SignBody(BaseModel):
    signed_name: str
    agree: bool = False
    guardian_name: str | None = None
    guardian_email: str | None = None


def _normalize(name: str) -> str:
    return " ".join(name.lower().split())


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("cf-connecting-ip") or request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()[:64]
    return request.client.host[:64] if request.client else None


def _applies(form: FormTemplate, role: str) -> bool:
    return form.audience == "all" or role == "cast"


async def _get_form(production_id: str, form_id: str, db: AsyncSession) -> FormTemplate:
    form = (
        await db.execute(
            select(FormTemplate).where(
                FormTemplate.id == form_id, FormTemplate.production_id == production_id
            )
        )
    ).scalar_one_or_none()
    if not form:
        raise not_found("Form not found")
    return form


def _check_form(title: str, body: str, audience: str) -> None:
    if not title.strip() or len(title) > 200:
        raise invalid("Title is required (200 characters or fewer)")
    if not body.strip():
        raise invalid("The form text is required")
    if len(body) > 20000:
        raise invalid("The form text is too long")
    if audience not in ("all", "cast"):
        raise invalid("Audience must be all or cast")


async def _signature_count(form_id: str, db: AsyncSession) -> int:
    return (
        await db.execute(
            select(func.count(FormSignature.id)).where(FormSignature.form_id == form_id)
        )
    ).scalar() or 0


@router.get("")
async def list_forms(
    production_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """Forms for this production. Staff see all of them with sign-off counts; everyone else
    sees the active forms that apply to them and whether they have signed."""
    member = await require_member(production_id, user["id"], db)
    is_staff = member.role in ("director", "staff")
    forms = (
        (
            await db.execute(
                select(FormTemplate)
                .where(FormTemplate.production_id == production_id)
                .order_by(FormTemplate.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    if not is_staff:
        forms = [f for f in forms if f.is_active and _applies(f, member.role)]

    signed_by_me = {
        row[0]
        for row in (
            await db.execute(
                select(FormSignature.form_id).where(FormSignature.user_id == user["id"])
            )
        ).all()
    }
    roles = [m.role for m, _ in await members_with_users(production_id, db)] if is_staff else []
    out = []
    for f in forms:
        item = {
            "id": f.id,
            "title": f.title,
            "audience": f.audience,
            "requires_guardian": f.requires_guardian,
            "is_active": f.is_active,
            "created_at": f.created_at.isoformat(),
            "signed": f.id in signed_by_me,
            "applies_to_me": _applies(f, member.role),
        }
        if is_staff:
            item["signed_count"] = await _signature_count(f.id, db)
            item["required_count"] = len([r for r in roles if _applies(f, r)])
        out.append(item)
    return out


@router.post("", status_code=201)
async def create_form(
    production_id: str,
    body: FormBody,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await require_staff(production_id, user["id"], db)
    await require_writable(production_id, db)
    _check_form(body.title, body.body, body.audience)
    form = FormTemplate(
        production_id=production_id,
        title=body.title.strip(),
        body=body.body.strip(),
        requires_guardian=body.requires_guardian,
        audience=body.audience,
        created_by=user["id"],
    )
    db.add(form)
    await db.flush()
    return {"id": form.id, "title": form.title}


@router.get("/{form_id}")
async def get_form(
    production_id: str,
    form_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    member = await require_member(production_id, user["id"], db)
    form = await _get_form(production_id, form_id, db)
    mine = (
        await db.execute(
            select(FormSignature).where(
                FormSignature.form_id == form.id, FormSignature.user_id == user["id"]
            )
        )
    ).scalar_one_or_none()
    return {
        "id": form.id,
        "title": form.title,
        "body": form.body,
        "audience": form.audience,
        "requires_guardian": form.requires_guardian,
        "is_active": form.is_active,
        "applies_to_me": _applies(form, member.role),
        "locked": await _signature_count(form.id, db) > 0,
        "my_signature": {
            "signed_name": mine.signed_name,
            "signed_at": mine.signed_at.isoformat(),
            "guardian_name": mine.guardian_name,
            "guardian_email": mine.guardian_email,
        }
        if mine
        else None,
    }


@router.patch("/{form_id}")
async def update_form(
    production_id: str,
    form_id: str,
    body: FormUpdate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await require_staff(production_id, user["id"], db)
    await require_writable(production_id, db)
    form = await _get_form(production_id, form_id, db)
    locked = await _signature_count(form.id, db) > 0
    text_change = any(
        v is not None for v in (body.title, body.body, body.requires_guardian, body.audience)
    )
    if locked and text_change:
        raise invalid(
            "This form has been signed, so its text can't change. Archive it and publish a new one.",
            code="LOCKED",
            status_code=409,
        )
    title = body.title if body.title is not None else form.title
    text = body.body if body.body is not None else form.body
    audience = body.audience if body.audience is not None else form.audience
    _check_form(title, text, audience)
    form.title, form.body, form.audience = title.strip(), text.strip(), audience
    if body.requires_guardian is not None:
        form.requires_guardian = body.requires_guardian
    if body.is_active is not None:
        form.is_active = body.is_active
    await db.flush()
    return {"id": form.id, "is_active": form.is_active}


@router.delete("/{form_id}", status_code=204)
async def delete_form(
    production_id: str,
    form_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_staff(production_id, user["id"], db)
    await require_writable(production_id, db)
    form = await _get_form(production_id, form_id, db)
    if await _signature_count(form.id, db) > 0:
        raise invalid(
            "This form has signatures. Archive it instead of deleting it.",
            code="LOCKED",
            status_code=409,
        )
    await db.delete(form)


@router.post("/{form_id}/sign", status_code=201)
async def sign_form(
    production_id: str,
    form_id: str,
    body: SignBody,
    request: Request,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    member = await require_member(production_id, user["id"], db)
    await require_writable(production_id, db)
    form = await _get_form(production_id, form_id, db)
    if not form.is_active:
        raise invalid("This form is no longer open for signing")
    if not _applies(form, member.role):
        raise invalid("This form is not for your role")
    if not body.agree:
        raise invalid("Tick the box to confirm you have read and agree")

    me = (await db.execute(select(User).where(User.id == user["id"]))).scalar_one()
    if _normalize(body.signed_name) != _normalize(me.name):
        raise invalid(f"Type your full name exactly as it appears on your account: {me.name}")

    existing = (
        await db.execute(
            select(FormSignature).where(
                FormSignature.form_id == form.id, FormSignature.user_id == user["id"]
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise invalid("You have already signed this form", code="CONFLICT", status_code=409)

    guardian_name = (body.guardian_name or "").strip() or None
    guardian_email = (body.guardian_email or "").strip() or None
    if form.requires_guardian and me.age_range == "13-17":
        if not guardian_name or not guardian_email:
            raise invalid("A parent or guardian's name and email are required for members under 18")
        if "@" not in guardian_email or len(guardian_email) > 320:
            raise invalid("Enter a valid guardian email")

    sig = FormSignature(
        form_id=form.id,
        user_id=user["id"],
        signed_name=body.signed_name.strip(),
        guardian_name=guardian_name,
        guardian_email=guardian_email,
        ip_address=_client_ip(request),
    )
    db.add(sig)
    await db.flush()
    await log_action(
        "form.signed",
        "form",
        resource_id=form.id,
        user_id=user["id"],
        actor_id=user["id"],
        details=form.title[:200],
    )
    return {"form_id": form.id, "signed_at": sig.signed_at.isoformat()}


@router.get("/{form_id}/signatures")
async def list_signatures(
    production_id: str,
    form_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Staff: who has signed and who has not."""
    await require_staff(production_id, user["id"], db)
    form = await _get_form(production_id, form_id, db)
    sigs = (
        (await db.execute(select(FormSignature).where(FormSignature.form_id == form.id)))
        .scalars()
        .all()
    )
    by_user = {s.user_id: s for s in sigs}
    signed, pending = [], []
    for member, person in await members_with_users(production_id, db):
        if not _applies(form, member.role):
            continue
        base = {"user_id": person.id, "name": person.name, "role": member.role}
        sig = by_user.get(person.id)
        if sig:
            signed.append(
                {
                    **base,
                    "signed_at": sig.signed_at.isoformat(),
                    "guardian_name": sig.guardian_name,
                    "guardian_email": sig.guardian_email,
                }
            )
        else:
            pending.append({**base, "is_minor": person.age_range == "13-17"})
    signed.sort(key=lambda r: r["name"].lower())
    pending.sort(key=lambda r: r["name"].lower())
    return {"form_id": form.id, "title": form.title, "signed": signed, "pending": pending}


@router.post("/{form_id}/remind")
async def remind_unsigned(
    production_id: str,
    form_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await require_staff(production_id, user["id"], db)
    await require_writable(production_id, db)
    production = await get_production(production_id, db)
    form = await _get_form(production_id, form_id, db)
    if not form.is_active:
        raise invalid("This form is archived")

    now = time.monotonic()
    last = _last_reminder.get(form_id)
    if last is not None and now - last < REMIND_COOLDOWN_SECONDS:
        raise invalid(
            "A reminder was just sent. Please wait a few minutes before sending another.",
            code="RATE_LIMITED",
            status_code=429,
        )
    signed_ids = {
        row[0]
        for row in (
            await db.execute(select(FormSignature.user_id).where(FormSignature.form_id == form.id))
        ).all()
    }
    pending = [
        person
        for member, person in await members_with_users(production_id, db)
        if _applies(form, member.role) and person.id not in signed_ids
    ]
    emailed = 0
    for person in pending:
        if person.email_notifications and send_form_reminder_email(
            person.email, production.name, production_id, form.title
        ):
            emailed += 1
    _last_reminder[form_id] = now
    return {"pending": len(pending), "emailed": emailed}
