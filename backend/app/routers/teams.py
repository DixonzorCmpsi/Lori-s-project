"""Teams router — create groups, assign cast members."""

import uuid
from typing import Any, Optional, List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select

from app.database import async_session_maker
from app.models import Production, ProductionMember, Team, TeamMember
from app.routers.auth import get_current_user

router = APIRouter()


async def _require_staff(production_id: str, user_id: str) -> ProductionMember:
    async with async_session_maker() as session:
        stmt = select(ProductionMember).where(
            ProductionMember.user_id == user_id,
            ProductionMember.production_id == production_id,
        )
        result = await session.execute(stmt)
        member = result.scalar_one_or_none()
        if not member or member.role not in ("director", "staff"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": "FORBIDDEN", "message": "Director or staff only"},
            )
        return member


class CreateTeamRequest(BaseModel):
    name: str


class AssignMembersRequest(BaseModel):
    user_ids: List[str]


class CycleAssignmentRequest(BaseModel):
    user_id: str
    team_id: Optional[str] = None  # None = remove from all teams


@router.get("/productions/{production_id}/teams")
async def list_teams(
    production_id: str,
    current_user: dict = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """List all teams in a production with member counts."""
    async with async_session_maker() as session:
        # Any member can view teams
        stmt = select(ProductionMember).where(
            ProductionMember.user_id == current_user["id"],
            ProductionMember.production_id == production_id,
        )
        result = await session.execute(stmt)
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail={"error": "FORBIDDEN", "message": "Not a member"})

        stmt = select(Team).where(Team.production_id == production_id)
        result = await session.execute(stmt)
        teams = result.scalars().all()

        team_data = []
        for team in teams:
            stmt = select(TeamMember).where(TeamMember.team_id == team.id)
            result = await session.execute(stmt)
            members = result.scalars().all()
            team_data.append({
                "id": team.id,
                "name": team.name,
                "member_count": len(members),
                "member_user_ids": [m.user_id for m in members],
            })
        return team_data


@router.post("/productions/{production_id}/teams", status_code=201)
async def create_team(
    production_id: str,
    body: CreateTeamRequest,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Create a new team."""
    await _require_staff(production_id, current_user["id"])

    if not body.name or len(body.name) > 200:
        raise HTTPException(status_code=400, detail={"error": "VALIDATION_ERROR", "message": "Name required (max 200 chars)"})

    async with async_session_maker() as session:
        team = Team(
            id=str(uuid.uuid4()),
            production_id=production_id,
            name=body.name,
        )
        session.add(team)
        await session.commit()
        return {"id": team.id, "name": team.name, "member_count": 0, "member_user_ids": []}


@router.delete("/productions/{production_id}/teams/{team_id}")
async def delete_team(
    production_id: str,
    team_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Delete a team."""
    await _require_staff(production_id, current_user["id"])

    async with async_session_maker() as session:
        stmt = select(Team).where(Team.id == team_id, Team.production_id == production_id)
        result = await session.execute(stmt)
        team = result.scalar_one_or_none()
        if not team:
            raise HTTPException(status_code=404, detail={"error": "NOT_FOUND", "message": "Team not found"})
        await session.delete(team)
        await session.commit()
        return {"message": "Team deleted"}


@router.post("/productions/{production_id}/teams/{team_id}/members")
async def assign_members(
    production_id: str,
    team_id: str,
    body: AssignMembersRequest,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Set team members (replaces existing). Send the full list of user_ids."""
    await _require_staff(production_id, current_user["id"])

    async with async_session_maker() as session:
        stmt = select(Team).where(Team.id == team_id, Team.production_id == production_id)
        result = await session.execute(stmt)
        team = result.scalar_one_or_none()
        if not team:
            raise HTTPException(status_code=404, detail={"error": "NOT_FOUND", "message": "Team not found"})

        # Clear existing members
        stmt = select(TeamMember).where(TeamMember.team_id == team_id)
        result = await session.execute(stmt)
        for old in result.scalars().all():
            await session.delete(old)

        # Add new members
        for uid in body.user_ids:
            tm = TeamMember(id=str(uuid.uuid4()), team_id=team_id, user_id=uid)
            session.add(tm)

        await session.commit()
        return {"team_id": team_id, "member_count": len(body.user_ids)}


@router.post("/productions/{production_id}/teams/cycle-member")
async def cycle_member_team(
    production_id: str,
    body: CycleAssignmentRequest,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Assign a user to a team (or remove from all teams if team_id is null).
    Used by the click-to-cycle UI pattern."""
    await _require_staff(production_id, current_user["id"])

    async with async_session_maker() as session:
        # Remove from all teams in this production first
        stmt = select(Team).where(Team.production_id == production_id)
        result = await session.execute(stmt)
        prod_teams = result.scalars().all()
        prod_team_ids = [t.id for t in prod_teams]

        if prod_team_ids:
            stmt = select(TeamMember).where(
                TeamMember.team_id.in_(prod_team_ids),
                TeamMember.user_id == body.user_id,
            )
            result = await session.execute(stmt)
            for old in result.scalars().all():
                await session.delete(old)

        # Assign to new team if specified
        if body.team_id:
            if body.team_id not in prod_team_ids:
                raise HTTPException(status_code=404, detail={"error": "NOT_FOUND", "message": "Team not found"})
            tm = TeamMember(id=str(uuid.uuid4()), team_id=body.team_id, user_id=body.user_id)
            session.add(tm)

        await session.commit()
        return {"user_id": body.user_id, "team_id": body.team_id}


@router.get("/productions/{production_id}/teams/my-team")
async def get_my_team(
    production_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Get the current user's team and teammates."""
    async with async_session_maker() as session:
        stmt = select(ProductionMember).where(
            ProductionMember.user_id == current_user["id"],
            ProductionMember.production_id == production_id,
        )
        result = await session.execute(stmt)
        if not result.scalar_one_or_none():
            raise HTTPException(status_code=403, detail={"error": "FORBIDDEN", "message": "Not a member"})

        # Find teams this user is in
        stmt = select(Team).where(Team.production_id == production_id)
        result = await session.execute(stmt)
        all_teams = result.scalars().all()

        my_teams = []
        teammate_ids = set()
        for team in all_teams:
            stmt = select(TeamMember).where(TeamMember.team_id == team.id)
            result = await session.execute(stmt)
            team_members = result.scalars().all()
            member_ids = [m.user_id for m in team_members]
            if current_user["id"] in member_ids:
                my_teams.append({"id": team.id, "name": team.name, "member_user_ids": member_ids})
                teammate_ids.update(member_ids)

        teammate_ids.discard(current_user["id"])

        return {
            "teams": my_teams,
            "teammate_user_ids": list(teammate_ids),
        }
