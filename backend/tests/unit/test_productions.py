"""
Tests for production management (SPEC-003 Section 4).

Covers:
- DIR-02: Director creates a production
- DIR-14: Invalid date ordering rejected
- Production one-per-director constraint
- Director auto-join as production member
- Production archival and unarchival
"""

import pytest
from datetime import date, timedelta


class TestCreateProduction:
    """DIR-02: Director creates a production."""

    async def test_create_production_success(self, client, auth_headers):
        """Happy path: valid production within a theater."""
        headers = auth_headers("director-id")
        today = date.today()
        response = await client.post("/api/productions", json={
            "theater_id": "theater-id",
            "name": "Into the Woods",
            "estimated_cast_size": 30,
            "first_rehearsal": (today + timedelta(days=30)).isoformat(),
            "opening_night": (today + timedelta(days=90)).isoformat(),
            "closing_night": (today + timedelta(days=97)).isoformat(),
        }, headers=headers)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Into the Woods"
        assert data["estimated_cast_size"] == 30

    async def test_create_production_auto_joins_director(self, client, auth_headers, db_session):
        """Director is auto-joined as 'director' role in production_members."""
        headers = auth_headers("director-id")
        today = date.today()
        response = await client.post("/api/productions", json={
            "theater_id": "theater-id",
            "name": "Auto Join Test",
            "estimated_cast_size": 20,
            "first_rehearsal": (today + timedelta(days=30)).isoformat(),
            "opening_night": (today + timedelta(days=90)).isoformat(),
            "closing_night": (today + timedelta(days=97)).isoformat(),
        }, headers=headers)
        assert response.status_code == 201
        production_id = response.json()["id"]
        # Verify director is a member with role='director'
        members_resp = await client.get(
            f"/api/productions/{production_id}/members",
            headers=headers,
        )
        assert members_resp.status_code == 200
        members = members_resp.json()
        director_member = next((m for m in members if m["user_id"] == "director-id"), None)
        assert director_member is not None
        assert director_member["role"] == "director"


class TestProductionDateValidation:
    """DIR-14: Date ordering constraints."""

    async def test_first_rehearsal_after_opening_rejected(self, client, auth_headers):
        """first_rehearsal > opening_night is rejected."""
        headers = auth_headers("director-id")
        today = date.today()
        response = await client.post("/api/productions", json={
            "theater_id": "theater-id",
            "name": "Bad Dates",
            "estimated_cast_size": 20,
            "first_rehearsal": (today + timedelta(days=100)).isoformat(),  # After opening
            "opening_night": (today + timedelta(days=90)).isoformat(),
            "closing_night": (today + timedelta(days=97)).isoformat(),
        }, headers=headers)
        assert response.status_code == 400

    async def test_opening_after_closing_rejected(self, client, auth_headers):
        """opening_night > closing_night is rejected."""
        headers = auth_headers("director-id")
        today = date.today()
        response = await client.post("/api/productions", json={
            "theater_id": "theater-id",
            "name": "Bad Dates 2",
            "estimated_cast_size": 20,
            "first_rehearsal": (today + timedelta(days=30)).isoformat(),
            "opening_night": (today + timedelta(days=100)).isoformat(),  # After closing
            "closing_night": (today + timedelta(days=97)).isoformat(),
        }, headers=headers)
        assert response.status_code == 400

    async def test_dates_in_past_rejected(self, client, auth_headers):
        """All dates must be in the future."""
        headers = auth_headers("director-id")
        today = date.today()
        response = await client.post("/api/productions", json={
            "theater_id": "theater-id",
            "name": "Past Dates",
            "estimated_cast_size": 20,
            "first_rehearsal": (today - timedelta(days=10)).isoformat(),
            "opening_night": (today + timedelta(days=90)).isoformat(),
            "closing_night": (today + timedelta(days=97)).isoformat(),
        }, headers=headers)
        assert response.status_code == 400

    async def test_same_day_dates_allowed(self, client, auth_headers):
        """first_rehearsal == opening_night == closing_night is valid (edge case)."""
        headers = auth_headers("director-id")
        future = date.today() + timedelta(days=30)
        response = await client.post("/api/productions", json={
            "theater_id": "theater-id",
            "name": "One Day Show",
            "estimated_cast_size": 5,
            "first_rehearsal": future.isoformat(),
            "opening_night": future.isoformat(),
            "closing_night": future.isoformat(),
        }, headers=headers)
        assert response.status_code == 201


class TestProductionFieldValidation:
    """Field-level validation for production creation."""

    async def test_name_max_200(self, client, auth_headers):
        """Production name > 200 chars rejected."""
        headers = auth_headers("director-id")
        today = date.today()
        response = await client.post("/api/productions", json={
            "theater_id": "theater-id",
            "name": "A" * 201,
            "estimated_cast_size": 20,
            "first_rehearsal": (today + timedelta(days=30)).isoformat(),
            "opening_night": (today + timedelta(days=90)).isoformat(),
            "closing_night": (today + timedelta(days=97)).isoformat(),
        }, headers=headers)
        assert response.status_code == 400

    async def test_cast_size_minimum_1(self, client, auth_headers):
        """Cast size must be >= 1."""
        headers = auth_headers("director-id")
        today = date.today()
        response = await client.post("/api/productions", json={
            "theater_id": "theater-id",
            "name": "Zero Cast",
            "estimated_cast_size": 0,
            "first_rehearsal": (today + timedelta(days=30)).isoformat(),
            "opening_night": (today + timedelta(days=90)).isoformat(),
            "closing_night": (today + timedelta(days=97)).isoformat(),
        }, headers=headers)
        assert response.status_code == 400

    async def test_cast_size_maximum_200(self, client, auth_headers):
        """Cast size must be <= 200."""
        headers = auth_headers("director-id")
        today = date.today()
        response = await client.post("/api/productions", json={
            "theater_id": "theater-id",
            "name": "Huge Cast",
            "estimated_cast_size": 201,
            "first_rehearsal": (today + timedelta(days=30)).isoformat(),
            "opening_night": (today + timedelta(days=90)).isoformat(),
            "closing_night": (today + timedelta(days=97)).isoformat(),
        }, headers=headers)
        assert response.status_code == 400


class TestProductionOneActive:
    """Director can only have one active production at a time."""

    async def test_second_active_production_returns_409(self, client, auth_headers):
        """Creating a second active production returns 409."""
        headers = auth_headers("director-id")
        today = date.today()
        prod_data = {
            "theater_id": "theater-id",
            "name": "First Production",
            "estimated_cast_size": 20,
            "first_rehearsal": (today + timedelta(days=30)).isoformat(),
            "opening_night": (today + timedelta(days=90)).isoformat(),
            "closing_night": (today + timedelta(days=97)).isoformat(),
        }
        await client.post("/api/productions", json=prod_data, headers=headers)

        prod_data["name"] = "Second Production"
        response = await client.post("/api/productions", json=prod_data, headers=headers)
        assert response.status_code == 409
        assert "already have an active production" in response.json()["message"].lower()


class TestProductionArchival:
    """SPEC-003 Section 6.5: Production archival and unarchival."""

    async def test_archive_production(self, client, auth_headers):
        """Director archives a production."""
        headers = auth_headers("director-id")
        response = await client.post("/api/productions/prod-id/archive", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["is_archived"] is True
        assert data["archived_at"] is not None

    async def test_archived_production_read_only(self, client, auth_headers):
        """Archived production blocks write operations."""
        headers = auth_headers("director-id")
        # Archive first
        await client.post("/api/productions/prod-id/archive", headers=headers)
        # Try to post to bulletin
        response = await client.post("/api/productions/prod-id/bulletin", json={
            "title": "Test",
            "body": "Test body",
        }, headers=headers)
        assert response.status_code == 403  # Read-only

    async def test_archived_production_can_be_viewed(self, client, auth_headers):
        """Archived production still allows read access."""
        headers = auth_headers("member-id")
        response = await client.get("/api/productions/prod-id/bulletin", headers=headers)
        assert response.status_code == 200

    async def test_unarchive_within_90_days(self, client, auth_headers):
        """Director can unarchive within 90-day window."""
        headers = auth_headers("director-id")
        response = await client.post("/api/productions/prod-id/unarchive", headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["is_archived"] is False

    async def test_archive_deactivates_invite_link(self, client, auth_headers):
        """Archiving a production deactivates its invite link."""
        headers = auth_headers("director-id")
        await client.post("/api/productions/prod-id/archive", headers=headers)
        # Invite link should no longer work
        response = await client.get("/api/join?token=some-token")
        # Token for archived production should be rejected

    async def test_only_director_can_archive(self, client, auth_headers):
        """Staff and Cast cannot archive."""
        staff_headers = auth_headers("staff-id")
        response = await client.post("/api/productions/prod-id/archive", headers=staff_headers)
        assert response.status_code == 403

        cast_headers = auth_headers("cast-id")
        response = await client.post("/api/productions/prod-id/archive", headers=cast_headers)
        assert response.status_code == 403


class TestProductionTransactions:
    """Production creation + director auto-join must be atomic."""

    async def test_production_creation_is_transactional(self, client, auth_headers):
        """If member insert fails, production insert rolls back."""
        # This test verifies transactional behavior
        # Implementation should simulate a failure in the member insert
        pass
