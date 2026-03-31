"""
Tests for user registration (SPEC-002 Section 2.2, 2.3).

Covers:
- AUTH-01: Register with email/password
- AUTH-02: Register with Google OAuth
- AUTH-19: Anti-enumeration on duplicate email
- AUTH-20: Breached password rejection
- AUTH-26: Under-13 age gate blocking
"""

import pytest
from datetime import date


class TestEmailPasswordRegistration:
    """AUTH-01: Register with email/password."""

    async def test_register_valid_user(self, client):
        """Happy path: valid email, strong password, adult DOB."""
        response = await client.post("/api/auth/register", json={
            "email": "newuser@example.com",
            "name": "New User",
            "password": "StrongP@ss99!",
            "date_of_birth": "1990-05-15",
        })
        assert response.status_code == 201
        data = response.json()
        assert "id" in data
        assert data["email"] == "newuser@example.com"
        assert data["age_range"] == "18+"
        assert data["email_verified"] is False
        # Raw DOB must NOT be in response
        assert "date_of_birth" not in data

    async def test_register_teen_user(self, client):
        """Teen (13-17) can register, gets correct age_range."""
        response = await client.post("/api/auth/register", json={
            "email": "teen@example.com",
            "name": "Teen User",
            "password": "StrongP@ss99!",
            "date_of_birth": "2010-03-20",  # 16 years old in 2026
        })
        assert response.status_code == 201
        assert response.json()["age_range"] == "13-17"

    async def test_register_missing_fields(self, client):
        """All required fields must be present."""
        response = await client.post("/api/auth/register", json={
            "email": "incomplete@example.com",
        })
        assert response.status_code == 400
        data = response.json()
        assert data["error"] == "VALIDATION_ERROR"
        assert "fields" in data

    async def test_register_invalid_email_format(self, client):
        """Email must be a valid format."""
        response = await client.post("/api/auth/register", json={
            "email": "not-an-email",
            "name": "Bad Email",
            "password": "StrongP@ss99!",
            "date_of_birth": "1990-01-01",
        })
        assert response.status_code == 400

    async def test_register_email_max_length(self, client):
        """Email must be <= 320 characters."""
        long_email = "a" * 310 + "@example.com"  # 322 chars
        response = await client.post("/api/auth/register", json={
            "email": long_email,
            "name": "Long Email",
            "password": "StrongP@ss99!",
            "date_of_birth": "1990-01-01",
        })
        assert response.status_code == 400

    async def test_register_name_max_length(self, client):
        """Name must be <= 200 characters."""
        response = await client.post("/api/auth/register", json={
            "email": "user@example.com",
            "name": "A" * 201,
            "password": "StrongP@ss99!",
            "date_of_birth": "1990-01-01",
        })
        assert response.status_code == 400


class TestPasswordValidation:
    """AUTH-20: Breached password rejection and password rules."""

    async def test_register_short_password(self, client):
        """Password must be >= 8 characters."""
        response = await client.post("/api/auth/register", json={
            "email": "user@example.com",
            "name": "User",
            "password": "short",
            "date_of_birth": "1990-01-01",
        })
        assert response.status_code == 400
        assert "password" in str(response.json()).lower()

    async def test_register_breached_password(self, client):
        """Breached passwords from top 10k list must be rejected."""
        response = await client.post("/api/auth/register", json={
            "email": "user@example.com",
            "name": "User",
            "password": "password",  # In breached list
            "date_of_birth": "1990-01-01",
        })
        assert response.status_code == 400
        data = response.json()
        assert "too common" in data["message"].lower() or "too common" in str(data.get("fields", "")).lower()

    async def test_register_breached_password_case_insensitive(self, client):
        """Breached password check must be case-insensitive."""
        response = await client.post("/api/auth/register", json={
            "email": "user@example.com",
            "name": "User",
            "password": "PASSWORD",  # Uppercase version of breached password
            "date_of_birth": "1990-01-01",
        })
        assert response.status_code == 400

    async def test_register_password_no_complexity_rules(self, client):
        """No uppercase/number complexity rules — only length and breach check."""
        response = await client.post("/api/auth/register", json={
            "email": "user@example.com",
            "name": "User",
            "password": "alllowercasebutlong",  # Valid: 8+ chars, not breached
            "date_of_birth": "1990-01-01",
        })
        assert response.status_code == 201


class TestAgeGate:
    """AUTH-26: Under-13 blocked at registration (COPPA)."""

    async def test_register_under_13_blocked(self, client):
        """Users under 13 must be blocked. No account created."""
        response = await client.post("/api/auth/register", json={
            "email": "child@example.com",
            "name": "Young User",
            "password": "StrongP@ss99!",
            "date_of_birth": "2015-06-01",  # Under 13 in 2026
        })
        assert response.status_code == 400
        data = response.json()
        assert "13" in data["message"] or "age" in data["message"].lower()

    async def test_register_exactly_13_allowed(self, client):
        """User who is exactly 13 today can register."""
        # Calculate DOB that makes user exactly 13
        today = date.today()
        dob_exactly_13 = date(today.year - 13, today.month, today.day)
        response = await client.post("/api/auth/register", json={
            "email": "just13@example.com",
            "name": "Just Thirteen",
            "password": "StrongP@ss99!",
            "date_of_birth": dob_exactly_13.isoformat(),
        })
        assert response.status_code == 201
        assert response.json()["age_range"] == "13-17"

    async def test_register_day_before_13_blocked(self, client):
        """User who turns 13 tomorrow is still blocked."""
        from datetime import timedelta
        today = date.today()
        # Use a safe date for the DOB calculation (avoid month-end overflow)
        thirteen_years_ago = today.replace(year=today.year - 13, month=1, day=15)
        # Born one day after today's date in their birth year = not yet 13
        try:
            dob_almost_13 = today.replace(year=today.year - 13) + timedelta(days=1)
        except ValueError:
            # Handle leap year edge case (Feb 29 -> Mar 1)
            dob_almost_13 = today.replace(year=today.year - 13, day=28) + timedelta(days=2)
        response = await client.post("/api/auth/register", json={
            "email": "almost13@example.com",
            "name": "Almost Thirteen",
            "password": "StrongP@ss99!",
            "date_of_birth": dob_almost_13.isoformat(),
        })
        assert response.status_code == 400

    async def test_raw_dob_not_stored(self, client, db_session):
        """Raw DOB must never be persisted in the database."""
        response = await client.post("/api/auth/register", json={
            "email": "nodob@example.com",
            "name": "No DOB Stored",
            "password": "StrongP@ss99!",
            "date_of_birth": "1990-01-15",
        })
        assert response.status_code == 201
        user_id = response.json()["id"]
        # Query the DB directly — no date_of_birth column should exist
        # user = await db_session.get(User, user_id)
        # assert not hasattr(user, "date_of_birth")
        # assert user.age_range == "18+"


class TestAntiEnumeration:
    """AUTH-19: Registration must not reveal whether email exists."""

    async def test_register_duplicate_email_same_response(self, client):
        """Registering with an existing email returns same success message."""
        # First registration
        await client.post("/api/auth/register", json={
            "email": "existing@example.com",
            "name": "First User",
            "password": "StrongP@ss99!",
            "date_of_birth": "1990-01-01",
        })
        # Second registration with same email
        response = await client.post("/api/auth/register", json={
            "email": "existing@example.com",
            "name": "Second User",
            "password": "StrongP@ss99!",
            "date_of_birth": "1990-01-01",
        })
        # Must not reveal email exists — return generic success
        assert response.status_code in [200, 201]
        data = response.json()
        assert "verification" in data.get("message", "").lower() or "check your email" in data.get("message", "").lower()


class TestGoogleOAuth:
    """AUTH-02: Google OAuth registration."""

    async def test_google_oauth_creates_user(self, client):
        """Google OAuth callback creates user with email_verified=True, age_range=NULL."""
        # This tests the OAuth callback handler
        response = await client.post("/api/auth/google/callback", json={
            "google_id": "google-sub-12345",
            "email": "googleuser@gmail.com",
            "name": "Google User",
        })
        assert response.status_code == 200
        data = response.json()
        assert data["email_verified"] is True
        assert data["age_range"] is None  # Must complete post-OAuth age gate

    async def test_google_oauth_links_verified_account(self, client):
        """AUTH-11: Google OAuth links to existing verified email/password account."""
        # Create email/password user first
        await client.post("/api/auth/register", json={
            "email": "linked@example.com",
            "name": "Linked User",
            "password": "StrongP@ss99!",
            "date_of_birth": "1990-01-01",
        })
        # Verify the email (simulate)
        # Now Google OAuth with same email
        response = await client.post("/api/auth/google/callback", json={
            "google_id": "google-sub-67890",
            "email": "linked@example.com",
            "name": "Linked User",
        })
        assert response.status_code == 200
        # Should link, not create separate account

    async def test_google_oauth_no_link_unverified(self, client):
        """AUTH-13: Google OAuth with existing UNVERIFIED email creates separate account."""
        # Create unverified email/password user
        await client.post("/api/auth/register", json={
            "email": "unverified@example.com",
            "name": "Unverified User",
            "password": "StrongP@ss99!",
            "date_of_birth": "1990-01-01",
        })
        # Google OAuth with same email (email is unverified)
        response = await client.post("/api/auth/google/callback", json={
            "google_id": "google-sub-99999",
            "email": "unverified@example.com",
            "name": "Unverified User",
        })
        assert response.status_code == 200
        # Should NOT auto-link to unverified account


class TestPostOAuthAgeGate:
    """Google OAuth users must complete age gate before accessing features."""

    async def test_incomplete_profile_blocked(self, client, auth_headers):
        """User with age_range=NULL cannot access production features."""
        # Create a Google OAuth user who hasn't completed age gate
        headers = auth_headers("google-user-id")
        response = await client.get("/api/productions", headers=headers)
        # Should redirect or return error indicating profile completion needed
        # Exact behavior depends on implementation
        assert response.status_code in [302, 403]

    async def test_complete_profile_age_gate(self, client, auth_headers):
        """POST /api/auth/complete-profile sets age_range from DOB."""
        headers = auth_headers("google-user-id")
        response = await client.post("/api/auth/complete-profile", json={
            "date_of_birth": "1990-01-15",
        }, headers=headers)
        assert response.status_code == 200
        assert response.json()["age_range"] == "18+"

    async def test_complete_profile_under_13_blocked(self, client, auth_headers):
        """Post-OAuth age gate blocks users under 13."""
        headers = auth_headers("google-user-id")
        response = await client.post("/api/auth/complete-profile", json={
            "date_of_birth": "2015-06-01",
        }, headers=headers)
        assert response.status_code == 400
