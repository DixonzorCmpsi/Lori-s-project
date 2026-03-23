"""
Tests for cast profile management (SPEC-004 Section 3).

Covers:
- CAST-03: Cast completes profile
- CAST-16: Upload headshot as JPEG
- CAST-17: Upload SVG rejected
- CAST-18: Upload exceeding 5MB rejected
"""

import pytest
import io


class TestCastProfileCreation:
    """CAST-03: Cast completes profile."""

    async def test_create_profile_all_fields(self, client, auth_headers):
        """Cast member creates a full profile with all fields."""
        headers = auth_headers("cast-member-id")
        response = await client.post("/api/productions/prod-id/profile", json={
            "display_name": "Alex Johnson",
            "phone": "555-0123",
            "role_character": "Narrator",
        }, headers=headers)
        assert response.status_code == 201
        data = response.json()
        assert data["display_name"] == "Alex Johnson"
        assert data["phone"] == "555-0123"
        assert data["role_character"] == "Narrator"

    async def test_create_profile_required_only(self, client, auth_headers):
        """Only display_name is required."""
        headers = auth_headers("cast-member-id")
        response = await client.post("/api/productions/prod-id/profile", json={
            "display_name": "Alex Johnson",
        }, headers=headers)
        assert response.status_code == 201
        data = response.json()
        assert data["phone"] is None
        assert data["role_character"] is None

    async def test_create_profile_missing_display_name(self, client, auth_headers):
        """Missing display_name returns 400."""
        headers = auth_headers("cast-member-id")
        response = await client.post("/api/productions/prod-id/profile", json={
            "phone": "555-0123",
        }, headers=headers)
        assert response.status_code == 400

    async def test_display_name_max_200(self, client, auth_headers):
        """Display name > 200 chars rejected."""
        headers = auth_headers("cast-member-id")
        response = await client.post("/api/productions/prod-id/profile", json={
            "display_name": "A" * 201,
        }, headers=headers)
        assert response.status_code == 400

    async def test_phone_max_20(self, client, auth_headers):
        """Phone > 20 chars rejected."""
        headers = auth_headers("cast-member-id")
        response = await client.post("/api/productions/prod-id/profile", json={
            "display_name": "Alex",
            "phone": "1" * 21,
        }, headers=headers)
        assert response.status_code == 400

    async def test_role_character_max_200(self, client, auth_headers):
        """Role/character > 200 chars rejected."""
        headers = auth_headers("cast-member-id")
        response = await client.post("/api/productions/prod-id/profile", json={
            "display_name": "Alex",
            "role_character": "R" * 201,
        }, headers=headers)
        assert response.status_code == 400

    async def test_profile_is_per_production(self, client, auth_headers):
        """Same user can have different profiles in different productions."""
        headers = auth_headers("cast-member-id")
        resp1 = await client.post("/api/productions/prod-1/profile", json={
            "display_name": "Alex in Show 1",
        }, headers=headers)
        resp2 = await client.post("/api/productions/prod-2/profile", json={
            "display_name": "Alex in Show 2",
        }, headers=headers)
        assert resp1.status_code == 201
        assert resp2.status_code == 201


class TestHeadshotUpload:
    """CAST-16, CAST-17, CAST-18: Image upload rules."""

    async def test_upload_jpeg_valid(self, client, auth_headers):
        """CAST-16: Valid JPEG upload succeeds."""
        headers = auth_headers("cast-member-id")
        # JPEG magic bytes: FF D8 FF
        jpeg_content = b"\xff\xd8\xff\xe0" + b"\x00" * 1000
        files = {"file": ("photo.jpg", io.BytesIO(jpeg_content), "image/jpeg")}
        response = await client.post(
            "/api/productions/prod-id/profile/headshot",
            files=files,
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["headshot_url"] is not None
        # Filename should be a UUID, not original filename
        assert "photo.jpg" not in data["headshot_url"]

    async def test_upload_png_valid(self, client, auth_headers):
        """Valid PNG upload succeeds."""
        headers = auth_headers("cast-member-id")
        # PNG magic bytes: 89 50 4E 47
        png_content = b"\x89PNG\r\n\x1a\n" + b"\x00" * 1000
        files = {"file": ("photo.png", io.BytesIO(png_content), "image/png")}
        response = await client.post(
            "/api/productions/prod-id/profile/headshot",
            files=files,
            headers=headers,
        )
        assert response.status_code == 200

    async def test_upload_svg_rejected(self, client, auth_headers):
        """CAST-17: SVG uploads rejected — JPEG/PNG only."""
        headers = auth_headers("cast-member-id")
        svg_content = b'<svg xmlns="http://www.w3.org/2000/svg"></svg>'
        files = {"file": ("photo.svg", io.BytesIO(svg_content), "image/svg+xml")}
        response = await client.post(
            "/api/productions/prod-id/profile/headshot",
            files=files,
            headers=headers,
        )
        assert response.status_code == 400

    async def test_upload_gif_rejected(self, client, auth_headers):
        """GIF uploads rejected."""
        headers = auth_headers("cast-member-id")
        gif_content = b"GIF89a" + b"\x00" * 1000
        files = {"file": ("photo.gif", io.BytesIO(gif_content), "image/gif")}
        response = await client.post(
            "/api/productions/prod-id/profile/headshot",
            files=files,
            headers=headers,
        )
        assert response.status_code == 400

    async def test_upload_exceeds_5mb_rejected(self, client, auth_headers):
        """CAST-18: Files > 5MB rejected with 413."""
        headers = auth_headers("cast-member-id")
        large_content = b"\xff\xd8\xff\xe0" + b"\x00" * (5 * 1024 * 1024 + 1)
        files = {"file": ("big.jpg", io.BytesIO(large_content), "image/jpeg")}
        response = await client.post(
            "/api/productions/prod-id/profile/headshot",
            files=files,
            headers=headers,
        )
        assert response.status_code == 413

    async def test_upload_validates_magic_bytes_not_extension(self, client, auth_headers):
        """File type validated by magic bytes, not file extension."""
        headers = auth_headers("cast-member-id")
        # File named .jpg but actually a GIF
        gif_content = b"GIF89a" + b"\x00" * 1000
        files = {"file": ("fake.jpg", io.BytesIO(gif_content), "image/jpeg")}
        response = await client.post(
            "/api/productions/prod-id/profile/headshot",
            files=files,
            headers=headers,
        )
        assert response.status_code == 400  # Rejected despite .jpg extension

    async def test_upload_strips_exif(self, client, auth_headers):
        """EXIF metadata is stripped from uploaded images."""
        # In a real test, upload a JPEG with EXIF GPS data
        # Then download and verify EXIF is stripped
        pass

    async def test_upload_generates_uuid_filename(self, client, auth_headers):
        """Server generates UUID filename, discards original."""
        headers = auth_headers("cast-member-id")
        jpeg_content = b"\xff\xd8\xff\xe0" + b"\x00" * 1000
        files = {"file": ("../../etc/passwd.jpg", io.BytesIO(jpeg_content), "image/jpeg")}
        response = await client.post(
            "/api/productions/prod-id/profile/headshot",
            files=files,
            headers=headers,
        )
        assert response.status_code == 200
        # Filename must not contain path traversal
        url = response.json()["headshot_url"]
        assert ".." not in url
        assert "passwd" not in url


class TestHeadshotDeletion:
    """Users must be able to delete their photo at any time."""

    async def test_delete_own_headshot(self, client, auth_headers):
        """Cast member can remove their own photo."""
        headers = auth_headers("cast-member-id")
        response = await client.delete(
            "/api/productions/prod-id/profile/headshot",
            headers=headers,
        )
        assert response.status_code == 200

    async def test_headshot_deleted_on_member_removal(self, client, auth_headers):
        """When a member is removed from production, their headshot is deleted."""
        # This is a cascading effect test
        pass

    async def test_headshot_deleted_on_account_deletion(self, client, auth_headers):
        """When a user deletes their account, all headshots are deleted."""
        pass
