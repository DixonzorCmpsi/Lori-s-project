"""
Tests for theater management (SPEC-003 Section 3).

Covers:
- DIR-01: Director creates a theater
- DIR-15: Input exceeding max length
- DIR-19: Non-owner tries to modify theater
"""

import pytest


class TestCreateTheater:
    """DIR-01: Director creates a theater."""

    async def test_create_theater_success(self, client, auth_headers):
        """Director creates a theater with valid fields."""
        headers = auth_headers("new-director-1")
        response = await client.post("/api/theaters", json={
            "name": "Lincoln High School",
            "city": "Springfield",
            "state": "IL",
        }, headers=headers)
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Lincoln High School"
        assert data["city"] == "Springfield"
        assert data["state"] == "IL"
        assert "id" in data

    async def test_create_theater_missing_name(self, client, auth_headers):
        """Theater name is required."""
        headers = auth_headers("director-id")
        response = await client.post("/api/theaters", json={
            "city": "Springfield",
            "state": "IL",
        }, headers=headers)
        assert response.status_code == 400

    async def test_create_theater_missing_city(self, client, auth_headers):
        """City is required."""
        headers = auth_headers("director-id")
        response = await client.post("/api/theaters", json={
            "name": "Lincoln High School",
            "state": "IL",
        }, headers=headers)
        assert response.status_code == 400

    async def test_create_theater_missing_state(self, client, auth_headers):
        """State is required."""
        headers = auth_headers("director-id")
        response = await client.post("/api/theaters", json={
            "name": "Lincoln High School",
            "city": "Springfield",
        }, headers=headers)
        assert response.status_code == 400


class TestTheaterValidation:
    """DIR-15: Max length constraints on theater fields."""

    async def test_theater_name_max_200(self, client, auth_headers):
        """Theater name > 200 chars rejected."""
        headers = auth_headers("director-id")
        response = await client.post("/api/theaters", json={
            "name": "A" * 201,
            "city": "Springfield",
            "state": "IL",
        }, headers=headers)
        assert response.status_code == 400
        data = response.json()
        assert data["error"] == "VALIDATION_ERROR"

    async def test_theater_name_exactly_200(self, client, auth_headers):
        """Theater name at exactly 200 chars is accepted."""
        headers = auth_headers("new-director-2")
        response = await client.post("/api/theaters", json={
            "name": "A" * 200,
            "city": "Springfield",
            "state": "IL",
        }, headers=headers)
        assert response.status_code == 201

    async def test_theater_city_max_100(self, client, auth_headers):
        """City > 100 chars rejected."""
        headers = auth_headers("director-id")
        response = await client.post("/api/theaters", json={
            "name": "Test Theater",
            "city": "C" * 101,
            "state": "IL",
        }, headers=headers)
        assert response.status_code == 400

    async def test_theater_state_max_100(self, client, auth_headers):
        """State > 100 chars rejected."""
        headers = auth_headers("director-id")
        response = await client.post("/api/theaters", json={
            "name": "Test Theater",
            "city": "Springfield",
            "state": "S" * 101,
        }, headers=headers)
        assert response.status_code == 400


class TestTheaterOnePerDirector:
    """SPEC-003: Director must have exactly one theater in v1."""

    async def test_second_theater_returns_409(self, client, auth_headers):
        """Creating a second theater returns 409 Conflict."""
        headers = auth_headers("director-id")
        await client.post("/api/theaters", json={
            "name": "First Theater",
            "city": "Springfield",
            "state": "IL",
        }, headers=headers)
        response = await client.post("/api/theaters", json={
            "name": "Second Theater",
            "city": "Chicago",
            "state": "IL",
        }, headers=headers)
        assert response.status_code == 409
        assert "already have a theater" in response.json()["message"].lower()


class TestTheaterAuthorization:
    """DIR-19: Non-owner cannot modify theater."""

    async def test_non_owner_cannot_update_theater(self, client, auth_headers):
        """Only the theater owner can update it."""
        # Create theater as director
        director_headers = auth_headers("director-id")
        create_resp = await client.post("/api/theaters", json={
            "name": "My Theater",
            "city": "Springfield",
            "state": "IL",
        }, headers=director_headers)
        theater_id = create_resp.json().get("id", "theater-id")

        # Another user tries to update
        other_headers = auth_headers("other-user-id")
        response = await client.put(f"/api/theaters/{theater_id}", json={
            "name": "Hacked Theater",
        }, headers=other_headers)
        assert response.status_code == 403

    async def test_non_owner_cannot_delete_theater(self, client, auth_headers):
        """Only the theater owner can delete it."""
        other_headers = auth_headers("other-user-id")
        response = await client.delete("/api/theaters/theater-id", headers=other_headers)
        assert response.status_code == 403

    async def test_unauthenticated_cannot_create_theater(self, client):
        """No auth token returns 401."""
        response = await client.post("/api/theaters", json={
            "name": "Unauthorized Theater",
            "city": "Nowhere",
            "state": "NA",
        })
        assert response.status_code == 401
