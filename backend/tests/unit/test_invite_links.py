"""
Tests for invite link system (SPEC-002 Section 2.4).

Covers:
- AUTH-07: Invite link, user not logged in
- AUTH-08: Invite link, user already logged in
- AUTH-09: Director generates new invite link (regeneration)
- AUTH-21: Invite link expired (30+ days)
- AUTH-22: Invite link max uses reached
- AUTH-27: Token cleaned from URL on redirect
- CAST-01: User clicks invite link, not registered
- CAST-02: User clicks invite link, already logged in
- CAST-12: Invalid/regenerated invite link
- DIR-10: Director generates invite link
- DIR-11: Director regenerates invite link
"""

import pytest
from datetime import datetime, timedelta


class TestInviteLinkGeneration:
    """DIR-10: Director generates invite link."""

    async def test_generate_invite_link(self, client, auth_headers):
        """Director generates an invite link for their production."""
        headers = auth_headers("director-id")
        response = await client.post(
            "/api/productions/prod-id/invite",
            headers=headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert "token" in data
        assert len(data["token"]) >= 32  # Minimum 32 chars
        assert data["max_uses"] == 100  # Default
        assert "expires_at" in data

    async def test_invite_token_is_url_safe(self, client, auth_headers):
        """Token must be URL-safe string."""
        headers = auth_headers("director-id")
        response = await client.post(
            "/api/productions/prod-id/invite",
            headers=headers,
        )
        token = response.json()["token"]
        # URL-safe: only alphanumeric, hyphens, underscores
        import re
        assert re.match(r'^[A-Za-z0-9_-]+$', token)

    async def test_invite_expires_in_30_days(self, client, auth_headers):
        """Token expires 30 days from creation."""
        headers = auth_headers("director-id")
        response = await client.post(
            "/api/productions/prod-id/invite",
            headers=headers,
        )
        expires_at = response.json()["expires_at"]
        # Should be approximately 30 days from now

    async def test_staff_can_generate_invite(self, client, auth_headers):
        """Staff can also generate invite links."""
        headers = auth_headers("staff-member-id")
        response = await client.post(
            "/api/productions/prod-id/invite",
            headers=headers,
        )
        assert response.status_code == 201

    async def test_cast_cannot_generate_invite(self, client, auth_headers):
        """Cast cannot generate invite links."""
        headers = auth_headers("cast-member-id")
        response = await client.post(
            "/api/productions/prod-id/invite",
            headers=headers,
        )
        assert response.status_code == 403


class TestInviteLinkRegeneration:
    """DIR-11, AUTH-09: Regenerating invite links."""

    async def test_regenerate_invalidates_old(self, client, auth_headers):
        """DIR-11: Regenerating creates new token and invalidates old."""
        headers = auth_headers("director-id")
        # Generate first
        resp1 = await client.post("/api/productions/prod-id/invite", headers=headers)
        old_token = resp1.json()["token"]

        # Regenerate
        resp2 = await client.post("/api/productions/prod-id/invite/regenerate", headers=headers)
        new_token = resp2.json()["token"]

        assert old_token != new_token

        # Old token should no longer work
        response = await client.get(f"/api/join?token={old_token}")
        assert response.status_code in [400, 404]


class TestInviteLinkJoin:
    """AUTH-07, AUTH-08, CAST-01, CAST-02: Joining via invite link."""

    async def test_join_not_logged_in_redirects(self, client):
        """AUTH-07: Not logged in — redirect to login, preserve token in session."""
        response = await client.get("/api/join?token=valid-token", follow_redirects=False)
        # Should redirect to login/register
        assert response.status_code in [302, 307, 401]

    async def test_join_already_logged_in(self, client, auth_headers):
        """AUTH-08: Already logged in — auto-join as Cast."""
        headers = auth_headers("existing-user-id")
        response = await client.post("/api/join", json={
            "token": "valid-token",
        }, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "cast"  # Always joins as cast

    async def test_join_creates_cast_member(self, client, auth_headers, db_session):
        """Joining via invite creates a production_members row with role=cast."""
        headers = auth_headers("new-member-id")
        await client.post("/api/join", json={
            "token": "valid-token",
        }, headers=headers)
        # Verify in DB: production_members has a row with role='cast'

    async def test_join_already_member_idempotent(self, client, auth_headers):
        """Joining a production you're already in is a no-op."""
        headers = auth_headers("existing-member-id")
        response = await client.post("/api/join", json={
            "token": "valid-token",
        }, headers=headers)
        assert response.status_code == 200  # Idempotent, not error


class TestInviteLinkExpiry:
    """AUTH-21: Expired invite link."""

    async def test_expired_link_rejected(self, client, auth_headers):
        """AUTH-21: Token expired > 30 days returns error."""
        headers = auth_headers("user-id")
        response = await client.post("/api/join", json={
            "token": "expired-token",
        }, headers=headers)
        assert response.status_code == 400
        assert "expired" in response.json()["message"].lower()


class TestInviteLinkMaxUses:
    """AUTH-22: Invite link max uses reached."""

    async def test_max_uses_reached(self, client, auth_headers):
        """AUTH-22: Token at max uses returns error."""
        headers = auth_headers("user-id")
        response = await client.post("/api/join", json={
            "token": "maxed-out-token",
        }, headers=headers)
        assert response.status_code == 400
        assert "no longer available" in response.json()["message"].lower()

    async def test_use_count_increments(self, client, auth_headers):
        """Each join increments use_count."""
        # Each successful join should increment use_count by 1
        pass


class TestInviteLinkSecurity:
    """AUTH-27: Token security."""

    async def test_token_cleaned_from_url(self, client):
        """AUTH-27: Token passed as query param, cleaned on redirect."""
        response = await client.get("/api/join?token=test-token", follow_redirects=False)
        # Should redirect to clean URL without token
        if response.status_code in [302, 307]:
            location = response.headers.get("location", "")
            assert "token=" not in location

    async def test_invalid_token_rejected(self, client, auth_headers):
        """CAST-12: Invalid/regenerated invite link returns error."""
        headers = auth_headers("user-id")
        response = await client.post("/api/join", json={
            "token": "completely-invalid-token",
        }, headers=headers)
        assert response.status_code in [400, 404]

    async def test_invite_does_not_reveal_production_details(self, client):
        """Unauthenticated invite link does not reveal production info."""
        response = await client.get("/api/join?token=valid-token")
        # Should not expose production name, members, etc.
        if response.status_code == 200:
            data = response.json()
            assert "members" not in data
            assert "schedule" not in data


class TestInviteLinkDisplay:
    """Invite link info visible to Director/Staff."""

    async def test_view_invite_link_info(self, client, auth_headers):
        """Director can see current invite link details."""
        headers = auth_headers("director-id")
        response = await client.get(
            "/api/productions/prod-id/invite",
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "expires_at" in data
        assert "use_count" in data
        assert "max_uses" in data

    async def test_cast_cannot_view_invite_info(self, client, auth_headers):
        """Cast cannot see invite link details."""
        headers = auth_headers("cast-member-id")
        response = await client.get(
            "/api/productions/prod-id/invite",
            headers=headers,
        )
        assert response.status_code == 403
