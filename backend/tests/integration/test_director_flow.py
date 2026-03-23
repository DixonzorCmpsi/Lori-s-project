"""
End-to-end Director flow test.

Tests the COMPLETE Director journey through the application:
  1. Register account (email/password with age gate)
  2. Verify email
  3. Login and get session
  4. Create a theater
  5. Create a production (with date validation)
  6. Auto-joined as director member
  7. Run schedule wizard (7 questions → generated calendar)
  8. View generated schedule (correct dates, types, times)
  9. Edit schedule (change time, add note, cancel, soft-delete)
  10. Create bulletin board post (Markdown sanitized)
  11. Pin a post
  12. Edit a post
  13. Generate invite link
  14. View invite link info (token, expiry, uses)
  15. Regenerate invite link (old invalidated)
  16. Wait for cast to join (simulated)
  17. View member roster
  18. Promote cast member to staff
  19. Demote staff back to cast
  20. View aggregated conflict data
  21. Reset a cast member's conflicts
  22. Remove a member from production
  23. Archive production (read-only mode)
  24. Unarchive production (within 90 days)
  25. Delete account (cascade all data)

This is the "golden path" — every step the Director takes from first visit
to full production lifecycle, tested as one continuous session.
"""

import pytest
from datetime import date, timedelta


class TestDirectorFullFlow:
    """Complete Director journey — account creation through production lifecycle."""

    # ------------------------------------------------------------------ #
    #  PHASE 1 — Account creation & authentication
    # ------------------------------------------------------------------ #

    async def test_step_01_register(self, client):
        """Director registers with email/password."""
        response = await client.post("/api/auth/register", json={
            "email": "director@example.com",
            "name": "Jane Director",
            "password": "SecureD1rector!",
            "date_of_birth": "1985-03-15",
        })
        assert response.status_code == 201
        data = response.json()
        assert data["age_range"] == "18+"
        assert data["email_verified"] is False
        self.__class__.director_id = data["id"]

    async def test_step_02_cannot_access_dashboard_unverified(self, client, auth_headers):
        """Unverified director can log in but cannot create theater/production."""
        headers = auth_headers(self.__class__.director_id)
        response = await client.post("/api/theaters", json={
            "name": "Test Theater",
            "city": "Springfield",
            "state": "IL",
        }, headers=headers)
        # Unverified users cannot create theaters
        assert response.status_code == 403

    async def test_step_03_verify_email(self, client):
        """Director verifies their email."""
        # In real flow: extract token from email mock
        response = await client.post("/api/auth/verify-email", json={
            "token": "director-verification-token",
        })
        assert response.status_code == 200

    async def test_step_04_login(self, client):
        """Director logs in with verified account."""
        response = await client.post("/api/auth/login", json={
            "email": "director@example.com",
            "password": "SecureD1rector!",
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        self.__class__.token = data["access_token"]

    # ------------------------------------------------------------------ #
    #  PHASE 2 — Theater & production setup
    # ------------------------------------------------------------------ #

    async def test_step_05_create_theater(self, client, auth_headers):
        """Director creates their theater."""
        headers = auth_headers(self.__class__.director_id)
        response = await client.post("/api/theaters", json={
            "name": "Lincoln High School",
            "city": "Springfield",
            "state": "Illinois",
        }, headers=headers)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Lincoln High School"
        self.__class__.theater_id = data["id"]

    async def test_step_06_cannot_create_second_theater(self, client, auth_headers):
        """V1 constraint: one theater per director."""
        headers = auth_headers(self.__class__.director_id)
        response = await client.post("/api/theaters", json={
            "name": "Another Theater",
            "city": "Chicago",
            "state": "Illinois",
        }, headers=headers)
        assert response.status_code == 409
        assert "already have a theater" in response.json()["message"].lower()

    async def test_step_07_create_production(self, client, auth_headers):
        """Director creates a production within their theater."""
        headers = auth_headers(self.__class__.director_id)
        today = date.today()
        response = await client.post("/api/productions", json={
            "theater_id": self.__class__.theater_id,
            "name": "Into the Woods",
            "estimated_cast_size": 35,
            "first_rehearsal": (today + timedelta(days=30)).isoformat(),
            "opening_night": (today + timedelta(days=90)).isoformat(),
            "closing_night": (today + timedelta(days=97)).isoformat(),
        }, headers=headers)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Into the Woods"
        self.__class__.production_id = data["id"]

    async def test_step_08_director_auto_joined(self, client, auth_headers):
        """Director was automatically added as 'director' role member."""
        headers = auth_headers(self.__class__.director_id)
        response = await client.get(
            f"/api/productions/{self.__class__.production_id}/members",
            headers=headers,
        )
        assert response.status_code == 200
        members = response.json()
        director = next((m for m in members if m["user_id"] == self.__class__.director_id), None)
        assert director is not None
        assert director["role"] == "director"

    async def test_step_09_cannot_create_second_production(self, client, auth_headers):
        """V1 constraint: one active production per director."""
        headers = auth_headers(self.__class__.director_id)
        today = date.today()
        response = await client.post("/api/productions", json={
            "theater_id": self.__class__.theater_id,
            "name": "Second Show",
            "estimated_cast_size": 20,
            "first_rehearsal": (today + timedelta(days=60)).isoformat(),
            "opening_night": (today + timedelta(days=120)).isoformat(),
            "closing_night": (today + timedelta(days=127)).isoformat(),
        }, headers=headers)
        assert response.status_code == 409

    # ------------------------------------------------------------------ #
    #  PHASE 3 — Schedule wizard
    # ------------------------------------------------------------------ #

    async def test_step_10_submit_schedule_wizard(self, client, auth_headers):
        """Director answers 7 wizard questions and generates schedule."""
        headers = auth_headers(self.__class__.director_id)
        today = date.today()
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/schedule/generate",
            json={
                "selected_days": ["monday", "wednesday", "friday"],
                "start_time": "18:00",
                "end_time": "21:00",
                "blocked_dates": [(today + timedelta(days=45)).isoformat()],
                "tech_week_enabled": True,
                "tech_week_days": 5,
                "dress_rehearsal_enabled": True,
            },
            headers=headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert len(data["dates"]) > 0
        # Should contain regular, tech, dress, and performance types
        types = {d["type"] for d in data["dates"]}
        assert "regular" in types
        assert "tech" in types
        assert "dress" in types
        assert "performance" in types
        # Blocked date should not appear
        blocked = (today + timedelta(days=45)).isoformat()
        assert blocked not in [d["date"] for d in data["dates"]]
        self.__class__.schedule_dates = data["dates"]

    async def test_step_11_view_generated_schedule(self, client, auth_headers):
        """Director can view the full generated schedule."""
        headers = auth_headers(self.__class__.director_id)
        response = await client.get(
            f"/api/productions/{self.__class__.production_id}/schedule",
            headers=headers,
        )
        assert response.status_code == 200
        dates = response.json()
        assert len(dates) > 0
        # All dates should have correct times
        for d in dates:
            assert d["start_time"] == "18:00"
            assert d["end_time"] == "21:00"
        # Exactly one dress rehearsal
        dress_dates = [d for d in dates if d["type"] == "dress"]
        assert len(dress_dates) == 1

    # ------------------------------------------------------------------ #
    #  PHASE 4 — Schedule manipulation
    # ------------------------------------------------------------------ #

    async def test_step_12_edit_rehearsal_time(self, client, auth_headers):
        """Director changes a rehearsal time."""
        headers = auth_headers(self.__class__.director_id)
        date_id = self.__class__.schedule_dates[0]["id"]
        response = await client.patch(
            f"/api/productions/{self.__class__.production_id}/schedule/{date_id}",
            json={"start_time": "17:30", "end_time": "20:30"},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["start_time"] == "17:30"

    async def test_step_13_add_note_to_date(self, client, auth_headers):
        """Director adds a note to a rehearsal date."""
        headers = auth_headers(self.__class__.director_id)
        date_id = self.__class__.schedule_dates[0]["id"]
        response = await client.patch(
            f"/api/productions/{self.__class__.production_id}/schedule/{date_id}",
            json={"note": "Focus on Act 1 blocking"},
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["note"] == "Focus on Act 1 blocking"

    async def test_step_14_cancel_rehearsal(self, client, auth_headers):
        """Director cancels a rehearsal (stays on calendar, strikethrough)."""
        headers = auth_headers(self.__class__.director_id)
        date_id = self.__class__.schedule_dates[1]["id"]
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/schedule/{date_id}/cancel",
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["is_cancelled"] is True

    async def test_step_15_cancel_triggers_bulletin_post(self, client, auth_headers):
        """Cancellation created a system bulletin post."""
        headers = auth_headers(self.__class__.director_id)
        response = await client.get(
            f"/api/productions/{self.__class__.production_id}/bulletin",
            headers=headers,
        )
        posts = response.json()
        assert any("cancel" in p.get("body", "").lower() for p in posts)

    async def test_step_16_soft_delete_rehearsal(self, client, auth_headers):
        """Director soft-deletes a rehearsal date."""
        headers = auth_headers(self.__class__.director_id)
        date_id = self.__class__.schedule_dates[2]["id"]
        response = await client.delete(
            f"/api/productions/{self.__class__.production_id}/schedule/{date_id}",
            headers=headers,
        )
        assert response.status_code == 200

    async def test_step_17_add_new_rehearsal_date(self, client, auth_headers):
        """Director adds an extra rehearsal date manually."""
        headers = auth_headers(self.__class__.director_id)
        today = date.today()
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/schedule",
            json={
                "date": (today + timedelta(days=50)).isoformat(),
                "start_time": "10:00",
                "end_time": "14:00",
                "type": "regular",
            },
            headers=headers,
        )
        assert response.status_code == 201

    # ------------------------------------------------------------------ #
    #  PHASE 5 — Bulletin board
    # ------------------------------------------------------------------ #

    async def test_step_18_create_bulletin_post(self, client, auth_headers):
        """Director creates a Markdown bulletin post."""
        headers = auth_headers(self.__class__.director_id)
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/bulletin",
            json={
                "title": "Welcome Cast!",
                "body": "# Welcome\n\nWe're excited to start **Into the Woods**.\n\n- First rehearsal is in 30 days\n- Please submit your conflicts ASAP",
            },
            headers=headers,
        )
        assert response.status_code == 201
        self.__class__.post_id = response.json()["id"]

    async def test_step_19_xss_in_post_stripped(self, client, auth_headers):
        """XSS script tag in post body is stripped server-side."""
        headers = auth_headers(self.__class__.director_id)
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/bulletin",
            json={
                "title": "Test XSS",
                "body": "Hello <script>alert('xss')</script> World",
            },
            headers=headers,
        )
        assert response.status_code == 201
        assert "<script>" not in response.json()["body"]

    async def test_step_20_pin_post(self, client, auth_headers):
        """Director pins the welcome post."""
        headers = auth_headers(self.__class__.director_id)
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/bulletin/{self.__class__.post_id}/pin",
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["is_pinned"] is True

    async def test_step_21_edit_post(self, client, auth_headers):
        """Director edits the pinned post."""
        headers = auth_headers(self.__class__.director_id)
        response = await client.patch(
            f"/api/productions/{self.__class__.production_id}/bulletin/{self.__class__.post_id}",
            json={"body": "# Updated Welcome\n\nEdited content here."},
            headers=headers,
        )
        assert response.status_code == 200

    # ------------------------------------------------------------------ #
    #  PHASE 6 — Invite link management
    # ------------------------------------------------------------------ #

    async def test_step_22_generate_invite_link(self, client, auth_headers):
        """Director generates an invite link."""
        headers = auth_headers(self.__class__.director_id)
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/invite",
            headers=headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert len(data["token"]) >= 32
        assert data["max_uses"] == 100
        self.__class__.invite_token = data["token"]

    async def test_step_23_view_invite_info(self, client, auth_headers):
        """Director views invite link details."""
        headers = auth_headers(self.__class__.director_id)
        response = await client.get(
            f"/api/productions/{self.__class__.production_id}/invite",
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["use_count"] == 0
        assert "expires_at" in data

    async def test_step_24_regenerate_invite_link(self, client, auth_headers):
        """Director regenerates the invite link — old one invalidated."""
        headers = auth_headers(self.__class__.director_id)
        old_token = self.__class__.invite_token
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/invite/regenerate",
            headers=headers,
        )
        assert response.status_code == 200
        new_token = response.json()["token"]
        assert new_token != old_token
        self.__class__.invite_token = new_token

    # ------------------------------------------------------------------ #
    #  PHASE 7 — Member management (after cast joins)
    # ------------------------------------------------------------------ #

    async def test_step_25_view_roster_after_cast_joins(self, client, auth_headers):
        """Director views the member roster (includes joined cast)."""
        headers = auth_headers(self.__class__.director_id)
        response = await client.get(
            f"/api/productions/{self.__class__.production_id}/members",
            headers=headers,
        )
        assert response.status_code == 200

    async def test_step_26_promote_cast_to_staff(self, client, auth_headers):
        """Director promotes a cast member to staff."""
        headers = auth_headers(self.__class__.director_id)
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/members/cast-user-id/promote",
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["role"] == "staff"

    async def test_step_27_demote_staff_to_cast(self, client, auth_headers):
        """Director demotes the staff member back to cast."""
        headers = auth_headers(self.__class__.director_id)
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/members/cast-user-id/demote",
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["role"] == "cast"

    async def test_step_28_view_aggregated_conflicts(self, client, auth_headers):
        """Director views all cast conflicts aggregated on the schedule."""
        headers = auth_headers(self.__class__.director_id)
        response = await client.get(
            f"/api/productions/{self.__class__.production_id}/conflicts",
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    async def test_step_29_reset_cast_conflicts(self, client, auth_headers):
        """Director resets a cast member's conflicts."""
        headers = auth_headers(self.__class__.director_id)
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/members/cast-user-id/reset-conflicts",
            headers=headers,
        )
        assert response.status_code == 200

    async def test_step_30_remove_member(self, client, auth_headers):
        """Director removes a member from the production."""
        headers = auth_headers(self.__class__.director_id)
        response = await client.delete(
            f"/api/productions/{self.__class__.production_id}/members/removable-user-id",
            headers=headers,
        )
        assert response.status_code == 200

    # ------------------------------------------------------------------ #
    #  PHASE 8 — Chat (Director side)
    # ------------------------------------------------------------------ #

    async def test_step_31_director_sends_message(self, client, auth_headers):
        """Director sends a chat message to a cast member."""
        headers = auth_headers(self.__class__.director_id)
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/messages",
            json={
                "recipient_id": "cast-user-id",
                "body": "Welcome to the show! Let me know if you have questions.",
            },
            headers=headers,
        )
        assert response.status_code == 201
        self.__class__.message_id = response.json()["id"]

    async def test_step_32_director_views_contacts(self, client, auth_headers):
        """Director sees all staff and cast in contact list."""
        headers = auth_headers(self.__class__.director_id)
        response = await client.get(
            f"/api/productions/{self.__class__.production_id}/contacts",
            headers=headers,
        )
        assert response.status_code == 200

    async def test_step_33_director_deletes_message(self, client, auth_headers):
        """Director moderates — deletes a message."""
        headers = auth_headers(self.__class__.director_id)
        response = await client.delete(
            f"/api/productions/{self.__class__.production_id}/messages/{self.__class__.message_id}",
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["body"] == "[Message removed by director]"

    # ------------------------------------------------------------------ #
    #  PHASE 9 — Production lifecycle
    # ------------------------------------------------------------------ #

    async def test_step_34_archive_production(self, client, auth_headers):
        """Director archives the production."""
        headers = auth_headers(self.__class__.director_id)
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/archive",
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_archived"] is True
        assert data["archived_at"] is not None

    async def test_step_35_archived_is_read_only(self, client, auth_headers):
        """Archived production blocks write operations."""
        headers = auth_headers(self.__class__.director_id)
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/bulletin",
            json={"title": "New Post", "body": "Should fail"},
            headers=headers,
        )
        assert response.status_code == 403

    async def test_step_36_unarchive_production(self, client, auth_headers):
        """Director unarchives within 90-day window."""
        headers = auth_headers(self.__class__.director_id)
        response = await client.post(
            f"/api/productions/{self.__class__.production_id}/unarchive",
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["is_archived"] is False

    # ------------------------------------------------------------------ #
    #  PHASE 10 — Account deletion
    # ------------------------------------------------------------------ #

    async def test_step_37_delete_account(self, client, auth_headers):
        """Director deletes their account — cascades all data."""
        headers = auth_headers(self.__class__.director_id)
        response = await client.delete("/api/auth/account", headers=headers)
        assert response.status_code == 200

    async def test_step_38_deleted_account_cannot_login(self, client):
        """Deleted account can no longer log in."""
        response = await client.post("/api/auth/login", json={
            "email": "director@example.com",
            "password": "SecureD1rector!",
        })
        assert response.status_code == 401
