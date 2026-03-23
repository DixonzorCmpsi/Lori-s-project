"""
End-to-end Staff flow test.

Tests the Staff journey — a Cast member promoted to Staff by the Director.
Staff is NOT a separate onboarding path. Staff is a role promotion within a production.

Flow:
  1. Join as Cast (via invite link)
  2. Get promoted to Staff by Director
  3. Gain admin-level privileges
  4. Post to bulletin board
  5. Pin a bulletin post
  6. Edit own post
  7. Cannot edit Director's post
  8. Chat with anyone (including cast members)
  9. View aggregated conflict data
  10. Generate invite link
  11. View member roster
  12. Cannot promote/demote other members
  13. Cannot remove members
  14. Cannot delete production
  15. Cannot archive production
  16. Get demoted back to Cast
  17. Lose admin privileges immediately
  18. Cannot post to bulletin after demotion
  19. Cannot message other cast after demotion
  20. Existing posts remain visible after demotion
"""

import pytest


class TestStaffFullFlow:
    """Complete Staff journey — promotion through demotion."""

    # ------------------------------------------------------------------ #
    #  PHASE 1 — Join as Cast, then get promoted
    # ------------------------------------------------------------------ #

    async def test_step_01_join_as_cast(self, client, auth_headers):
        """Staff member starts by joining as Cast via invite link."""
        headers = auth_headers("staff-to-be-id")
        response = await client.post("/api/join", json={
            "token": "valid-invite-token",
        }, headers=headers)
        assert response.status_code == 200
        assert response.json()["role"] == "cast"
        self.__class__.production_id = response.json()["production_id"]

    async def test_step_02_initially_cannot_post(self, client, auth_headers):
        """As Cast, cannot post to bulletin."""
        headers = auth_headers("staff-to-be-id")
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/bulletin",
            json={"title": "Test", "body": "Should fail"},
            headers=headers,
        )
        assert response.status_code == 403

    async def test_step_03_director_promotes_to_staff(self, client, auth_headers):
        """Director promotes this Cast member to Staff."""
        headers = auth_headers("director-id")
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/members/staff-to-be-id/promote",
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["role"] == "staff"

    # ------------------------------------------------------------------ #
    #  PHASE 2 — Staff admin privileges
    # ------------------------------------------------------------------ #

    async def test_step_04_can_post_to_bulletin(self, client, auth_headers):
        """Staff can create bulletin posts."""
        headers = auth_headers("staff-to-be-id")
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/bulletin",
            json={"title": "Costume Update", "body": "Please bring dance shoes to tech week."},
            headers=headers,
        )
        assert response.status_code == 201
        self.__class__.staff_post_id = response.json()["id"]

    async def test_step_05_can_pin_post(self, client, auth_headers):
        """Staff can pin posts."""
        headers = auth_headers("staff-to-be-id")
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/bulletin/{self.__class__.staff_post_id}/pin",
            headers=headers,
        )
        assert response.status_code == 200

    async def test_step_06_can_edit_own_post(self, client, auth_headers):
        """Staff can edit their own posts."""
        headers = auth_headers("staff-to-be-id")
        response = await client.patch(
            f"/api/productions/{self.__class__.production_id}/bulletin/{self.__class__.staff_post_id}",
            json={"body": "Updated: bring dance shoes AND character shoes."},
            headers=headers,
        )
        assert response.status_code == 200

    async def test_step_07_cannot_edit_director_post(self, client, auth_headers):
        """Staff cannot edit Director's posts."""
        headers = auth_headers("staff-to-be-id")
        response = await client.patch(
            f"/api/productions/{self.__class__.production_id}/bulletin/director-post-id",
            json={"body": "Staff trying to edit director post"},
            headers=headers,
        )
        assert response.status_code == 403

    async def test_step_08_can_delete_own_post(self, client, auth_headers):
        """Staff can delete their own posts."""
        headers = auth_headers("staff-to-be-id")
        # Create a throwaway post to delete
        create_resp = await client.post(
            f"/api/productions/{self.__class__.production_id}/bulletin",
            json={"title": "Throwaway", "body": "Will delete"},
            headers=headers,
        )
        throwaway_id = create_resp.json()["id"]
        response = await client.delete(
            f"/api/productions/{self.__class__.production_id}/bulletin/{throwaway_id}",
            headers=headers,
        )
        assert response.status_code == 200

    async def test_step_09_cannot_delete_director_post(self, client, auth_headers):
        """Staff cannot delete Director's posts."""
        headers = auth_headers("staff-to-be-id")
        response = await client.delete(
            f"/api/productions/{self.__class__.production_id}/bulletin/director-post-id",
            headers=headers,
        )
        assert response.status_code == 403

    # ------------------------------------------------------------------ #
    #  PHASE 3 — Staff schedule & conflict access
    # ------------------------------------------------------------------ #

    async def test_step_10_can_edit_schedule(self, client, auth_headers):
        """Staff can edit schedule (same as Director for schedule ops)."""
        headers = auth_headers("staff-to-be-id")
        response = await client.patch(
            f"/api/productions/{self.__class__.production_id}/schedule/some-date-id",
            json={"note": "Staff added this note"},
            headers=headers,
        )
        assert response.status_code == 200

    async def test_step_11_can_view_all_conflicts(self, client, auth_headers):
        """Staff can see aggregated conflict data from all cast."""
        headers = auth_headers("staff-to-be-id")
        response = await client.get(
            f"/api/productions/{self.__class__.production_id}/conflicts",
            headers=headers,
        )
        assert response.status_code == 200

    # ------------------------------------------------------------------ #
    #  PHASE 4 — Staff chat privileges
    # ------------------------------------------------------------------ #

    async def test_step_12_can_message_cast(self, client, auth_headers):
        """Staff can message Cast members."""
        headers = auth_headers("staff-to-be-id")
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/messages",
            json={"recipient_id": "some-cast-id", "body": "Costume fitting tomorrow at 3pm"},
            headers=headers,
        )
        assert response.status_code == 201

    async def test_step_13_can_message_director(self, client, auth_headers):
        """Staff can message the Director."""
        headers = auth_headers("staff-to-be-id")
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/messages",
            json={"recipient_id": "director-id", "body": "Props are ready for tech week"},
            headers=headers,
        )
        assert response.status_code == 201

    async def test_step_14_contact_list_shows_all(self, client, auth_headers):
        """Staff sees Director + other Staff + all Cast in contacts."""
        headers = auth_headers("staff-to-be-id")
        response = await client.get(
            f"/api/productions/{self.__class__.production_id}/contacts",
            headers=headers,
        )
        assert response.status_code == 200

    async def test_step_15_cannot_delete_others_messages(self, client, auth_headers):
        """Staff CANNOT moderate/delete other users' messages (only Director can)."""
        headers = auth_headers("staff-to-be-id")
        response = await client.delete(
            f"/api/productions/{self.__class__.production_id}/messages/cast-message-id",
            headers=headers,
        )
        assert response.status_code == 403

    # ------------------------------------------------------------------ #
    #  PHASE 5 — Staff invite link access
    # ------------------------------------------------------------------ #

    async def test_step_16_can_generate_invite(self, client, auth_headers):
        """Staff can generate invite links."""
        headers = auth_headers("staff-to-be-id")
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/invite",
            headers=headers,
        )
        assert response.status_code == 201

    # ------------------------------------------------------------------ #
    #  PHASE 6 — Staff limitations
    # ------------------------------------------------------------------ #

    async def test_step_17_cannot_promote_members(self, client, auth_headers):
        """Staff cannot promote other cast to staff."""
        headers = auth_headers("staff-to-be-id")
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/members/other-cast-id/promote",
            headers=headers,
        )
        assert response.status_code == 403

    async def test_step_18_cannot_demote_members(self, client, auth_headers):
        """Staff cannot demote other staff to cast."""
        headers = auth_headers("staff-to-be-id")
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/members/other-staff-id/demote",
            headers=headers,
        )
        assert response.status_code == 403

    async def test_step_19_cannot_remove_members(self, client, auth_headers):
        """Staff cannot remove members from production."""
        headers = auth_headers("staff-to-be-id")
        response = await client.delete(
            f"/api/productions/{self.__class__.production_id}/members/some-cast-id",
            headers=headers,
        )
        assert response.status_code == 403

    async def test_step_20_cannot_delete_production(self, client, auth_headers):
        """Staff cannot delete the production."""
        headers = auth_headers("staff-to-be-id")
        response = await client.delete(
            f"/api/productions/{self.__class__.production_id}",
            headers=headers,
        )
        assert response.status_code == 403

    async def test_step_21_cannot_archive_production(self, client, auth_headers):
        """Staff cannot archive the production."""
        headers = auth_headers("staff-to-be-id")
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/archive",
            headers=headers,
        )
        assert response.status_code == 403

    async def test_step_22_cannot_remove_director(self, client, auth_headers):
        """Staff cannot remove the Director."""
        headers = auth_headers("staff-to-be-id")
        response = await client.delete(
            f"/api/productions/{self.__class__.production_id}/members/director-id",
            headers=headers,
        )
        assert response.status_code == 403

    async def test_step_23_cannot_reset_conflicts(self, client, auth_headers):
        """Staff cannot reset cast members' conflicts."""
        headers = auth_headers("staff-to-be-id")
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/members/some-cast-id/reset-conflicts",
            headers=headers,
        )
        assert response.status_code == 403

    # ------------------------------------------------------------------ #
    #  PHASE 7 — Demotion and loss of privileges
    # ------------------------------------------------------------------ #

    async def test_step_24_director_demotes_staff(self, client, auth_headers):
        """Director demotes this Staff member back to Cast."""
        headers = auth_headers("director-id")
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/members/staff-to-be-id/demote",
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["role"] == "cast"

    async def test_step_25_cannot_post_after_demotion(self, client, auth_headers):
        """Demoted user loses posting rights immediately."""
        headers = auth_headers("staff-to-be-id")
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/bulletin",
            json={"title": "After Demotion", "body": "Should fail"},
            headers=headers,
        )
        assert response.status_code == 403

    async def test_step_26_cannot_edit_own_post_after_demotion(self, client, auth_headers):
        """Demoted user can no longer edit their own previous posts."""
        headers = auth_headers("staff-to-be-id")
        response = await client.patch(
            f"/api/productions/{self.__class__.production_id}/bulletin/{self.__class__.staff_post_id}",
            json={"body": "Trying to edit after demotion"},
            headers=headers,
        )
        assert response.status_code == 403

    async def test_step_27_cannot_delete_own_post_after_demotion(self, client, auth_headers):
        """Demoted user can no longer delete their own previous posts."""
        headers = auth_headers("staff-to-be-id")
        response = await client.delete(
            f"/api/productions/{self.__class__.production_id}/bulletin/{self.__class__.staff_post_id}",
            headers=headers,
        )
        assert response.status_code == 403

    async def test_step_28_old_posts_still_visible(self, client, auth_headers):
        """Posts authored by demoted user remain visible."""
        headers = auth_headers("director-id")
        response = await client.get(
            f"/api/productions/{self.__class__.production_id}/bulletin",
            headers=headers,
        )
        posts = response.json()
        staff_posts = [p for p in posts if p.get("author_id") == "staff-to-be-id"]
        assert len(staff_posts) > 0  # Posts still exist

    async def test_step_29_cannot_message_cast_after_demotion(self, client, auth_headers):
        """Demoted to Cast — cannot message other Cast members."""
        headers = auth_headers("staff-to-be-id")
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/messages",
            json={"recipient_id": "some-cast-id", "body": "Can I still reach you?"},
            headers=headers,
        )
        assert response.status_code == 403

    async def test_step_30_loses_conflict_aggregate_view(self, client, auth_headers):
        """Demoted user only sees own conflicts, not aggregated view."""
        headers = auth_headers("staff-to-be-id")
        response = await client.get(
            f"/api/productions/{self.__class__.production_id}/conflicts",
            headers=headers,
        )
        assert response.status_code == 200
        # Should only return own conflicts, not everyone's
        data = response.json()
        for entry in data:
            if "user_id" in entry:
                assert entry["user_id"] == "staff-to-be-id"

    async def test_step_31_cannot_edit_schedule_after_demotion(self, client, auth_headers):
        """Demoted user loses schedule editing rights."""
        headers = auth_headers("staff-to-be-id")
        response = await client.patch(
            f"/api/productions/{self.__class__.production_id}/schedule/some-date-id",
            json={"note": "Should fail"},
            headers=headers,
        )
        assert response.status_code == 403

    async def test_step_32_cannot_generate_invite_after_demotion(self, client, auth_headers):
        """Demoted user cannot generate invite links."""
        headers = auth_headers("staff-to-be-id")
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/invite",
            headers=headers,
        )
        assert response.status_code == 403
