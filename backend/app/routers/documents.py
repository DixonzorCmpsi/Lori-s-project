"""Documents hub — scripts, music, handbooks and other files shared with the company."""

import os
from typing import Any

from fastapi import APIRouter, Depends, File, Form, Response, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import undefer

from app.database import get_db
from app.models import Document
from app.routers.auth import get_current_user
from app.services.access import (
    invalid,
    not_found,
    require_member,
    require_staff,
    require_writable,
    user_names,
)

router = APIRouter(prefix="/productions/{production_id}/documents", tags=["documents"])

MAX_BYTES = 10 * 1024 * 1024
CATEGORIES = ("script", "music", "schedule", "handbook", "design", "other")

# Only these types are accepted. The content type is set from the extension, never taken from
# the upload, and files are always served as attachments.
ALLOWED_TYPES = {
    ".pdf": "application/pdf",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".markdown": "text/markdown",
    ".rtf": "application/rtf",
    ".csv": "text/csv",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".mp3": "audio/mpeg",
    ".m4a": "audio/mp4",
    ".wav": "audio/wav",
    ".mp4": "video/mp4",
}


class DocumentUpdate(BaseModel):
    title: str | None = None
    category: str | None = None
    description: str | None = None


def _json(d: Document, uploader: str | None) -> dict[str, Any]:
    return {
        "id": d.id,
        "title": d.title,
        "category": d.category,
        "description": d.description,
        "filename": d.filename,
        "content_type": d.content_type,
        "size_bytes": d.size_bytes,
        "uploaded_by": d.uploaded_by,
        "uploaded_by_name": uploader,
        "created_at": d.created_at.isoformat(),
    }


def _safe_filename(name: str) -> str:
    base = os.path.basename(name.replace("\\", "/")).strip()
    cleaned = "".join(c for c in base if c.isalnum() or c in " ._-()")[:200].strip(" .")
    return cleaned or "file"


async def _get(
    production_id: str, doc_id: str, db: AsyncSession, with_data: bool = False
) -> Document:
    stmt = select(Document).where(Document.id == doc_id, Document.production_id == production_id)
    if with_data:
        stmt = stmt.options(undefer(Document.data))
    doc = (await db.execute(stmt)).scalar_one_or_none()
    if not doc:
        raise not_found("Document not found")
    return doc


@router.get("")
async def list_documents(
    production_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    await require_member(production_id, user["id"], db)
    docs = (
        (
            await db.execute(
                select(Document)
                .where(Document.production_id == production_id)
                .order_by(Document.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    names = await user_names(list({d.uploaded_by for d in docs}), db)
    return [_json(d, names[d.uploaded_by].name if d.uploaded_by in names else None) for d in docs]


@router.post("", status_code=201)
async def upload_document(
    production_id: str,
    file: UploadFile = File(...),
    title: str = Form(...),
    category: str = Form("other"),
    description: str = Form(""),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await require_staff(production_id, user["id"], db)
    await require_writable(production_id, db)

    if not title.strip() or len(title) > 200:
        raise invalid("Title is required (200 characters or fewer)")
    if category not in CATEGORIES:
        raise invalid("Choose a category: " + ", ".join(CATEGORIES))
    if len(description) > 1000:
        raise invalid("Description must be 1000 characters or fewer")

    filename = _safe_filename(file.filename or "file")
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_TYPES:
        raise invalid("That file type is not allowed. Use PDF, Office, text, image, audio or MP4.")

    data = await file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise invalid("File exceeds the 10MB limit", code="PAYLOAD_TOO_LARGE", status_code=413)
    if not data:
        raise invalid("The file is empty")

    doc = Document(
        production_id=production_id,
        title=title.strip(),
        category=category,
        description=description.strip() or None,
        filename=filename,
        content_type=ALLOWED_TYPES[ext],
        size_bytes=len(data),
        data=data,
        uploaded_by=user["id"],
    )
    db.add(doc)
    await db.flush()
    return _json(doc, user.get("name"))


@router.patch("/{doc_id}")
async def update_document(
    production_id: str,
    doc_id: str,
    body: DocumentUpdate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await require_staff(production_id, user["id"], db)
    await require_writable(production_id, db)
    doc = await _get(production_id, doc_id, db)
    if body.title is not None:
        if not body.title.strip() or len(body.title) > 200:
            raise invalid("Title is required (200 characters or fewer)")
        doc.title = body.title.strip()
    if body.category is not None:
        if body.category not in CATEGORIES:
            raise invalid("Choose a category: " + ", ".join(CATEGORIES))
        doc.category = body.category
    if body.description is not None:
        if len(body.description) > 1000:
            raise invalid("Description must be 1000 characters or fewer")
        doc.description = body.description.strip() or None
    await db.flush()
    return _json(doc, None)


@router.get("/{doc_id}/download")
async def download_document(
    production_id: str,
    doc_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await require_member(production_id, user["id"], db)
    doc = await _get(production_id, doc_id, db, with_data=True)
    return Response(
        content=doc.data,
        media_type=doc.content_type,
        headers={
            "Content-Disposition": f'attachment; filename="{doc.filename}"',
            "Cache-Control": "private, no-store",
        },
    )


@router.delete("/{doc_id}", status_code=204)
async def delete_document(
    production_id: str,
    doc_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await require_staff(production_id, user["id"], db)
    await require_writable(production_id, db)
    await db.delete(await _get(production_id, doc_id, db))
