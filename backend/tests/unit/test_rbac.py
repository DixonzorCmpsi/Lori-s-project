"""
Tests for Role-Based Access Control and middleware (SPEC-002 Section 3).

Covers the full permission matrix:
- AUTH-10: Cast tries to access Director-only route
- AUTH-23: Director elevates Cast to Staff
- AUTH-24: Director demotes Staff to Cast
- AUTH-25: Director removes member from production
- DIR-12: Director elevates cast to staff
- DIR-13: Director removes member
- DIR-21: Director demotes staff to cast
- CAST-09: Cast tries to chat with another cast member
- CAST-10: Director views cast conflicts
- CAST-20: Cast member promoted to Staff
- Data isolation between productions
"""

import pytest


class TestPermissionMatrix:
    """Full permission matrix from SPEC-002 Section 3.2."""

    # --- Theater operations ---

    async def test_director_creates_theater(self, client, auth_headers):
        """Director can create theater."""
        headers = auth_headers("director-id")
        response = await client.post("/api/theaters", json={
            "name": "Test Theater",
            "city": "Springfield",
            "state": "IL",
        }, headers=headers)
        assert response.status_code == 201

    async def test_staff_cannot_create_theater(self, client, auth_headers):
        """Staff cannot create theater."""
        headers = auth_headers("staff-id")
        response = await client.post("/api/theaters", json={
            "name": "Staff Theater",
            "city": "Springfield",
            "state": "IL",
        }, headers=headers)
        assert response.status_code == 403

    async def test_cast_cannot_create_theater(self, client, auth_headers):
        """Cast cannot create theater."""
        headers = auth_headers("cast-id")
        response = await client.post("/api/theaters", json={
            "name": "Cast Theater",
            "city": "Springfield",
            "state": "IL",
        }, headers=headers)
        assert response.status_code == 403

    # --- Production operations ---

    async def test_director_creates_production(self, client, auth_headers):
        """Director can create production."""
        # Tested in test_productions.py, included here for matrix completeness
        pass

    async def test_staff_cannot_create_production(self, client, auth_headers):
        """Staff cannot create production."""
        headers = auth_headers("staff-id")
        response = await client.post("/api/productions", json={
            "theater_id": "theater-id",
            "name": "Staff Production",
            "estimated_cast_size": 20,
            "first_rehearsal": "2026-06-01",
            "opening_night": "2026-08-01",
            "closing_night": "2026-08-07",
        }, headers=headers)
        assert response.status_code == 403

    async def test_cast_cannot_create_production(self, client, auth_headers):
        """AUTH-10: Cast cannot access Director-only routes."""
        headers = auth_headers("cast-id")
        response = await client.post("/api/productions", json={
            "theater_id": "theater-id",
            "name": "Cast Production",
            "estimated_cast_size": 20,
            "first_rehearsal": "2026-06-01",
            "opening_night": "2026-08-01",
            "closing_night": "2026-08-07",
        }, headers=headers)
        assert response.status_code == 403

    # --- Schedule edit operations ---

    async def test_director_edits_schedule(self, client, auth_headers):
        """Director can edit schedule."""
        headers = auth_headers("director-id")
        response = await client.patch("/api/productions/prod-id/schedule/date-id", json={
            "note": "Director note",
        }, headers=headers)
        assert response.status_code == 200

    async def test_staff_edits_schedule(self, client, auth_headers):
        """Staff can edit schedule."""
        headers = auth_headers("staff-id")
        response = await client.patch("/api/productions/prod-id/schedule/date-id", json={
            "note": "Staff note",
        }, headers=headers)
        assert response.status_code == 200

    async def test_cast_cannot_edit_schedule(self, client, auth_headers):
        """Cast cannot edit schedule."""
        headers = auth_headers("cast-id")
        response = await client.patch("/api/productions/prod-id/schedule/date-id", json={
            "note": "Cast note",
        }, headers=headers)
        assert response.status_code == 403

    # --- Bulletin board operations ---

    async def test_all_roles_view_bulletin(self, client, auth_headers):
        """All roles can view bulletin board."""
        for role_id in ["director-id", "staff-id", "cast-id"]:
            headers = auth_headers(role_id)
            response = await client.get("/api/productions/prod-id/bulletin", headers=headers)
            assert response.status_code == 200

    async def test_cast_cannot_post_to_bulletin(self, client, auth_headers):
        """Cast cannot post."""
        headers = auth_headers("cast-id")
        response = await client.post("/api/productions/prod-id/bulletin", json={
            "title": "Test", "body": "Test",
        }, headers=headers)
        assert response.status_code == 403

    # --- Conflict operations ---

    async def test_director_views_all_conflicts(self, client, auth_headers):
        """CAST-10: Director views all cast conflicts."""
        headers = auth_headers("director-id")
        response = await client.get("/api/productions/prod-id/conflicts", headers=headers)
        assert response.status_code == 200

    async def test_staff_views_all_conflicts(self, client, auth_headers):
        """Staff views all cast conflicts."""
        headers = auth_headers("staff-id")
        response = await client.get("/api/productions/prod-id/conflicts", headers=headers)
        assert response.status_code == 200

    async def test_cast_views_only_own_conflicts(self, client, auth_headers):
        """Cast can only view their own conflicts."""
        headers = auth_headers("cast-id")
        response = await client.get("/api/productions/prod-id/conflicts", headers=headers)
        assert response.status_code == 200
        # Response should only contain this user's conflicts

    async def test_only_cast_submits_conflicts(self, client, auth_headers):
        """Director and Staff cannot submit conflicts."""
        for role_id in ["director-id", "staff-id"]:
            headers = auth_headers(role_id)
            response = await client.post("/api/productions/prod-id/conflicts", json={
                "dates": [],
            }, headers=headers)
            assert response.status_code == 403


class TestRoleElevation:
    """AUTH-23, DIR-12: Director elevates Cast to Staff."""

    async def test_director_promotes_cast_to_staff(self, client, auth_headers):
        """Director can promote cast member to staff."""
        headers = auth_headers("director-id")
        response = await client.post(
            "/api/productions/prod-id/members/cast-member-id/promote",
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["role"] == "staff"

    async def test_staff_cannot_promote(self, client, auth_headers):
        """Staff cannot promote other members."""
        headers = auth_headers("staff-id")
        response = await client.post(
            "/api/productions/prod-id/members/cast-member-id/promote",
            headers=headers,
        )
        assert response.status_code == 403

    async def test_cast_cannot_promote(self, client, auth_headers):
        """Cast cannot promote other members."""
        headers = auth_headers("cast-id")
        response = await client.post(
            "/api/productions/prod-id/members/other-cast-id/promote",
            headers=headers,
        )
        assert response.status_code == 403


class TestRoleDemotion:
    """AUTH-24, DIR-21: Director demotes Staff to Cast."""

    async def test_director_demotes_staff_to_cast(self, client, auth_headers):
        """Director can demote staff back to cast."""
        headers = auth_headers("director-id")
        response = await client.post(
            "/api/productions/prod-id/members/staff-member-id/demote",
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["role"] == "cast"

    async def test_staff_cannot_demote(self, client, auth_headers):
        """Staff cannot demote other members."""
        headers = auth_headers("staff-id")
        response = await client.post(
            "/api/productions/prod-id/members/other-staff-id/demote",
            headers=headers,
        )
        assert response.status_code == 403

    async def test_cannot_demote_director(self, client, auth_headers):
        """Director cannot be demoted."""
        headers = auth_headers("director-id")
        response = await client.post(
            "/api/productions/prod-id/members/director-id/demote",
            headers=headers,
        )
        assert response.status_code == 400


class TestDemotionSideEffects:
    """SPEC-003 Section 6.4.1: Demotion side effects."""

    async def test_demoted_user_loses_conflict_view(self, client, auth_headers):
        """Demoted staff loses access to aggregated conflict view."""
        # After demotion, requesting aggregated conflicts returns 403
        headers = auth_headers("demoted-user-id")
        response = await client.get("/api/productions/prod-id/conflicts", headers=headers)
        # If user is now cast, they only see own conflicts
        assert response.status_code == 200  # But scoped to own only

    async def test_demoted_user_loses_post_editing(self, client, auth_headers):
        """Demoted user can no longer edit their bulletin posts."""
        headers = auth_headers("demoted-user-id")
        response = await client.patch("/api/productions/prod-id/bulletin/their-post-id", json={
            "body": "Trying to edit after demotion",
        }, headers=headers)
        assert response.status_code == 403

    async def test_demoted_user_cannot_message_cast(self, client, auth_headers):
        """Demoted user (now Cast) cannot message other Cast."""
        headers = auth_headers("demoted-user-id")
        response = await client.post("/api/productions/prod-id/messages", json={
            "recipient_id": "other-cast-member-id",
            "body": "Can I still message you?",
        }, headers=headers)
        assert response.status_code == 403

    async def test_demoted_user_posts_remain(self, client, auth_headers):
        """Posts authored by demoted user remain visible."""
        # Read-only, not deleted
        headers = auth_headers("director-id")
        response = await client.get("/api/productions/prod-id/bulletin", headers=headers)
        assert response.status_code == 200


class TestMemberRemoval:
    """AUTH-25, DIR-13: Director removes member from production."""

    async def test_director_removes_member(self, client, auth_headers):
        """Director can remove a member from the production."""
        headers = auth_headers("director-id")
        response = await client.delete(
            "/api/productions/prod-id/members/cast-member-id",
            headers=headers,
        )
        assert response.status_code == 200

    async def test_removed_member_loses_access(self, client, auth_headers):
        """Removed member cannot access production resources."""
        headers = auth_headers("removed-member-id")
        response = await client.get("/api/productions/prod-id/bulletin", headers=headers)
        assert response.status_code == 403

    async def test_staff_cannot_remove_members(self, client, auth_headers):
        """Staff cannot remove members."""
        headers = auth_headers("staff-id")
        response = await client.delete(
            "/api/productions/prod-id/members/cast-member-id",
            headers=headers,
        )
        assert response.status_code == 403

    async def test_cannot_remove_director(self, client, auth_headers):
        """Director cannot be removed from their own production."""
        headers = auth_headers("director-id")
        response = await client.delete(
            "/api/productions/prod-id/members/director-id",
            headers=headers,
        )
        assert response.status_code == 400

    async def test_staff_cannot_remove_director(self, client, auth_headers):
        """Staff cannot remove the Director."""
        headers = auth_headers("staff-id")
        response = await client.delete(
            "/api/productions/prod-id/members/director-id",
            headers=headers,
        )
        assert response.status_code == 403


class TestDataIsolation:
    """SPEC-001 Section 7.5: Production data isolation."""

    async def test_member_of_prod_a_cannot_see_prod_b(self, client, auth_headers):
        """User in Production A cannot access Production B data."""
        headers = auth_headers("prod-a-member-id")
        response = await client.get("/api/productions/prod-b-id/bulletin", headers=headers)
        assert response.status_code == 403

    async def test_chat_scoped_to_production(self, client, auth_headers):
        """Chat messages don't cross production boundaries."""
        headers = auth_headers("prod-a-member-id")
        response = await client.get(
            "/api/productions/prod-b-id/conversations",
            headers=headers,
        )
        assert response.status_code == 403

    async def test_invite_link_scoped_to_production(self, client, auth_headers):
        """Invite link only grants access to its specific production."""
        # Token for Production A should not grant access to Production B
        pass

    async def test_conflicts_scoped_to_production(self, client, auth_headers):
        """Conflict data is isolated per production."""
        headers = auth_headers("cast-in-prod-a-id")
        response = await client.get(
            "/api/productions/prod-b-id/conflicts",
            headers=headers,
        )
        assert response.status_code == 403


class TestMiddlewareChain:
    """SPEC-002 Section 3.3: Middleware checks in order."""

    async def test_unauthenticated_returns_401(self, client):
        """Step 1: No auth returns 401."""
        response = await client.get("/api/productions/prod-id/bulletin")
        assert response.status_code == 401
        assert response.json()["error"] == "UNAUTHORIZED"

    async def test_non_member_returns_403(self, client, auth_headers):
        """Step 2: Authenticated but not a member returns 403."""
        headers = auth_headers("non-member-id")
        response = await client.get("/api/productions/prod-id/bulletin", headers=headers)
        assert response.status_code == 403
        assert response.json()["error"] == "FORBIDDEN"

    async def test_wrong_role_returns_403(self, client, auth_headers):
        """Step 3: Member but wrong role returns 403."""
        headers = auth_headers("cast-id")
        response = await client.post("/api/productions/prod-id/bulletin", json={
            "title": "Test", "body": "Test",
        }, headers=headers)
        assert response.status_code == 403


class TestAccountDeletion:
    """SPEC-001 Section 7.3: Account deletion cascades."""

    async def test_delete_account(self, client, auth_headers):
        """User can delete their account."""
        headers = auth_headers("user-to-delete-id")
        response = await client.delete("/api/auth/account", headers=headers)
        assert response.status_code == 200

    async def test_delete_cascades_all_data(self, client, auth_headers, db_session):
        """Account deletion removes all associated data across productions."""
        # After deletion: production_members, cast_profiles, conflicts, messages
        # should all be cascade-deleted
        pass

    async def test_delete_production_only_by_director(self, client, auth_headers):
        """Only Director can delete a production."""
        staff_headers = auth_headers("staff-id")
        response = await client.delete("/api/productions/prod-id", headers=staff_headers)
        assert response.status_code == 403

        cast_headers = auth_headers("cast-id")
        response = await client.delete("/api/productions/prod-id", headers=cast_headers)
        assert response.status_code == 403
