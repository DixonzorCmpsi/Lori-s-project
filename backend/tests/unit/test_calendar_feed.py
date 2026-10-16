"""Personal calendar feed (.ics subscription)."""

from app.models import CastAssignment, RehearsalDate
from tests.conftest import CAST_USER_ID, PRODUCTION_ID, str_to_uuid

BASE = "/api/productions/prod-id"


async def _token(client, auth_headers, who):
    response = await client.get(f"{BASE}/calendar-link", headers=auth_headers(who))
    assert response.status_code == 200
    return response.json()["token"]


async def _feed(client, token):
    response = await client.get(f"/api/calendar/{token}.ics")
    assert response.status_code == 200
    return response.text


class TestLink:
    async def test_link_is_created_once_and_is_stable(self, client, auth_headers):
        first = await _token(client, auth_headers, "cast-member-id")
        second = await _token(client, auth_headers, "cast-member-id")
        assert first == second
        assert len(first) >= 32

    async def test_each_member_gets_their_own_link(self, client, auth_headers):
        assert await _token(client, auth_headers, "cast-member-id") != await _token(
            client, auth_headers, "other-cast-user-id"
        )

    async def test_outsider_has_no_link(self, client, auth_headers):
        response = await client.get(f"{BASE}/calendar-link", headers=auth_headers("outsider-id"))
        assert response.status_code == 403

    async def test_reset_kills_the_old_link(self, client, auth_headers):
        old = await _token(client, auth_headers, "cast-member-id")
        reset = await client.post(
            f"{BASE}/calendar-link/reset", headers=auth_headers("cast-member-id")
        )
        assert reset.status_code == 200
        assert reset.json()["token"] != old
        assert (await client.get(f"/api/calendar/{old}.ics")).status_code == 404
        assert (await client.get(f"/api/calendar/{reset.json()['token']}.ics")).status_code == 200


class TestFeed:
    async def test_feed_is_a_valid_calendar_with_the_members_calls(self, client, auth_headers):
        feed = await _feed(client, await _token(client, auth_headers, "cast-member-id"))
        assert feed.startswith("BEGIN:VCALENDAR\r\n")
        assert feed.rstrip().endswith("END:VCALENDAR")
        assert feed.count("BEGIN:VEVENT") == 7  # the seeded production has seven dates
        assert "SUMMARY:Test Production: Rehearsal" in feed
        assert "DTSTART:" in feed and "T180000" in feed

    async def test_unknown_token_is_404(self, client):
        assert (await client.get("/api/calendar/not-a-real-token.ics")).status_code == 404

    async def test_cast_only_get_the_calls_they_are_in(self, client, auth_headers, db_session):
        db_session.add(
            CastAssignment(
                production_id=PRODUCTION_ID,
                rehearsal_date_id=str_to_uuid("date-1"),
                user_id=CAST_USER_ID,
            )
        )
        await db_session.commit()
        mine = await _feed(client, await _token(client, auth_headers, "cast-member-id"))
        other = await _feed(client, await _token(client, auth_headers, "other-cast-user-id"))
        assert f"UID:{str_to_uuid('date-1')}@callboard" in mine
        assert f"UID:{str_to_uuid('date-1')}@callboard" not in other
        assert (
            f"UID:{str_to_uuid('date-2')}@callboard" in mine
        )  # other dates are still full company

    async def test_staff_see_every_call(self, client, auth_headers):
        feed = await _feed(client, await _token(client, auth_headers, "staff-member-id"))
        assert feed.count("BEGIN:VEVENT") == 7

    async def test_location_note_and_cancellation_are_included(
        self, client, auth_headers, db_session
    ):
        rd = await db_session.get(RehearsalDate, str_to_uuid("date-1"))
        rd.location = "Studio B, Main St"
        rd.note = "Bring scripts; wear flats"
        rd2 = await db_session.get(RehearsalDate, str_to_uuid("date-2"))
        rd2.is_cancelled = True
        await db_session.commit()
        feed = await _feed(client, await _token(client, auth_headers, "cast-member-id"))
        assert "LOCATION:Studio B\\, Main St" in feed
        assert "DESCRIPTION:Bring scripts\\; wear flats" in feed
        assert "STATUS:CANCELLED" in feed

    async def test_blocked_dates_are_left_out(self, client, auth_headers, db_session):
        rd = await db_session.get(RehearsalDate, str_to_uuid("date-1"))
        rd.type = "blocked"
        await db_session.commit()
        feed = await _feed(client, await _token(client, auth_headers, "cast-member-id"))
        assert feed.count("BEGIN:VEVENT") == 6

    async def test_signups_appear_in_the_feed(self, client, auth_headers):
        slot = await client.post(
            f"{BASE}/signups",
            json={
                "title": "Load-in crew",
                "date": "2099-01-05",
                "start_time": "09:00",
                "end_time": "12:00",
                "capacity": 3,
            },
            headers=auth_headers("director-id"),
        )
        assert slot.status_code == 201
        await client.post(
            f"{BASE}/signups/{slot.json()['id']}/join", headers=auth_headers("cast-member-id")
        )
        feed = await _feed(client, await _token(client, auth_headers, "cast-member-id"))
        assert "SUMMARY:Test Production: Load-in crew" in feed
        assert "DTSTART:20990105T090000" in feed

    async def test_long_lines_are_folded(self, client, auth_headers, db_session):
        rd = await db_session.get(RehearsalDate, str_to_uuid("date-1"))
        rd.note = "x" * 300
        await db_session.commit()
        feed = await _feed(client, await _token(client, auth_headers, "cast-member-id"))
        assert all(len(line.encode()) <= 75 for line in feed.split("\r\n"))
