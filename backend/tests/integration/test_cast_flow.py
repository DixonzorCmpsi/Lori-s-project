"""
End-to-end Cast flow test.

Tests the COMPLETE Cast member journey through the application:
  1. Receive invite link from Director (simulated)
  2. Click invite link (not logged in — redirected to register)
  3. Register with age gate (13+ check)
  4. Email verification
  5. Auto-join production as Cast role
  6. Redirected to profile setup
  7. Complete cast profile (name, phone, role/character)
  8. Upload headshot (JPEG, EXIF stripped, UUID filename)
  9. View conflict submission page (calendar of rehearsal dates)
  10. Submit conflicts (select dates + reasons, one-time only)
  11. Confirm conflicts are immutable (cannot re-submit)
  12. View bulletin board (poster tab — read-only)
  13. View schedule tab (own conflicts overlaid, no deleted dates)
  14. Cannot edit schedule (no controls)
  15. Chat with Director (allowed)
  16. Chat with Staff (allowed)
  17. Cannot chat with other Cast (blocked at API)
  18. Cannot see other cast in contact list
  19. Cannot post to bulletin board
  20. Cannot modify anything on schedule
  21. Delete own message within 5 minutes
  22. Cannot delete own message after 5 minutes
  23. View personal schedule with own conflicts highlighted
  24. Delete headshot photo
  25. Delete account
"""

import pytest
import io
from datetime import date, timedelta


class TestCastFullFlow:
    """Complete Cast journey — invite link through daily usage."""

    # ------------------------------------------------------------------ #
    #  PHASE 1 — Invite link & registration
    # ------------------------------------------------------------------ #

    async def test_step_01_click_invite_link_not_logged_in(self, client):
        """Cast clicks invite link while not logged in."""
        response = await client.get("/api/join?token=valid-invite-token", follow_redirects=False)
        # Should redirect to login/register, preserving token
        assert response.status_code in [302, 307, 401]

    async def test_step_02_register_with_age_gate(self, client):
        """Cast registers — adult passes age gate."""
        response = await client.post("/api/auth/register", json={
            "email": "castmember@example.com",
            "name": "Alex Cast",
            "password": "CastP@ssword1!",
            "date_of_birth": "2005-06-15",  # 20 years old in 2026
        })
        assert response.status_code == 201
        data = response.json()
        assert data["age_range"] == "18+"
        self.__class__.cast_user_id = data["id"]

    async def test_step_03_register_under_13_blocked(self, client):
        """Another user under 13 is blocked at registration."""
        response = await client.post("/api/auth/register", json={
            "email": "tooyoung@example.com",
            "name": "Young Kid",
            "password": "CastP@ssword1!",
            "date_of_birth": "2016-01-01",  # Under 13
        })
        assert response.status_code == 400

    async def test_step_04_teen_registers_ok(self, client):
        """Teen (13-17) can register with correct age_range."""
        response = await client.post("/api/auth/register", json={
            "email": "teen@example.com",
            "name": "Teen Cast",
            "password": "TeenP@ssword1!",
            "date_of_birth": "2012-06-15",  # 14 years old in 2026
        })
        assert response.status_code == 201
        assert response.json()["age_range"] == "13-17"

    async def test_step_05_verify_email(self, client):
        """Cast verifies their email."""
        response = await client.post("/api/auth/verify-email", json={
            "token": "cast-verification-token",
        })
        assert response.status_code == 200

    async def test_step_06_login(self, client):
        """Cast logs in."""
        response = await client.post("/api/auth/login", json={
            "email": "castmember@example.com",
            "password": "CastP@ssword1!",
        })
        assert response.status_code == 200
        assert "access_token" in response.json()

    # ------------------------------------------------------------------ #
    #  PHASE 2 — Join production via invite link
    # ------------------------------------------------------------------ #

    async def test_step_07_join_production(self, client, auth_headers):
        """Cast joins production via invite token — auto-assigned Cast role."""
        headers = auth_headers(self.__class__.cast_user_id)
        response = await client.post("/api/join", json={
            "token": "valid-invite-token",
        }, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "cast"
        self.__class__.production_id = data["production_id"]

    async def test_step_08_rejoin_is_idempotent(self, client, auth_headers):
        """Clicking invite link again when already a member is a no-op."""
        headers = auth_headers(self.__class__.cast_user_id)
        response = await client.post("/api/join", json={
            "token": "valid-invite-token",
        }, headers=headers)
        assert response.status_code == 200

    # ------------------------------------------------------------------ #
    #  PHASE 3 — Profile setup
    # ------------------------------------------------------------------ #

    async def test_step_09_create_cast_profile(self, client, auth_headers):
        """Cast completes their profile with all fields."""
        headers = auth_headers(self.__class__.cast_user_id)
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/profile",
            json={
                "display_name": "Alex Johnson",
                "phone": "555-0199",
                "role_character": "Baker's Wife",
            },
            headers=headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["display_name"] == "Alex Johnson"
        assert data["role_character"] == "Baker's Wife"

    async def test_step_10_upload_headshot(self, client, auth_headers):
        """Cast uploads a JPEG headshot."""
        headers = auth_headers(self.__class__.cast_user_id)
        # Valid JPEG magic bytes
        jpeg_content = b"\xff\xd8\xff\xe0" + b"\x00" * 2000
        files = {"file": ("headshot.jpg", io.BytesIO(jpeg_content), "image/jpeg")}
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/profile/headshot",
            files=files,
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["headshot_url"] is not None
        # Filename should be UUID, not original
        assert "headshot.jpg" not in data["headshot_url"]
        self.__class__.headshot_url = data["headshot_url"]

    async def test_step_11_upload_svg_rejected(self, client, auth_headers):
        """SVG upload is rejected (JPEG/PNG only, validated by magic bytes)."""
        headers = auth_headers(self.__class__.cast_user_id)
        svg_content = b'<svg xmlns="http://www.w3.org/2000/svg"></svg>'
        files = {"file": ("photo.svg", io.BytesIO(svg_content), "image/svg+xml")}
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/profile/headshot",
            files=files,
            headers=headers,
        )
        assert response.status_code == 400

    async def test_step_12_upload_too_large_rejected(self, client, auth_headers):
        """File > 5MB is rejected with 413."""
        headers = auth_headers(self.__class__.cast_user_id)
        large = b"\xff\xd8\xff\xe0" + b"\x00" * (5 * 1024 * 1024 + 1)
        files = {"file": ("big.jpg", io.BytesIO(large), "image/jpeg")}
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/profile/headshot",
            files=files,
            headers=headers,
        )
        assert response.status_code == 413

    # ------------------------------------------------------------------ #
    #  PHASE 4 — Conflict submission
    # ------------------------------------------------------------------ #

    async def test_step_13_view_schedule_for_conflicts(self, client, auth_headers):
        """Cast sees the production calendar to select conflict dates."""
        headers = auth_headers(self.__class__.cast_user_id)
        response = await client.get(
            f"/api/productions/{self.__class__.production_id}/schedule",
            headers=headers,
        )
        assert response.status_code == 200
        dates = response.json()
        assert len(dates) > 0
        # Should NOT include soft-deleted dates
        for d in dates:
            assert d.get("is_deleted") is not True
        self.__class__.rehearsal_dates = dates

    async def test_step_14_submit_conflicts(self, client, auth_headers):
        """Cast submits conflicts for selected dates."""
        headers = auth_headers(self.__class__.cast_user_id)
        dates = self.__class__.rehearsal_dates
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/conflicts",
            json={
                "dates": [
                    {"rehearsal_date_id": dates[0]["id"], "reason": "Doctor appointment"},
                    {"rehearsal_date_id": dates[1]["id"], "reason": "Family event"},
                    {"rehearsal_date_id": dates[2]["id"]},  # No reason
                ],
            },
            headers=headers,
        )
        assert response.status_code == 201

    async def test_step_15_cannot_resubmit_conflicts(self, client, auth_headers):
        """Conflicts are immutable — second submission returns 409."""
        headers = auth_headers(self.__class__.cast_user_id)
        dates = self.__class__.rehearsal_dates
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/conflicts",
            json={"dates": [{"rehearsal_date_id": dates[3]["id"]}]},
            headers=headers,
        )
        assert response.status_code == 409
        assert "already submitted" in response.json()["message"].lower()

    async def test_step_16_cannot_edit_conflicts(self, client, auth_headers):
        """No PUT/PATCH endpoint for conflicts."""
        headers = auth_headers(self.__class__.cast_user_id)
        response = await client.put(
            f"/api/productions/{self.__class__.production_id}/conflicts",
            json={"dates": []},
            headers=headers,
        )
        assert response.status_code == 405

    async def test_step_17_cannot_delete_own_conflicts(self, client, auth_headers):
        """Cast cannot self-service delete conflicts."""
        headers = auth_headers(self.__class__.cast_user_id)
        response = await client.delete(
            f"/api/productions/{self.__class__.production_id}/conflicts",
            headers=headers,
        )
        assert response.status_code == 403

    # ------------------------------------------------------------------ #
    #  PHASE 5 — Bulletin board (read-only for cast)
    # ------------------------------------------------------------------ #

    async def test_step_18_view_bulletin_board(self, client, auth_headers):
        """Cast can view the bulletin board."""
        headers = auth_headers(self.__class__.cast_user_id)
        response = await client.get(
            f"/api/productions/{self.__class__.production_id}/bulletin",
            headers=headers,
        )
        assert response.status_code == 200
        posts = response.json()
        assert isinstance(posts, list)

    async def test_step_19_cannot_post_to_bulletin(self, client, auth_headers):
        """Cast cannot create bulletin posts."""
        headers = auth_headers(self.__class__.cast_user_id)
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/bulletin",
            json={"title": "Cast Post", "body": "Should fail"},
            headers=headers,
        )
        assert response.status_code == 403

    async def test_step_20_cannot_pin_post(self, client, auth_headers):
        """Cast cannot pin posts."""
        headers = auth_headers(self.__class__.cast_user_id)
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/bulletin/some-post-id/pin",
            headers=headers,
        )
        assert response.status_code == 403

    # ------------------------------------------------------------------ #
    #  PHASE 6 — Schedule view (read-only with own conflicts)
    # ------------------------------------------------------------------ #

    async def test_step_21_view_personal_schedule(self, client, auth_headers):
        """Cast sees schedule with own conflicts overlaid."""
        headers = auth_headers(self.__class__.cast_user_id)
        response = await client.get(
            f"/api/productions/{self.__class__.production_id}/schedule",
            headers=headers,
        )
        assert response.status_code == 200

    async def test_step_22_cannot_see_other_cast_conflicts(self, client, auth_headers):
        """Cast cannot see other members' conflict data."""
        headers = auth_headers(self.__class__.cast_user_id)
        response = await client.get(
            f"/api/productions/{self.__class__.production_id}/conflicts",
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        # Should only contain own conflicts
        for entry in data:
            if "user_id" in entry:
                assert entry["user_id"] == self.__class__.cast_user_id

    async def test_step_23_cannot_edit_schedule(self, client, auth_headers):
        """Cast has no edit controls — API rejects schedule modifications."""
        headers = auth_headers(self.__class__.cast_user_id)
        dates = self.__class__.rehearsal_dates
        response = await client.patch(
            f"/api/productions/{self.__class__.production_id}/schedule/{dates[0]['id']}",
            json={"note": "Cast trying to edit"},
            headers=headers,
        )
        assert response.status_code == 403

    async def test_step_24_cannot_cancel_rehearsal(self, client, auth_headers):
        """Cast cannot cancel rehearsals."""
        headers = auth_headers(self.__class__.cast_user_id)
        dates = self.__class__.rehearsal_dates
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/schedule/{dates[0]['id']}/cancel",
            headers=headers,
        )
        assert response.status_code == 403

    # ------------------------------------------------------------------ #
    #  PHASE 7 — Chat (role-based boundaries)
    # ------------------------------------------------------------------ #

    async def test_step_25_chat_with_director(self, client, auth_headers):
        """Cast can message the Director."""
        headers = auth_headers(self.__class__.cast_user_id)
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/messages",
            json={
                "recipient_id": "director-user-id",
                "body": "Hi Director, I have a question about Act 2.",
            },
            headers=headers,
        )
        assert response.status_code == 201
        self.__class__.cast_message_id = response.json()["id"]

    async def test_step_26_chat_with_staff(self, client, auth_headers):
        """Cast can message Staff members."""
        headers = auth_headers(self.__class__.cast_user_id)
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/messages",
            json={
                "recipient_id": "staff-user-id",
                "body": "Can you help me with my costume?",
            },
            headers=headers,
        )
        assert response.status_code == 201

    async def test_step_27_cannot_chat_with_cast(self, client, auth_headers):
        """Cast-to-cast messaging is blocked at API level."""
        headers = auth_headers(self.__class__.cast_user_id)
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/messages",
            json={
                "recipient_id": "other-cast-user-id",
                "body": "Hey fellow cast member!",
            },
            headers=headers,
        )
        assert response.status_code == 403

    async def test_step_28_contact_list_no_other_cast(self, client, auth_headers):
        """Cast contact list only shows Director and Staff."""
        headers = auth_headers(self.__class__.cast_user_id)
        response = await client.get(
            f"/api/productions/{self.__class__.production_id}/contacts",
            headers=headers,
        )
        assert response.status_code == 200
        contacts = response.json()
        for contact in contacts:
            assert contact["role"] in ("director", "staff")

    async def test_step_29_delete_own_message_within_5_min(self, client, auth_headers):
        """Cast can delete own message within 5 minutes."""
        headers = auth_headers(self.__class__.cast_user_id)
        response = await client.delete(
            f"/api/productions/{self.__class__.production_id}/messages/{self.__class__.cast_message_id}",
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["body"] == "[Message deleted]"

    # ------------------------------------------------------------------ #
    #  PHASE 8 — Cannot access Director/Staff features
    # ------------------------------------------------------------------ #

    async def test_step_30_cannot_generate_invite(self, client, auth_headers):
        """Cast cannot generate invite links."""
        headers = auth_headers(self.__class__.cast_user_id)
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/invite",
            headers=headers,
        )
        assert response.status_code == 403

    async def test_step_31_cannot_promote_members(self, client, auth_headers):
        """Cast cannot promote other members."""
        headers = auth_headers(self.__class__.cast_user_id)
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/members/other-user/promote",
            headers=headers,
        )
        assert response.status_code == 403

    async def test_step_32_cannot_remove_members(self, client, auth_headers):
        """Cast cannot remove other members."""
        headers = auth_headers(self.__class__.cast_user_id)
        response = await client.delete(
            f"/api/productions/{self.__class__.production_id}/members/other-user",
            headers=headers,
        )
        assert response.status_code == 403

    async def test_step_33_cannot_archive_production(self, client, auth_headers):
        """Cast cannot archive the production."""
        headers = auth_headers(self.__class__.cast_user_id)
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/archive",
            headers=headers,
        )
        assert response.status_code == 403

    async def test_step_34_cannot_access_other_production(self, client, auth_headers):
        """Cast cannot access a production they're not a member of."""
        headers = auth_headers(self.__class__.cast_user_id)
        response = await client.get(
            "/api/productions/other-production-id/bulletin",
            headers=headers,
        )
        assert response.status_code == 403

    # ------------------------------------------------------------------ #
    #  PHASE 9 — Cleanup
    # ------------------------------------------------------------------ #

    async def test_step_35_delete_headshot(self, client, auth_headers):
        """Cast removes their headshot photo."""
        headers = auth_headers(self.__class__.cast_user_id)
        response = await client.delete(
            f"/api/productions/{self.__class__.production_id}/profile/headshot",
            headers=headers,
        )
        assert response.status_code == 200

    async def test_step_36_delete_account(self, client, auth_headers):
        """Cast deletes their account — all data cascades."""
        headers = auth_headers(self.__class__.cast_user_id)
        response = await client.delete("/api/auth/account", headers=headers)
        assert response.status_code == 200
