"""Scene breakdown, schedule locations and the dashboard attention feed."""

from datetime import date, timedelta

from app.models import CastConflict, ConflictSubmission
from tests.conftest import CAST_USER_ID, PRODUCTION_ID, str_to_uuid

BASE = "/api/productions/prod-id"
DATE_1 = str_to_uuid("date-1")


async def _scene(client, auth_headers, name="Act 1, Scene 1", who="director-id"):
    return await client.post(
        f"{BASE}/scenes", json={"name": name, "order_index": 1}, headers=auth_headers(who)
    )


class TestScenes:
    async def test_create_list_update_delete(self, client, auth_headers):
        created = await _scene(client, auth_headers)
        assert created.status_code == 201
        scene = created.json()
        listing = (
            await client.get(f"{BASE}/scenes", headers=auth_headers("cast-member-id"))
        ).json()
        assert [s["name"] for s in listing] == ["Act 1, Scene 1"]

        headers = auth_headers("staff-member-id")
        patched = await client.patch(
            f"{BASE}/scenes/{scene['id']}",
            json={"name": "Opening", "description": "Village"},
            headers=headers,
        )
        assert patched.json()["name"] == "Opening" and patched.json()["description"] == "Village"
        assert (
            await client.patch(f"{BASE}/scenes/{scene['id']}", json={"name": " "}, headers=headers)
        ).status_code == 400
        assert (
            await client.delete(f"{BASE}/scenes/{scene['id']}", headers=headers)
        ).status_code == 204

    async def test_cast_cannot_manage_scenes(self, client, auth_headers):
        assert (await _scene(client, auth_headers, who="cast-member-id")).status_code == 403

    async def test_outsiders_cannot_list(self, client, auth_headers):
        assert (
            await client.get(f"{BASE}/scenes", headers=auth_headers("outsider-id"))
        ).status_code == 403

    async def test_casting_with_names_and_characters(self, client, auth_headers):
        scene = (await _scene(client, auth_headers)).json()
        headers = auth_headers("director-id")
        added = await client.post(
            f"{BASE}/scenes/{scene['id']}/cast",
            json={"user_id": "cast-member-id", "character_name": "Cinderella"},
            headers=headers,
        )
        assert added.status_code == 201
        dup = await client.post(
            f"{BASE}/scenes/{scene['id']}/cast", json={"user_id": "cast-member-id"}, headers=headers
        )
        assert dup.status_code == 409
        rename = await client.patch(
            f"{BASE}/scenes/{scene['id']}/cast/cast-member-id",
            json={"character_name": "Cindy"},
            headers=headers,
        )
        assert rename.json()["character_name"] == "Cindy"
        listing = (await client.get(f"{BASE}/scenes", headers=headers)).json()
        assert listing[0]["cast"] == [
            {"user_id": "cast-member-id", "name": "Test Cast", "character_name": "Cindy"}
        ]
        assert (
            await client.delete(f"{BASE}/scenes/{scene['id']}/cast/cast-member-id", headers=headers)
        ).status_code == 204
        assert (
            await client.delete(f"{BASE}/scenes/{scene['id']}/cast/cast-member-id", headers=headers)
        ).status_code == 404

    async def test_non_members_cannot_be_cast(self, client, auth_headers):
        scene = (await _scene(client, auth_headers)).json()
        response = await client.post(
            f"{BASE}/scenes/{scene['id']}/cast",
            json={"user_id": "outsider-id"},
            headers=auth_headers("director-id"),
        )
        assert response.status_code == 400

    async def test_availability_per_scene_for_a_date(self, client, auth_headers, db_session):
        easy = (await _scene(client, auth_headers, name="Easy")).json()
        hard = (await _scene(client, auth_headers, name="Hard")).json()
        headers = auth_headers("director-id")
        await client.post(
            f"{BASE}/scenes/{easy['id']}/cast",
            json={"user_id": "other-cast-user-id"},
            headers=headers,
        )
        for who in ("cast-member-id", "other-cast-user-id", "cast-member-1"):
            await client.post(
                f"{BASE}/scenes/{hard['id']}/cast", json={"user_id": who}, headers=headers
            )
        for user_id in (
            CAST_USER_ID,
            str_to_uuid("other-cast-user-id"),
            str_to_uuid("cast-member-1"),
        ):
            submission = ConflictSubmission(production_id=PRODUCTION_ID, user_id=user_id)
            db_session.add(submission)
            await db_session.flush()
            db_session.add(
                CastConflict(
                    production_id=PRODUCTION_ID,
                    user_id=user_id,
                    rehearsal_date_id=str_to_uuid("date-1"),
                    submission_id=submission.id,
                    reason="Away",
                )
            )
        await db_session.commit()

        rows = (
            await client.get(
                f"{BASE}/scenes/availability?rehearsal_date_id={DATE_1}", headers=headers
            )
        ).json()
        by_name = {r["name"]: r for r in rows}
        assert by_name["Easy"]["total_cast"] == 1
        assert by_name["Easy"]["status"] == "yellow"  # its only actor is away
        assert by_name["Hard"]["total_cast"] == 3
        assert by_name["Hard"]["status"] == "red"  # three away
        assert {c["name"] for c in by_name["Hard"]["conflicts"]} >= {"Test Cast", "Other Cast"}
        assert (
            await client.get(
                f"{BASE}/scenes/availability?rehearsal_date_id={DATE_1}",
                headers=auth_headers("cast-member-id"),
            )
        ).status_code == 403


class TestScheduleLocation:
    async def test_add_a_call_with_a_location_and_edit_it(self, client, auth_headers):
        headers = auth_headers("director-id")
        day = (date.today() + timedelta(days=100)).isoformat()
        created = await client.post(
            f"{BASE}/schedule",
            json={
                "date": day,
                "start_time": "18:00",
                "end_time": "21:00",
                "type": "regular",
                "location": "Studio A",
                "note": "Scripts",
            },
            headers=headers,
        )
        assert created.status_code == 201
        assert created.json()["location"] == "Studio A"
        date_id = created.json()["id"]

        patched = await client.patch(
            f"{BASE}/schedule/{date_id}", json={"location": "Main stage"}, headers=headers
        )
        assert patched.json()["location"] == "Main stage"
        listing = (
            await client.get(f"{BASE}/schedule", headers=auth_headers("cast-member-id"))
        ).json()
        assert next(d for d in listing if d["id"] == date_id)["location"] == "Main stage"

        cleared = await client.patch(
            f"{BASE}/schedule/{date_id}", json={"location": ""}, headers=headers
        )
        assert cleared.json()["location"] is None

    async def test_location_length_limit(self, client, auth_headers):
        response = await client.patch(
            f"{BASE}/schedule/date-1",
            json={"location": "x" * 201},
            headers=auth_headers("director-id"),
        )
        assert response.status_code == 400

    async def test_cast_cannot_change_the_location(self, client, auth_headers):
        response = await client.patch(
            f"{BASE}/schedule/date-1",
            json={"location": "Nowhere"},
            headers=auth_headers("cast-member-id"),
        )
        assert response.status_code == 403


class TestAttention:
    async def test_cast_see_what_they_owe(self, client, auth_headers):
        post = (
            await client.post(
                f"{BASE}/bulletin",
                json={"title": "Read me", "body": "Now", "requires_ack": True},
                headers=auth_headers("director-id"),
            )
        ).json()
        form = (
            await client.post(
                f"{BASE}/forms",
                json={
                    "title": "Waiver",
                    "body": "Text",
                    "requires_guardian": False,
                    "audience": "all",
                },
                headers=auth_headers("director-id"),
            )
        ).json()
        data = (
            await client.get(f"{BASE}/attention", headers=auth_headers("cast-member-id"))
        ).json()
        assert [p["id"] for p in data["pending_acks"]] == [post["id"]]
        assert [f["id"] for f in data["forms_to_sign"]] == [form["id"]]
        assert data["next_call"]["id"] == "date-1"
        assert "unconfirmed_posts" not in data

    async def test_staff_see_who_is_still_outstanding(self, client, auth_headers):
        post = (
            await client.post(
                f"{BASE}/bulletin",
                json={"title": "Read me", "body": "Now", "requires_ack": True},
                headers=auth_headers("director-id"),
            )
        ).json()
        await client.post(
            f"{BASE}/bulletin/{post['id']}/ack", headers=auth_headers("cast-member-id")
        )
        await client.post(
            f"{BASE}/attendance/notice",
            json={"rehearsal_date_id": "date-1", "kind": "absent", "note": "Flu"},
            headers=auth_headers("cast-member-id"),
        )
        data = (await client.get(f"{BASE}/attention", headers=auth_headers("director-id"))).json()
        assert data["unconfirmed_posts"][0]["id"] == post["id"]
        assert data["unconfirmed_posts"][0]["pending"] > 0
        assert data["notices"][0]["name"] == "Test Cast" and data["notices"][0]["kind"] == "absent"
        assert data["double_booking_count"] == 0

    async def test_next_call_reflects_check_in_and_notice(self, client, auth_headers):
        headers = auth_headers("cast-member-id")
        await client.post(
            f"{BASE}/attendance/check-in", json={"rehearsal_date_id": "date-1"}, headers=headers
        )
        data = (await client.get(f"{BASE}/attention", headers=headers)).json()
        assert data["next_call"]["my_status"] == "present"

    async def test_next_call_skips_calls_the_cast_member_is_not_in(
        self, client, auth_headers, db_session
    ):
        from app.models import CastAssignment

        db_session.add(
            CastAssignment(
                production_id=PRODUCTION_ID,
                rehearsal_date_id=str_to_uuid("date-1"),
                user_id=str_to_uuid("other-cast-user-id"),
            )
        )
        await db_session.commit()
        data = (
            await client.get(f"{BASE}/attention", headers=auth_headers("cast-member-id"))
        ).json()
        assert data["next_call"]["id"] == "date-2"

    async def test_outsiders_are_refused(self, client, auth_headers):
        assert (
            await client.get(f"{BASE}/attention", headers=auth_headers("outsider-id"))
        ).status_code == 403
