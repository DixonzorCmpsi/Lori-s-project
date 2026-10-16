"""Scene breakdown CRUD — directors define scenes and assign cast members."""

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import CastConflict, ProductionMember, Scene, SceneRole
from app.routers.auth import get_current_user
from app.services.access import require_member, user_names

router = APIRouter(prefix="/productions/{production_id}/scenes", tags=["scenes"])


class SceneCreate(BaseModel):
    name: str
    description: str | None = None
    order_index: int = 0


class SceneUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    order_index: int | None = None


class SceneRoleAdd(BaseModel):
    user_id: str
    character_name: str | None = None


class SceneRoleUpdate(BaseModel):
    character_name: str | None = None


async def _require_staff(production_id: str, user_id: str, db: AsyncSession):
    result = await db.execute(
        select(ProductionMember).where(
            ProductionMember.production_id == production_id,
            ProductionMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member or member.role not in ("director", "staff"):
        raise HTTPException(
            status_code=403, detail={"error": "FORBIDDEN", "message": "Staff or director required"}
        )
    return member


@router.get("")
async def list_scenes(
    production_id: str, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> list[dict[str, Any]]:
    await require_member(production_id, user["id"], db)
    result = await db.execute(
        select(Scene).where(Scene.production_id == production_id).order_by(Scene.order_index)
    )
    scenes = result.scalars().all()
    all_roles = []
    if scenes:
        all_roles = (
            (
                await db.execute(
                    select(SceneRole).where(SceneRole.scene_id.in_([sc.id for sc in scenes]))
                )
            )
            .scalars()
            .all()
        )
    names = await user_names(list({r.user_id for r in all_roles}), db)
    out = []
    for sc in scenes:
        out.append(
            {
                "id": sc.id,
                "name": sc.name,
                "description": sc.description,
                "order_index": sc.order_index,
                "cast": [
                    {
                        "user_id": r.user_id,
                        "name": names[r.user_id].name if r.user_id in names else "Unknown",
                        "character_name": r.character_name,
                    }
                    for r in all_roles
                    if r.scene_id == sc.id
                ],
            }
        )
    return out


@router.get("/availability")
async def scenes_availability(
    production_id: str,
    rehearsal_date_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """Staff: for one date, how workable is each scene (green, yellow, red)?"""
    await _require_staff(production_id, user["id"], db)
    scenes = (
        (
            await db.execute(
                select(Scene)
                .where(Scene.production_id == production_id)
                .order_by(Scene.order_index)
            )
        )
        .scalars()
        .all()
    )
    conflicts = (
        (
            await db.execute(
                select(CastConflict).where(CastConflict.rehearsal_date_id == rehearsal_date_id)
            )
        )
        .scalars()
        .all()
    )
    reasons = {c.user_id: c.reason for c in conflicts}
    out = []
    for scene in scenes:
        roles = (
            (await db.execute(select(SceneRole).where(SceneRole.scene_id == scene.id)))
            .scalars()
            .all()
        )
        names = await user_names([r.user_id for r in roles], db)
        blocked = [
            {
                "user_id": r.user_id,
                "name": names[r.user_id].name if r.user_id in names else "Unknown",
                "reason": reasons[r.user_id],
            }
            for r in roles
            if r.user_id in reasons
        ]
        status = "green" if not blocked else "yellow" if len(blocked) <= 2 else "red"
        out.append(
            {
                "scene_id": scene.id,
                "name": scene.name,
                "status": status,
                "total_cast": len(roles),
                "conflicts": blocked,
            }
        )
    return out


@router.post("", status_code=201)
async def create_scene(
    production_id: str,
    body: SceneCreate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await _require_staff(production_id, user["id"], db)
    scene = Scene(
        production_id=production_id,
        name=body.name,
        description=body.description,
        order_index=body.order_index,
    )
    db.add(scene)
    await db.flush()
    return {
        "id": scene.id,
        "name": scene.name,
        "description": scene.description,
        "order_index": scene.order_index,
        "cast": [],
    }


@router.patch("/{scene_id}")
async def update_scene(
    production_id: str,
    scene_id: str,
    body: SceneUpdate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await _require_staff(production_id, user["id"], db)
    scene = (
        await db.execute(
            select(Scene).where(Scene.id == scene_id, Scene.production_id == production_id)
        )
    ).scalar_one_or_none()
    if not scene:
        raise HTTPException(
            status_code=404, detail={"error": "NOT_FOUND", "message": "Scene not found"}
        )
    if body.name is not None:
        if not body.name.strip():
            raise HTTPException(
                status_code=400,
                detail={"error": "VALIDATION_ERROR", "message": "Scene name is required"},
            )
        scene.name = body.name.strip()
    if body.description is not None:
        scene.description = body.description.strip() or None
    if body.order_index is not None:
        scene.order_index = body.order_index
    await db.flush()
    return {
        "id": scene.id,
        "name": scene.name,
        "description": scene.description,
        "order_index": scene.order_index,
    }


@router.patch("/{scene_id}/cast/{user_id}")
async def update_scene_role(
    production_id: str,
    scene_id: str,
    user_id: str,
    body: SceneRoleUpdate,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await _require_staff(production_id, user["id"], db)
    role = (
        await db.execute(
            select(SceneRole).where(SceneRole.scene_id == scene_id, SceneRole.user_id == user_id)
        )
    ).scalar_one_or_none()
    if not role:
        raise HTTPException(
            status_code=404,
            detail={"error": "NOT_FOUND", "message": "Cast member not in this scene"},
        )
    role.character_name = (body.character_name or "").strip() or None
    await db.flush()
    return {"scene_id": scene_id, "user_id": user_id, "character_name": role.character_name}


@router.delete("/{scene_id}", status_code=204)
async def delete_scene(
    production_id: str,
    scene_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_staff(production_id, user["id"], db)
    result = await db.execute(
        select(Scene).where(Scene.id == scene_id, Scene.production_id == production_id)
    )
    scene = result.scalar_one_or_none()
    if not scene:
        raise HTTPException(
            status_code=404, detail={"error": "NOT_FOUND", "message": "Scene not found"}
        )
    await db.delete(scene)


@router.post("/{scene_id}/cast", status_code=201)
async def add_cast_to_scene(
    production_id: str,
    scene_id: str,
    body: SceneRoleAdd,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    await _require_staff(production_id, user["id"], db)
    # Verify scene exists
    scene = (
        await db.execute(
            select(Scene).where(Scene.id == scene_id, Scene.production_id == production_id)
        )
    ).scalar_one_or_none()
    if not scene:
        raise HTTPException(
            status_code=404, detail={"error": "NOT_FOUND", "message": "Scene not found"}
        )
    # Verify user is a production member
    member = (
        await db.execute(
            select(ProductionMember).where(
                ProductionMember.production_id == production_id,
                ProductionMember.user_id == body.user_id,
            )
        )
    ).scalar_one_or_none()
    if not member:
        raise HTTPException(
            status_code=400,
            detail={"error": "INVALID", "message": "User is not a production member"},
        )
    already = (
        await db.execute(
            select(SceneRole).where(
                SceneRole.scene_id == scene_id, SceneRole.user_id == body.user_id
            )
        )
    ).scalar_one_or_none()
    if already:
        raise HTTPException(
            status_code=409,
            detail={"error": "CONFLICT", "message": "Already in this scene"},
        )
    role = SceneRole(scene_id=scene_id, user_id=body.user_id, character_name=body.character_name)
    db.add(role)
    try:
        await db.flush()
    except IntegrityError:
        raise HTTPException(
            status_code=409, detail={"error": "CONFLICT", "message": "Already in this scene"}
        )
    return {
        "id": role.id,
        "scene_id": scene_id,
        "user_id": body.user_id,
        "character_name": body.character_name,
    }


@router.delete("/{scene_id}/cast/{user_id}", status_code=204)
async def remove_cast_from_scene(
    production_id: str,
    scene_id: str,
    user_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _require_staff(production_id, user["id"], db)
    result = await db.execute(
        select(SceneRole).where(SceneRole.scene_id == scene_id, SceneRole.user_id == user_id)
    )
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(
            status_code=404,
            detail={"error": "NOT_FOUND", "message": "Cast member not in this scene"},
        )
    await db.delete(role)


@router.get("/{scene_id}/conflicts")
async def check_scene_conflicts(
    production_id: str,
    scene_id: str,
    rehearsal_date_id: str,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Cross-reference: check which actors in this scene have conflicts for a specific date.
    Returns Green/Yellow/Red status."""
    await _require_staff(production_id, user["id"], db)

    # Get all cast in this scene
    roles = (
        (await db.execute(select(SceneRole).where(SceneRole.scene_id == scene_id))).scalars().all()
    )
    scene_user_ids = [r.user_id for r in roles]

    if not scene_user_ids:
        return {"status": "green", "total_cast": 0, "conflicts": [], "available": []}

    # Check conflicts for these users on this date
    conflicts = (
        (
            await db.execute(
                select(CastConflict).where(
                    CastConflict.rehearsal_date_id == rehearsal_date_id,
                    CastConflict.user_id.in_(scene_user_ids),
                )
            )
        )
        .scalars()
        .all()
    )

    conflict_user_ids = {c.user_id for c in conflicts}
    available_ids = [uid for uid in scene_user_ids if uid not in conflict_user_ids]

    # Severity
    conflict_count = len(conflict_user_ids)
    total = len(scene_user_ids)
    if conflict_count == 0:
        severity = "green"
    elif conflict_count <= 2:
        severity = "yellow"
    else:
        severity = "red"

    return {
        "status": severity,
        "total_cast": total,
        "conflict_count": conflict_count,
        "conflicts": [{"user_id": c.user_id, "reason": c.reason} for c in conflicts],
        "available_count": len(available_ids),
    }
