"""Acknowledgement tracking: posts that ask members to confirm they have read them."""

import pytest

from app.routers import acknowledgements as ack_module

BASE = "/api/productions/prod-id"


@pytest.fixture(autouse=True)
def _reset_cooldown():
    ack_module._last_reminder.clear()
    yield
    ack_module._last_reminder.clear()


async def _make_post(client, auth_headers, requires_ack=True):
    response = await client.post(
        f"{BASE}/bulletin",
        json={"title": "Tech week call", "body": "Please read.", "requires_ack": requires_ack},
        headers=auth_headers("director-id"),
    )
    assert response.status_code == 201
    return response.json()["id"]


class TestAcknowledge:
    async def test_post_reports_ack_flag_and_counts(self, client, auth_headers):
        await _make_post(client, auth_headers)
        posts = (
            await client.get(f"{BASE}/bulletin", headers=auth_headers("cast-member-id"))
        ).json()
        post = next(p for p in posts if p["title"] == "Tech week call")
        assert post["requires_ack"] is True
        assert post["ack_count"] == 0
        assert post["ack_total"] > 0
        assert post["acknowledged"] is False

    async def test_cast_can_acknowledge_and_it_is_idempotent(self, client, auth_headers):
        post_id = await _make_post(client, auth_headers)
        headers = auth_headers("cast-member-id")
        first = await client.post(f"{BASE}/bulletin/{post_id}/ack", headers=headers)
        again = await client.post(f"{BASE}/bulletin/{post_id}/ack", headers=headers)
        assert first.status_code == 200 and again.status_code == 200
        assert first.json()["acknowledged"] is True

        posts = (await client.get(f"{BASE}/bulletin", headers=headers)).json()
        post = next(p for p in posts if p["id"] == post_id)
        assert post["acknowledged"] is True
        assert post["ack_count"] == 1

    async def test_cannot_acknowledge_a_post_that_does_not_ask(self, client, auth_headers):
        post_id = await _make_post(client, auth_headers, requires_ack=False)
        response = await client.post(
            f"{BASE}/bulletin/{post_id}/ack", headers=auth_headers("cast-member-id")
        )
        assert response.status_code == 400

    async def test_outsider_cannot_acknowledge(self, client, auth_headers):
        post_id = await _make_post(client, auth_headers)
        response = await client.post(
            f"{BASE}/bulletin/{post_id}/ack", headers=auth_headers("outsider-id")
        )
        assert response.status_code == 403


class TestStatusAndReminders:
    async def test_staff_see_who_confirmed_and_who_has_not(self, client, auth_headers):
        post_id = await _make_post(client, auth_headers)
        await client.post(f"{BASE}/bulletin/{post_id}/ack", headers=auth_headers("cast-member-id"))

        response = await client.get(
            f"{BASE}/bulletin/{post_id}/acks", headers=auth_headers("staff-member-id")
        )
        assert response.status_code == 200
        data = response.json()
        assert [a["user_id"] for a in data["acknowledged"]] == ["cast-member-id"]
        pending_ids = {p["user_id"] for p in data["pending"]}
        assert "other-cast-user-id" in pending_ids
        assert "cast-member-id" not in pending_ids
        assert "director-id" not in pending_ids  # the author is never pending

    async def test_cast_cannot_see_the_list(self, client, auth_headers):
        post_id = await _make_post(client, auth_headers)
        response = await client.get(
            f"{BASE}/bulletin/{post_id}/acks", headers=auth_headers("cast-member-id")
        )
        assert response.status_code == 403

    async def test_remind_reports_pending_and_is_rate_limited(self, client, auth_headers):
        post_id = await _make_post(client, auth_headers)
        headers = auth_headers("director-id")
        first = await client.post(f"{BASE}/bulletin/{post_id}/acks/remind", headers=headers)
        assert first.status_code == 200
        assert first.json()["pending"] > 0
        second = await client.post(f"{BASE}/bulletin/{post_id}/acks/remind", headers=headers)
        assert second.status_code == 429
        assert second.json()["error"] == "RATE_LIMITED"

    async def test_cast_cannot_send_reminders(self, client, auth_headers):
        post_id = await _make_post(client, auth_headers)
        response = await client.post(
            f"{BASE}/bulletin/{post_id}/acks/remind", headers=auth_headers("cast-member-id")
        )
        assert response.status_code == 403


class TestPending:
    async def test_pending_lists_unconfirmed_posts_then_clears(self, client, auth_headers):
        post_id = await _make_post(client, auth_headers)
        headers = auth_headers("cast-member-id")
        pending = (await client.get(f"{BASE}/acks/pending", headers=headers)).json()
        assert [p["id"] for p in pending] == [post_id]

        await client.post(f"{BASE}/bulletin/{post_id}/ack", headers=headers)
        pending = (await client.get(f"{BASE}/acks/pending", headers=headers)).json()
        assert pending == []

    async def test_authors_do_not_owe_themselves_a_confirmation(self, client, auth_headers):
        await _make_post(client, auth_headers)
        pending = (
            await client.get(f"{BASE}/acks/pending", headers=auth_headers("director-id"))
        ).json()
        assert pending == []
