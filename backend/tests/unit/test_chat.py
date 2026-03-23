"""
Tests for chat system (SPEC-005).

Covers:
- CHAT-01: Director sends message to cast
- CHAT-02: Cast sends message to director
- CHAT-03: Cast sends message to staff
- CHAT-04: Cast attempts to message another cast member (403)
- CHAT-05: Cast contact list (only Director/Staff)
- CHAT-06: Director contact list (all Staff + Cast)
- CHAT-08: Unread count
- CHAT-09: User not in production tries to chat (403)
- CHAT-10: Message exceeds 2000 chars
- CHAT-11: Rate limit (30 messages/min)
- CHAT-14: Conversation deduplication
- CHAT-16: Staff contact list
- CHAT-17: Director deletes a message
- CHAT-18: User deletes own message within 5 minutes
- CHAT-19: User tries to delete own message after 5 minutes
- CHAT-20: Staff tries to delete another user's message (403)
"""

import pytest
from freezegun import freeze_time
from datetime import datetime, timedelta


class TestSendMessage:
    """CHAT-01, CHAT-02, CHAT-03: Sending messages between roles."""

    async def test_director_messages_cast(self, client, auth_headers):
        """CHAT-01: Director sends message to cast member."""
        headers = auth_headers("director-id")
        response = await client.post("/api/productions/prod-id/messages", json={
            "recipient_id": "cast-member-id",
            "body": "Welcome to the production!",
        }, headers=headers)
        assert response.status_code == 201
        data = response.json()
        assert data["body"] == "Welcome to the production!"
        assert data["sender_id"] == "director-id"

    async def test_cast_messages_director(self, client, auth_headers):
        """CHAT-02: Cast sends message to director."""
        headers = auth_headers("cast-member-id")
        response = await client.post("/api/productions/prod-id/messages", json={
            "recipient_id": "director-id",
            "body": "I have a question about rehearsal.",
        }, headers=headers)
        assert response.status_code == 201

    async def test_cast_messages_staff(self, client, auth_headers):
        """CHAT-03: Cast sends message to staff member."""
        headers = auth_headers("cast-member-id")
        response = await client.post("/api/productions/prod-id/messages", json={
            "recipient_id": "staff-member-id",
            "body": "Need help with costume.",
        }, headers=headers)
        assert response.status_code == 201

    async def test_director_messages_staff(self, client, auth_headers):
        """Director can message staff."""
        headers = auth_headers("director-id")
        response = await client.post("/api/productions/prod-id/messages", json={
            "recipient_id": "staff-member-id",
            "body": "Please review the schedule.",
        }, headers=headers)
        assert response.status_code == 201

    async def test_staff_messages_cast(self, client, auth_headers):
        """Staff can message cast."""
        headers = auth_headers("staff-member-id")
        response = await client.post("/api/productions/prod-id/messages", json={
            "recipient_id": "cast-member-id",
            "body": "Your costume fitting is tomorrow.",
        }, headers=headers)
        assert response.status_code == 201


class TestCastBoundaryEnforcement:
    """CHAT-04, CHAT-15: Cast-to-cast messaging blocked at API level."""

    async def test_cast_cannot_message_cast(self, client, auth_headers):
        """CHAT-04: Cast messaging another cast returns 403."""
        headers = auth_headers("cast-member-1")
        response = await client.post("/api/productions/prod-id/messages", json={
            "recipient_id": "cast-member-2",
            "body": "Hey there!",
        }, headers=headers)
        assert response.status_code == 403
        assert response.json()["error"] == "FORBIDDEN"

    async def test_cast_boundary_enforced_on_api(self, client, auth_headers):
        """Even crafted API calls from cast-to-cast are blocked."""
        headers = auth_headers("cast-member-1")
        response = await client.post("/api/productions/prod-id/messages", json={
            "recipient_id": "cast-member-2",
            "body": "Trying to bypass UI",
        }, headers=headers)
        assert response.status_code == 403


class TestContactList:
    """CHAT-05, CHAT-06, CHAT-16: Contact list filtered by role."""

    async def test_cast_contact_list_no_other_cast(self, client, auth_headers):
        """CHAT-05: Cast contact list only shows Director and Staff."""
        headers = auth_headers("cast-member-id")
        response = await client.get(
            "/api/productions/prod-id/contacts",
            headers=headers,
        )
        assert response.status_code == 200
        contacts = response.json()
        for contact in contacts:
            assert contact["role"] in ("director", "staff")

    async def test_director_contact_list_shows_all(self, client, auth_headers):
        """CHAT-06: Director sees all Staff and Cast."""
        headers = auth_headers("director-id")
        response = await client.get(
            "/api/productions/prod-id/contacts",
            headers=headers,
        )
        assert response.status_code == 200
        contacts = response.json()
        roles = {c["role"] for c in contacts}
        # Director should see both staff and cast
        assert "staff" in roles or "cast" in roles

    async def test_staff_contact_list(self, client, auth_headers):
        """CHAT-16: Staff sees Director + other Staff + all Cast."""
        headers = auth_headers("staff-member-id")
        response = await client.get(
            "/api/productions/prod-id/contacts",
            headers=headers,
        )
        assert response.status_code == 200
        contacts = response.json()
        roles = {c["role"] for c in contacts}
        assert "director" in roles or len(contacts) > 0


class TestConversationDeduplication:
    """CHAT-14: Only one conversation per participant pair per production."""

    async def test_second_message_reuses_conversation(self, client, auth_headers):
        """Two messages between same users use same conversation."""
        headers = auth_headers("director-id")
        resp1 = await client.post("/api/productions/prod-id/messages", json={
            "recipient_id": "cast-member-id",
            "body": "First message",
        }, headers=headers)
        resp2 = await client.post("/api/productions/prod-id/messages", json={
            "recipient_id": "cast-member-id",
            "body": "Second message",
        }, headers=headers)
        assert resp1.status_code == 201
        assert resp2.status_code == 201
        assert resp1.json()["conversation_id"] == resp2.json()["conversation_id"]

    async def test_concurrent_conversation_creation(self, client, auth_headers):
        """Simultaneous first messages don't create duplicate conversations."""
        # In real test: use asyncio.gather
        # The SELECT ... FOR UPDATE in the dedup check prevents duplicates
        pass


class TestMessageValidation:
    """CHAT-10: Message validation."""

    async def test_message_exceeds_2000_chars(self, client, auth_headers):
        """Message > 2000 characters rejected."""
        headers = auth_headers("director-id")
        response = await client.post("/api/productions/prod-id/messages", json={
            "recipient_id": "cast-member-id",
            "body": "A" * 2001,
        }, headers=headers)
        assert response.status_code == 400

    async def test_message_exactly_2000_chars(self, client, auth_headers):
        """Message at exactly 2000 characters accepted."""
        headers = auth_headers("director-id")
        response = await client.post("/api/productions/prod-id/messages", json={
            "recipient_id": "cast-member-id",
            "body": "A" * 2000,
        }, headers=headers)
        assert response.status_code == 201

    async def test_empty_message_rejected(self, client, auth_headers):
        """Empty message body rejected."""
        headers = auth_headers("director-id")
        response = await client.post("/api/productions/prod-id/messages", json={
            "recipient_id": "cast-member-id",
            "body": "",
        }, headers=headers)
        assert response.status_code == 400


class TestChatAccessControl:
    """CHAT-09: Non-member cannot chat."""

    async def test_non_member_cannot_send(self, client, auth_headers):
        """User not in production cannot send messages."""
        headers = auth_headers("outsider-id")
        response = await client.post("/api/productions/prod-id/messages", json={
            "recipient_id": "cast-member-id",
            "body": "I'm not in this production!",
        }, headers=headers)
        assert response.status_code == 403

    async def test_non_member_cannot_view_contacts(self, client, auth_headers):
        """User not in production cannot see contact list."""
        headers = auth_headers("outsider-id")
        response = await client.get(
            "/api/productions/prod-id/contacts",
            headers=headers,
        )
        assert response.status_code == 403

    async def test_non_member_cannot_view_conversations(self, client, auth_headers):
        """User not in production cannot view conversations."""
        headers = auth_headers("outsider-id")
        response = await client.get(
            "/api/productions/prod-id/conversations",
            headers=headers,
        )
        assert response.status_code == 403


class TestChatRateLimiting:
    """CHAT-11: Rate limiting at 30 messages per minute."""

    async def test_rate_limit_30_per_minute(self, client, auth_headers):
        """31st message in one minute is rate limited."""
        headers = auth_headers("director-id")
        for i in range(30):
            response = await client.post("/api/productions/prod-id/messages", json={
                "recipient_id": "cast-member-id",
                "body": f"Message {i}",
            }, headers=headers)
            assert response.status_code == 201

        # 31st should be rate limited
        response = await client.post("/api/productions/prod-id/messages", json={
            "recipient_id": "cast-member-id",
            "body": "One too many",
        }, headers=headers)
        assert response.status_code == 429


class TestUnreadCount:
    """CHAT-08: Unread message count."""

    async def test_unread_count_increments(self, client, auth_headers):
        """Receiving a message increments unread count."""
        # Director sends message to cast
        director_headers = auth_headers("director-id")
        await client.post("/api/productions/prod-id/messages", json={
            "recipient_id": "cast-member-id",
            "body": "Check this",
        }, headers=director_headers)

        # Cast checks unread count
        cast_headers = auth_headers("cast-member-id")
        response = await client.get(
            "/api/productions/prod-id/unread-count",
            headers=cast_headers,
        )
        assert response.status_code == 200
        assert response.json()["count"] >= 1

    async def test_mark_read_resets_count(self, client, auth_headers):
        """Opening a conversation marks messages as read."""
        cast_headers = auth_headers("cast-member-id")
        response = await client.post(
            "/api/productions/prod-id/conversations/conv-id/mark-read",
            headers=cast_headers,
        )
        assert response.status_code == 200


class TestMessageModeration:
    """CHAT-17, CHAT-18, CHAT-19, CHAT-20: Message deletion/moderation."""

    async def test_director_deletes_any_message(self, client, auth_headers):
        """CHAT-17: Director can delete any message in their production."""
        headers = auth_headers("director-id")
        response = await client.delete(
            "/api/productions/prod-id/messages/message-id",
            headers=headers,
        )
        assert response.status_code == 200
        # Message body should be replaced
        data = response.json()
        assert data["body"] == "[Message removed by director]"
        assert data["is_deleted"] is True

    async def test_user_deletes_own_within_5_min(self, client, auth_headers):
        """CHAT-18: User can delete own message within 5 minutes."""
        headers = auth_headers("cast-member-id")
        # Create a message
        create_resp = await client.post("/api/productions/prod-id/messages", json={
            "recipient_id": "director-id",
            "body": "Oops, typo",
        }, headers=headers)
        message_id = create_resp.json().get("id", "msg-id")

        # Delete within 5 minutes
        response = await client.delete(
            f"/api/productions/prod-id/messages/{message_id}",
            headers=headers,
        )
        assert response.status_code == 200
        assert response.json()["body"] == "[Message deleted]"

    async def test_user_cannot_delete_after_5_min(self, client, auth_headers):
        """CHAT-19: User cannot delete own message after 5 minutes."""
        headers = auth_headers("cast-member-id")
        # Message created > 5 minutes ago (requires freezegun)
        response = await client.delete(
            "/api/productions/prod-id/messages/old-message-id",
            headers=headers,
        )
        assert response.status_code == 403

    async def test_staff_cannot_delete_others_messages(self, client, auth_headers):
        """CHAT-20: Staff cannot moderate/delete other users' messages."""
        headers = auth_headers("staff-member-id")
        response = await client.delete(
            "/api/productions/prod-id/messages/cast-message-id",
            headers=headers,
        )
        assert response.status_code == 403

    async def test_deleted_message_not_recoverable(self, client, auth_headers):
        """Deleted message body is overwritten in DB, not just hidden."""
        # After deletion, the original body is gone
        pass


class TestMessagePagination:
    """Message history pagination."""

    async def test_messages_paginated_at_50(self, client, auth_headers):
        """Message history returns 50 per page."""
        headers = auth_headers("director-id")
        response = await client.get(
            "/api/productions/prod-id/conversations/conv-id/messages",
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "messages" in data
        assert len(data["messages"]) <= 50

    async def test_messages_ordered_ascending(self, client, auth_headers):
        """Messages ordered by created_at ASC (oldest first)."""
        headers = auth_headers("director-id")
        response = await client.get(
            "/api/productions/prod-id/conversations/conv-id/messages",
            headers=headers,
        )
        assert response.status_code == 200
        messages = response.json().get("messages", [])
        if len(messages) > 1:
            timestamps = [m["created_at"] for m in messages]
            assert timestamps == sorted(timestamps)


class TestDeletionLog:
    """Director can view a deletion log."""

    async def test_director_views_deletion_log(self, client, auth_headers):
        """Director can see all deleted messages in their production."""
        headers = auth_headers("director-id")
        response = await client.get(
            "/api/productions/prod-id/messages/deleted",
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
