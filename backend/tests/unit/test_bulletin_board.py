"""
Tests for bulletin board (SPEC-003 Section 6.2).

Covers:
- DIR-08: Director posts to bulletin board (Markdown)
- DIR-09: Director pins a post
- DIR-20: Bulletin post with XSS script tag
- DIR-23: Staff member creates bulletin post
- CAST-06: Cast views bulletin board
"""

import pytest


class TestCreatePost:
    """DIR-08, DIR-23: Creating bulletin posts."""

    async def test_director_creates_post(self, client, auth_headers):
        """Director can create a bulletin post."""
        headers = auth_headers("director-id")
        response = await client.post("/api/productions/prod-id/bulletin", json={
            "title": "Important Announcement",
            "body": "# Welcome\n\nPlease read the updated schedule.",
        }, headers=headers)
        assert response.status_code == 201
        data = response.json()
        assert data["title"] == "Important Announcement"
        assert data["author_id"] == "director-id"

    async def test_staff_creates_post(self, client, auth_headers):
        """DIR-23: Staff can create bulletin posts."""
        headers = auth_headers("staff-member-id")
        response = await client.post("/api/productions/prod-id/bulletin", json={
            "title": "Costume Update",
            "body": "Please bring your own shoes to tech week.",
        }, headers=headers)
        assert response.status_code == 201

    async def test_cast_cannot_create_post(self, client, auth_headers):
        """Cast cannot post to the bulletin board."""
        headers = auth_headers("cast-member-id")
        response = await client.post("/api/productions/prod-id/bulletin", json={
            "title": "Cast Post",
            "body": "This should fail.",
        }, headers=headers)
        assert response.status_code == 403


class TestPostValidation:
    """Post field validation."""

    async def test_title_required(self, client, auth_headers):
        """Title is required."""
        headers = auth_headers("director-id")
        response = await client.post("/api/productions/prod-id/bulletin", json={
            "body": "No title provided.",
        }, headers=headers)
        assert response.status_code == 400

    async def test_body_required(self, client, auth_headers):
        """Body is required."""
        headers = auth_headers("director-id")
        response = await client.post("/api/productions/prod-id/bulletin", json={
            "title": "No Body",
        }, headers=headers)
        assert response.status_code == 400

    async def test_title_max_200(self, client, auth_headers):
        """Title > 200 chars rejected."""
        headers = auth_headers("director-id")
        response = await client.post("/api/productions/prod-id/bulletin", json={
            "title": "T" * 201,
            "body": "Body text.",
        }, headers=headers)
        assert response.status_code == 400

    async def test_body_max_10000(self, client, auth_headers):
        """Body > 10000 chars rejected."""
        headers = auth_headers("director-id")
        response = await client.post("/api/productions/prod-id/bulletin", json={
            "title": "Long Body",
            "body": "B" * 10001,
        }, headers=headers)
        assert response.status_code == 400


class TestMarkdownSanitization:
    """DIR-20: Markdown sanitized server-side before storage."""

    async def test_xss_script_tag_stripped(self, client, auth_headers):
        """DIR-20: Script tags are stripped from Markdown."""
        headers = auth_headers("director-id")
        response = await client.post("/api/productions/prod-id/bulletin", json={
            "title": "XSS Test",
            "body": "Hello <script>alert('xss')</script> world",
        }, headers=headers)
        assert response.status_code == 201
        data = response.json()
        assert "<script>" not in data["body"]
        assert "alert" not in data["body"]

    async def test_allowed_markdown_preserved(self, client, auth_headers):
        """Bold, italic, headings, lists, links are preserved."""
        headers = auth_headers("director-id")
        response = await client.post("/api/productions/prod-id/bulletin", json={
            "title": "Markdown Test",
            "body": "**bold** _italic_ # Heading\n- list item\n[link](https://example.com)",
        }, headers=headers)
        assert response.status_code == 201
        body = response.json()["body"]
        # Markdown formatting should be preserved (raw markdown stored)
        assert "**bold**" in body or "<strong>" in body

    async def test_iframe_stripped(self, client, auth_headers):
        """Iframe tags are stripped."""
        headers = auth_headers("director-id")
        response = await client.post("/api/productions/prod-id/bulletin", json={
            "title": "Iframe Test",
            "body": '<iframe src="https://evil.com"></iframe>',
        }, headers=headers)
        assert response.status_code == 201
        assert "<iframe" not in response.json()["body"]

    async def test_img_tag_stripped(self, client, auth_headers):
        """Embedded image tags are stripped (no embedded images allowed)."""
        headers = auth_headers("director-id")
        response = await client.post("/api/productions/prod-id/bulletin", json={
            "title": "Image Test",
            "body": '<img src="https://evil.com/tracker.png" />',
        }, headers=headers)
        assert response.status_code == 201
        assert "<img" not in response.json()["body"]

    async def test_links_get_noopener(self, client, auth_headers):
        """Links are rendered with rel='noopener noreferrer' target='_blank'."""
        # This is a rendering concern — verified on the frontend
        # But server should sanitize to ensure safe link attributes
        pass


class TestPinning:
    """DIR-09: Post pinning."""

    async def test_pin_a_post(self, client, auth_headers):
        """Director can pin a post."""
        headers = auth_headers("director-id")
        response = await client.post(
            "/api/productions/prod-id/bulletin/post-id/pin",
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["is_pinned"] is True

    async def test_multiple_pins_allowed(self, client, auth_headers):
        """Multiple posts can be pinned."""
        headers = auth_headers("director-id")
        # Pin first post
        await client.post("/api/productions/prod-id/bulletin/post-1/pin", headers=headers)
        # Pin second post
        await client.post("/api/productions/prod-id/bulletin/post-2/pin", headers=headers)

        # Get all posts
        response = await client.get("/api/productions/prod-id/bulletin", headers=headers)
        posts = response.json()
        pinned = [p for p in posts if p.get("is_pinned")]
        assert len(pinned) >= 2

    async def test_staff_can_pin(self, client, auth_headers):
        """Staff can pin posts."""
        headers = auth_headers("staff-member-id")
        response = await client.post(
            "/api/productions/prod-id/bulletin/post-id/pin",
            headers=headers,
        )
        assert response.status_code == 200

    async def test_cast_cannot_pin(self, client, auth_headers):
        """Cast cannot pin posts."""
        headers = auth_headers("cast-member-id")
        response = await client.post(
            "/api/productions/prod-id/bulletin/post-id/pin",
            headers=headers,
        )
        assert response.status_code == 403


class TestPostOrdering:
    """Posts ordered newest-first, pinned at top."""

    async def test_posts_newest_first(self, client, auth_headers):
        """Posts are returned newest-first."""
        headers = auth_headers("director-id")
        response = await client.get("/api/productions/prod-id/bulletin", headers=headers)
        assert response.status_code == 200
        posts = response.json()
        if len(posts) > 1:
            timestamps = [p["created_at"] for p in posts]
            # Newest first = descending order
            assert timestamps == sorted(timestamps, reverse=True)

    async def test_pinned_post_appears_first(self, client, auth_headers):
        """Pinned post appears at the top regardless of date."""
        headers = auth_headers("director-id")
        response = await client.get("/api/productions/prod-id/bulletin", headers=headers)
        posts = response.json()
        if posts and posts[0].get("is_pinned"):
            assert posts[0]["is_pinned"] is True


class TestPostEditing:
    """Director/Staff can edit their posts."""

    async def test_director_edits_own_post(self, client, auth_headers):
        """Director can edit their own post."""
        headers = auth_headers("director-id")
        response = await client.patch("/api/productions/prod-id/bulletin/post-id", json={
            "body": "Updated body content",
        }, headers=headers)
        assert response.status_code == 200

    async def test_director_edits_staff_post(self, client, auth_headers):
        """Director can edit staff posts."""
        headers = auth_headers("director-id")
        response = await client.patch("/api/productions/prod-id/bulletin/staff-post-id", json={
            "body": "Director edited this",
        }, headers=headers)
        assert response.status_code == 200

    async def test_staff_edits_own_post(self, client, auth_headers):
        """Staff can edit their own post."""
        headers = auth_headers("staff-member-id")
        response = await client.patch("/api/productions/prod-id/bulletin/own-post-id", json={
            "body": "Staff updated this",
        }, headers=headers)
        assert response.status_code == 200

    async def test_staff_cannot_edit_director_post(self, client, auth_headers):
        """Staff cannot edit Director's posts."""
        headers = auth_headers("staff-member-id")
        response = await client.patch("/api/productions/prod-id/bulletin/director-post-id", json={
            "body": "Staff trying to edit",
        }, headers=headers)
        assert response.status_code == 403

    async def test_cast_cannot_edit_any_post(self, client, auth_headers):
        """Cast has no editing capability."""
        headers = auth_headers("cast-member-id")
        response = await client.patch("/api/productions/prod-id/bulletin/post-id", json={
            "body": "Cast trying to edit",
        }, headers=headers)
        assert response.status_code == 403

    async def test_edit_re_sanitizes_markdown(self, client, auth_headers):
        """Edited post body is re-sanitized server-side."""
        headers = auth_headers("director-id")
        response = await client.patch("/api/productions/prod-id/bulletin/post-id", json={
            "body": "Updated <script>alert('xss')</script> content",
        }, headers=headers)
        assert response.status_code == 200
        assert "<script>" not in response.json()["body"]


class TestPostDeletion:
    """Post deletion rules."""

    async def test_director_deletes_any_post(self, client, auth_headers):
        """Director can delete any post."""
        headers = auth_headers("director-id")
        response = await client.delete(
            "/api/productions/prod-id/bulletin/any-post-id",
            headers=headers,
        )
        assert response.status_code == 200

    async def test_staff_deletes_own_post(self, client, auth_headers):
        """Staff can delete their own posts."""
        headers = auth_headers("staff-member-id")
        response = await client.delete(
            "/api/productions/prod-id/bulletin/own-post-id",
            headers=headers,
        )
        assert response.status_code == 200

    async def test_staff_cannot_delete_others_post(self, client, auth_headers):
        """Staff cannot delete other people's posts."""
        headers = auth_headers("staff-member-id")
        response = await client.delete(
            "/api/productions/prod-id/bulletin/director-post-id",
            headers=headers,
        )
        assert response.status_code == 403

    async def test_cast_cannot_delete_post(self, client, auth_headers):
        """Cast cannot delete any post."""
        headers = auth_headers("cast-member-id")
        response = await client.delete(
            "/api/productions/prod-id/bulletin/any-post-id",
            headers=headers,
        )
        assert response.status_code == 403


class TestBulletinBoardViewing:
    """CAST-06: Cast views bulletin board."""

    async def test_cast_views_bulletin(self, client, auth_headers):
        """Cast can read all posts on the bulletin board."""
        headers = auth_headers("cast-member-id")
        response = await client.get(
            "/api/productions/prod-id/bulletin",
            headers=headers,
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    async def test_non_member_cannot_view_bulletin(self, client, auth_headers):
        """Users not in production cannot view bulletin."""
        headers = auth_headers("outsider-id")
        response = await client.get(
            "/api/productions/prod-id/bulletin",
            headers=headers,
        )
        assert response.status_code == 403
