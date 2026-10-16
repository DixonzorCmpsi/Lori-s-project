"""Open-call sign-ups and double-booking detection."""

import uuid
from datetime import date, time, timedelta

from app.models import CastAssignment, RehearsalDate
from tests.conftest import CAST_USER_ID, OTHER_CAST_USER_ID, PRODUCTION_ID, str_to_uuid

BASE = "/api/productions/prod-id"


def _slot(**overrides):
    slot = {
        "title": "Strike crew",
        "description": "Bring gloves",
        "date": (date.today() + timedelta(days=40)).isoformat(),
        "start_time": "10:00",
        "end_time": "13:00",
        "location": "Main stage",
        "capacity": 2,
    }
    slot.update(overrides)
    return slot


async def _create(client, auth_headers, who="director-id", **overrides):
    return await client.post(f"{BASE}/signups", json=_slot(**overrides), headers=auth_headers(who))


class TestSlots:
    async def test_staff_create_and_everyone_lists(self, client, auth_headers):
        created = await _create(client, auth_headers, who="staff-member-id")
        assert created.status_code == 201
        assert created.json()["capacity"] == 2 and created.json()["filled"] == 0
        listing = (
            await client.get(f"{BASE}/signups", headers=auth_headers("cast-member-id"))
        ).json()
        assert [s["title"] for s in listing] == ["Strike crew"]
        assert listing[0]["mine"] is False

    async def test_cast_cannot_create(self, client, auth_headers):
        assert (await _create(client, auth_headers, who="cast-member-id")).status_code == 403

    async def test_slots_come_back_in_date_order(self, client, auth_headers):
        await _create(
            client,
            auth_headers,
            title="Later",
            date=(date.today() + timedelta(days=50)).isoformat(),
        )
        await _create(
            client,
            auth_headers,
            title="Sooner",
            date=(date.today() + timedelta(days=41)).isoformat(),
        )
        titles = [
            s["title"]
            for s in (
                await client.get(f"{BASE}/signups", headers=auth_headers("cast-member-id"))
            ).json()
        ]
        assert titles == ["Sooner", "Later"]

    async def test_validation(self, client, auth_headers):
        assert (await _create(client, auth_headers, title=" ")).status_code == 400
        assert (await _create(client, auth_headers, capacity=0)).status_code == 400
        assert (
            await _create(client, auth_headers, start_time="14:00", end_time="13:00")
        ).status_code == 400
        assert (await _create(client, auth_headers, date="next week")).status_code == 400

    async def test_update_and_delete(self, client, auth_headers):
        slot = (await _create(client, auth_headers)).json()
        headers = auth_headers("director-id")
        updated = await client.patch(
            f"{BASE}/signups/{slot['id']}", json={"capacity": 5, "title": "Strike"}, headers=headers
        )
        assert updated.json()["capacity"] == 5 and updated.json()["title"] == "Strike"
        assert (
            await client.delete(f"{BASE}/signups/{slot['id']}", headers=headers)
        ).status_code == 204
        assert (await client.get(f"{BASE}/signups", headers=headers)).json() == []

    async def test_cannot_lower_spots_below_who_has_signed_up(self, client, auth_headers):
        slot = (await _create(client, auth_headers)).json()
        await client.post(
            f"{BASE}/signups/{slot['id']}/join", headers=auth_headers("cast-member-id")
        )
        await client.post(
            f"{BASE}/signups/{slot['id']}/join", headers=auth_headers("other-cast-user-id")
        )
        response = await client.patch(
            f"{BASE}/signups/{slot['id']}",
            json={"capacity": 1},
            headers=auth_headers("director-id"),
        )
        assert response.status_code == 400


class TestJoining:
    async def test_join_and_leave(self, client, auth_headers):
        slot = (await _create(client, auth_headers)).json()
        headers = auth_headers("cast-member-id")
        joined = await client.post(f"{BASE}/signups/{slot['id']}/join", headers=headers)
        assert joined.status_code == 200
        assert joined.json()["mine"] is True and joined.json()["filled"] == 1
        assert joined.json()["people"][0]["name"] == "Test Cast"
        # joining twice changes nothing
        again = await client.post(f"{BASE}/signups/{slot['id']}/join", headers=headers)
        assert again.json()["filled"] == 1
        assert (
            await client.delete(f"{BASE}/signups/{slot['id']}/join", headers=headers)
        ).status_code == 204
        assert (
            await client.delete(f"{BASE}/signups/{slot['id']}/join", headers=headers)
        ).status_code == 404

    async def test_full_slots_refuse_more_people(self, client, auth_headers):
        slot = (await _create(client, auth_headers, capacity=1)).json()
        await client.post(
            f"{BASE}/signups/{slot['id']}/join", headers=auth_headers("cast-member-id")
        )
        response = await client.post(
            f"{BASE}/signups/{slot['id']}/join", headers=auth_headers("other-cast-user-id")
        )
        assert response.status_code == 409
        assert response.json()["error"] == "FULL"

    async def test_past_slots_cannot_be_joined(self, client, auth_headers):
        slot = (
            await _create(client, auth_headers, date=(date.today() - timedelta(days=2)).isoformat())
        ).json()
        response = await client.post(
            f"{BASE}/signups/{slot['id']}/join", headers=auth_headers("cast-member-id")
        )
        assert response.status_code == 400

    async def test_staff_can_remove_someone(self, client, auth_headers):
        slot = (await _create(client, auth_headers)).json()
        await client.post(
            f"{BASE}/signups/{slot['id']}/join", headers=auth_headers("cast-member-id")
        )
        removed = await client.delete(
            f"{BASE}/signups/{slot['id']}/entries/cast-member-id",
            headers=auth_headers("staff-member-id"),
        )
        assert removed.status_code == 204
        refused = await client.delete(
            f"{BASE}/signups/{slot['id']}/entries/cast-member-id",
            headers=auth_headers("cast-member-id"),
        )
        assert refused.status_code == 403

    async def test_outsiders_cannot_join(self, client, auth_headers):
        slot = (await _create(client, auth_headers)).json()
        assert (
            await client.post(
                f"{BASE}/signups/{slot['id']}/join", headers=auth_headers("outsider-id")
            )
        ).status_code == 403


class TestClashWarnings:
    async def test_two_overlapping_signups_warn_unless_forced(self, client, auth_headers):
        first = (
            await _create(
                client, auth_headers, title="Strike", start_time="10:00", end_time="12:00"
            )
        ).json()
        second = (
            await _create(
                client, auth_headers, title="Painting", start_time="11:00", end_time="14:00"
            )
        ).json()
        headers = auth_headers("cast-member-id")
        await client.post(f"{BASE}/signups/{first['id']}/join", headers=headers)
        clash = await client.post(f"{BASE}/signups/{second['id']}/join", headers=headers)
        assert clash.status_code == 409
        assert clash.json()["error"] == "DOUBLE_BOOKED"
        assert "Strike" in clash.json()["message"]
        forced = await client.post(
            f"{BASE}/signups/{second['id']}/join?force=true", headers=headers
        )
        assert forced.status_code == 200

    async def test_back_to_back_slots_do_not_clash(self, client, auth_headers):
        first = (await _create(client, auth_headers, start_time="10:00", end_time="12:00")).json()
        second = (await _create(client, auth_headers, start_time="12:00", end_time="14:00")).json()
        headers = auth_headers("cast-member-id")
        await client.post(f"{BASE}/signups/{first['id']}/join", headers=headers)
        assert (
            await client.post(f"{BASE}/signups/{second['id']}/join", headers=headers)
        ).status_code == 200

    async def test_signup_that_overlaps_a_call_warns(self, client, auth_headers, db_session):
        rd = await db_session.get(RehearsalDate, str_to_uuid("date-1"))
        slot = (
            await _create(
                client,
                auth_headers,
                date=rd.rehearsal_date.isoformat(),
                start_time="19:00",
                end_time="20:00",
            )
        ).json()
        response = await client.post(
            f"{BASE}/signups/{slot['id']}/join", headers=auth_headers("cast-member-id")
        )
        assert response.status_code == 409
        assert response.json()["error"] == "DOUBLE_BOOKED"

    async def test_staff_are_not_blocked_by_cast_calls(self, client, auth_headers, db_session):
        rd = await db_session.get(RehearsalDate, str_to_uuid("date-1"))
        slot = (
            await _create(
                client,
                auth_headers,
                date=rd.rehearsal_date.isoformat(),
                start_time="19:00",
                end_time="20:00",
            )
        ).json()
        assert (
            await client.post(
                f"{BASE}/signups/{slot['id']}/join", headers=auth_headers("staff-member-id")
            )
        ).status_code == 200


async def _add_date(db_session, day, start, end, location=None, type_="regular"):
    rd = RehearsalDate(
        id=str(uuid.uuid4()),
        production_id=PRODUCTION_ID,
        rehearsal_date=day,
        start_time=time(*start),
        end_time=time(*end),
        type=type_,
        location=location,
    )
    db_session.add(rd)
    await db_session.commit()
    return rd.id


class TestDoubleBookings:
    async def test_clean_schedule_has_no_warnings(self, client, auth_headers):
        response = await client.get(
            f"{BASE}/double-bookings", headers=auth_headers("staff-member-id")
        )
        assert response.status_code == 200
        assert response.json() == []

    async def test_cast_cannot_see_the_report(self, client, auth_headers):
        assert (
            await client.get(f"{BASE}/double-bookings", headers=auth_headers("cast-member-id"))
        ).status_code == 403

    async def test_same_room_at_overlapping_times(self, client, auth_headers, db_session):
        day = date.today() + timedelta(days=200)
        await _add_date(db_session, day, (18, 0), (20, 0), location="Studio A")
        await _add_date(db_session, day, (19, 0), (21, 0), location=" studio a ")
        found = (
            await client.get(f"{BASE}/double-bookings", headers=auth_headers("director-id"))
        ).json()
        rooms = [f for f in found if f["kind"] == "room"]
        assert len(rooms) == 1
        assert rooms[0]["date"] == day.isoformat()

    async def test_different_rooms_or_back_to_back_are_fine(self, client, auth_headers, db_session):
        day = date.today() + timedelta(days=201)
        await _add_date(db_session, day, (18, 0), (20, 0), location="Studio A")
        await _add_date(db_session, day, (18, 0), (20, 0), location="Studio B")
        await _add_date(db_session, day, (20, 0), (22, 0), location="Studio A")
        found = (
            await client.get(f"{BASE}/double-bookings", headers=auth_headers("director-id"))
        ).json()
        assert [f for f in found if f["kind"] == "room"] == []

    async def test_two_full_company_calls_at_once_is_an_overlap(
        self, client, auth_headers, db_session
    ):
        day = date.today() + timedelta(days=202)
        await _add_date(db_session, day, (18, 0), (20, 0))
        await _add_date(db_session, day, (19, 0), (21, 0))
        found = (
            await client.get(f"{BASE}/double-bookings", headers=auth_headers("director-id"))
        ).json()
        assert [f["kind"] for f in found] == ["overlap"]

    async def test_a_person_called_to_two_calls_at_once(self, client, auth_headers, db_session):
        day = date.today() + timedelta(days=203)
        first = await _add_date(db_session, day, (18, 0), (20, 0))
        second = await _add_date(db_session, day, (19, 0), (21, 0))
        for date_id, users in (
            (first, (CAST_USER_ID, OTHER_CAST_USER_ID)),
            (second, (CAST_USER_ID,)),
        ):
            for user_id in users:
                db_session.add(
                    CastAssignment(
                        production_id=PRODUCTION_ID, rehearsal_date_id=date_id, user_id=user_id
                    )
                )
        await db_session.commit()
        found = (
            await client.get(f"{BASE}/double-bookings", headers=auth_headers("director-id"))
        ).json()
        people = [f for f in found if f["kind"] == "person"]
        assert len(people) == 1
        assert [p["name"] for p in people[0]["people"]] == ["Test Cast"]

    async def test_cancelled_and_blocked_dates_are_ignored(self, client, auth_headers, db_session):
        day = date.today() + timedelta(days=204)
        await _add_date(db_session, day, (18, 0), (20, 0), location="Studio A")
        await _add_date(db_session, day, (18, 0), (20, 0), location="Studio A", type_="blocked")
        rd_id = await _add_date(db_session, day, (18, 0), (20, 0), location="Studio A")
        rd = await db_session.get(RehearsalDate, rd_id)
        rd.is_cancelled = True
        await db_session.commit()
        found = (
            await client.get(f"{BASE}/double-bookings", headers=auth_headers("director-id"))
        ).json()
        assert found == []

    async def test_signup_clashing_with_a_call_is_reported(self, client, auth_headers, db_session):
        rd = await db_session.get(RehearsalDate, str_to_uuid("date-1"))
        slot = (
            await _create(
                client,
                auth_headers,
                date=rd.rehearsal_date.isoformat(),
                start_time="19:00",
                end_time="20:00",
            )
        ).json()
        await client.post(
            f"{BASE}/signups/{slot['id']}/join?force=true", headers=auth_headers("cast-member-id")
        )
        found = (
            await client.get(f"{BASE}/double-bookings", headers=auth_headers("director-id"))
        ).json()
        clashes = [f for f in found if f["kind"] == "signup"]
        assert len(clashes) == 1
        assert clashes[0]["slot"]["title"] == "Strike crew"
        assert clashes[0]["people"][0]["name"] == "Test Cast"

    async def test_call_sheet_shows_only_warnings_for_that_call(
        self, client, auth_headers, db_session
    ):
        day = date.today() + timedelta(days=205)
        first = await _add_date(db_session, day, (18, 0), (20, 0), location="Studio A")
        await _add_date(db_session, day, (19, 0), (21, 0), location="Studio A")
        sheet = (
            await client.get(f"{BASE}/call-sheet/{first}", headers=auth_headers("staff-member-id"))
        ).json()
        assert any(w["kind"] == "room" for w in sheet["warnings"])
        other = (
            await client.get(f"{BASE}/call-sheet/date-1", headers=auth_headers("staff-member-id"))
        ).json()
        assert other["warnings"] == []
