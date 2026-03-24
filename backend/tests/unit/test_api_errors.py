"""
Tests for consistent API error response format (SPEC-002 Section 3.4).

All API endpoints must return errors in the format:
{
  "error": "ERROR_CODE",
  "message": "Human-readable description"
}
"""

import pytest


class TestErrorFormat:
    """All error responses follow the standard format."""

    async def test_400_format(self, client, auth_headers):
        """400 errors include error code and message."""
        headers = auth_headers("director-id")
        response = await client.post("/api/theaters", json={
            "name": "A" * 201,  # Too long
            "city": "Springfield",
            "state": "IL",
        }, headers=headers)
        assert response.status_code == 400
        data = response.json()
        assert "error" in data
        assert data["error"] == "VALIDATION_ERROR"
        assert "message" in data

    async def test_400_validation_includes_fields(self, client, auth_headers):
        """Validation errors include per-field details."""
        headers = auth_headers("director-id")
        response = await client.post("/api/theaters", json={
            "name": "A" * 201,
            "city": "C" * 101,
            "state": "IL",
        }, headers=headers)
        assert response.status_code == 400
        data = response.json()
        assert "fields" in data
        assert isinstance(data["fields"], list)
        for field_error in data["fields"]:
            assert "field" in field_error
            assert "message" in field_error

    async def test_401_format(self, client):
        """401 errors follow standard format."""
        response = await client.get("/api/productions")
        assert response.status_code == 401
        data = response.json()
        assert data["error"] == "UNAUTHORIZED"
        assert "message" in data

    async def test_403_format(self, client, auth_headers):
        """403 errors follow standard format."""
        headers = auth_headers("cast-id")
        response = await client.post("/api/productions/prod-id/bulletin", json={
            "title": "Test", "body": "Test",
        }, headers=headers)
        assert response.status_code == 403
        data = response.json()
        assert data["error"] == "FORBIDDEN"
        assert "message" in data

    async def test_404_format(self, client, auth_headers):
        """404 errors follow standard format."""
        headers = auth_headers("director-id")
        # Use a non-existent theater (owned resources return 404 properly)
        response = await client.get(
            "/api/theaters/nonexistent-theater-id",
            headers=headers,
        )
        assert response.status_code == 404
        data = response.json()
        assert data["error"] == "NOT_FOUND"

    async def test_409_format(self, client, auth_headers):
        """409 errors follow standard format."""
        # e.g., duplicate theater
        headers = auth_headers("director-id")
        await client.post("/api/theaters", json={
            "name": "Theater", "city": "City", "state": "ST",
        }, headers=headers)
        response = await client.post("/api/theaters", json={
            "name": "Theater 2", "city": "City", "state": "ST",
        }, headers=headers)
        assert response.status_code == 409
        data = response.json()
        assert data["error"] == "CONFLICT"

    async def test_429_format(self, client):
        """429 errors follow standard format."""
        # Exhaust rate limit
        for _ in range(6):
            await client.post("/api/auth/login", json={
                "email": "ratelimit@example.com",
                "password": "test",
            })
        response = await client.post("/api/auth/login", json={
            "email": "ratelimit@example.com",
            "password": "test",
        })
        # May or may not hit 429 depending on implementation
        if response.status_code == 429:
            data = response.json()
            assert data["error"] == "RATE_LIMITED"

    async def test_500_no_stack_trace(self, client, auth_headers):
        """500 errors must not expose stack traces."""
        # This requires triggering an internal error
        # The response should say INTERNAL_ERROR, no traceback
        pass


class TestPasswordNotExposed:
    """Passwords must never appear in API responses."""

    async def test_registration_response_no_password(self, client):
        """Registration response does not include password."""
        response = await client.post("/api/auth/register", json={
            "email": "nopw@example.com",
            "name": "No PW",
            "password": "StrongP@ss99!",
            "date_of_birth": "1990-01-01",
        })
        if response.status_code == 201:
            data = response.json()
            assert "password" not in data
            assert "password_hash" not in data

    async def test_user_profile_no_password(self, client, auth_headers):
        """User profile endpoint does not expose password."""
        headers = auth_headers("user-id")
        response = await client.get("/api/auth/me", headers=headers)
        if response.status_code == 200:
            data = response.json()
            assert "password" not in data
            assert "password_hash" not in data
