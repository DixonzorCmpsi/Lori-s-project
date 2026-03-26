"""Scene breakdown CRUD — directors define scenes and assign cast members."""

from typing import Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Scene, SceneRole, ProductionMember, CastConflict
from app.routers.auth import get_current_user

router = APIRouter(prefix="/productions/{production_id}/scenes", tags=["scenes"])


class SceneCreate(BaseModel):
    name: str
    description: Optional[str] = None
    order_index: int = 0


class SceneRoleAdd(BaseModel):
    user_id: str
    character_name: Optional[str] = None


async def _require_staff(production_id: str, user_id: str, db: AsyncSession):
    result = await db.execute(
        select(ProductionMember).where(
            ProductionMember.production_id == production_id,
            ProductionMember.user_id == user_id,
        )
    )
    member = result.scalar_one_or_none()
    if not member or member.role not in ("director", "staff"):
        raise HTTPException(status_code=403, detail={"error": "FORBIDDEN", "message": "Staff or director required"})
    return member


@router.get("")
async def list_scenes(production_id: str, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> list[dict[str, Any]]:
    result = await db.execute(
        select(Scene).where(Scene.production_id == production_id).order_by(Scene.order_index)
    )
    scenes = result.scalars().all()
    out = []
    for s in scenes:
        roles_result = await db.execute(select(SceneRole).where(SceneRole.scene_id == s.id))
        roles = roles_result.scalars().all()
        out.append({
            "id": s.id,
            "name": s.name,
            "description": s.description,
            "order_index": s.order_index,
            "cast": [{"user_id": r.user_id, "character_name": r.character_name} for r in roles],
        })
    return out


@router.post("", status_code=201)
async def create_scene(production_id: str, body: SceneCreate, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    await _require_staff(production_id, user["sub"], db)
    scene = Scene(production_id=production_id, name=body.name, description=body.description, order_index=body.order_index)
    db.add(scene)
    await db.flush()
    return {"id": scene.id, "name": scene.name, "description": scene.description, "order_index": scene.order_index, "cast": []}


@router.delete("/{scene_id}", status_code=204)
async def delete_scene(production_id: str, scene_id: str, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _require_staff(production_id, user["sub"], db)
    result = await db.execute(select(Scene).where(Scene.id == scene_id, Scene.production_id == production_id))
    scene = result.scalar_one_or_none()
    if not scene:
        raise HTTPException(status_code=404, detail={"error": "NOT_FOUND", "message": "Scene not found"})
    await db.delete(scene)


@router.post("/{scene_id}/cast", status_code=201)
async def add_cast_to_scene(production_id: str, scene_id: str, body: SceneRoleAdd, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    await _require_staff(production_id, user["sub"], db)
    # Verify scene exists
    scene = (await db.execute(select(Scene).where(Scene.id == scene_id, Scene.production_id == production_id))).scalar_one_or_none()
    if not scene:
        raise HTTPException(status_code=404, detail={"error": "NOT_FOUND", "message": "Scene not found"})
    # Verify user is a production member
    member = (await db.execute(select(ProductionMember).where(
        ProductionMember.production_id == production_id, ProductionMember.user_id == body.user_id
    ))).scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=400, detail={"error": "INVALID", "message": "User is not a production member"})
    role = SceneRole(scene_id=scene_id, user_id=body.user_id, character_name=body.character_name)
    db.add(role)
    await db.flush()
    return {"id": role.id, "scene_id": scene_id, "user_id": body.user_id, "character_name": body.character_name}


@router.delete("/{scene_id}/cast/{user_id}", status_code=204)
async def remove_cast_from_scene(production_id: str, scene_id: str, user_id: str, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    await _require_staff(production_id, user["sub"], db)
    result = await db.execute(select(SceneRole).where(SceneRole.scene_id == scene_id, SceneRole.user_id == user_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail={"error": "NOT_FOUND", "message": "Cast member not in this scene"})
    await db.delete(role)


@router.get("/{scene_id}/conflicts")
async def check_scene_conflicts(production_id: str, scene_id: str, rehearsal_date_id: str, user: dict = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> dict[str, Any]:
    """Cross-reference: check which actors in this scene have conflicts for a specific date.
    Returns Green/Yellow/Red status."""
    await _require_staff(production_id, user["sub"], db)

    # Get all cast in this scene
    roles = (await db.execute(select(SceneRole).where(SceneRole.scene_id == scene_id))).scalars().all()
    scene_user_ids = [r.user_id for r in roles]

    if not scene_user_ids:
        return {"status": "green", "total_cast": 0, "conflicts": [], "available": []}

    # Check conflicts for these users on this date
    conflicts = (await db.execute(
        select(CastConflict).where(
            CastConflict.rehearsal_date_id == rehearsal_date_id,
            CastConflict.user_id.in_(scene_user_ids),
        )
    )).scalars().all()

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
        "conflicts": [
            {"user_id": c.user_id, "reason": c.reason}
            for c in conflicts
        ],
        "available_count": len(available_ids),
    }
