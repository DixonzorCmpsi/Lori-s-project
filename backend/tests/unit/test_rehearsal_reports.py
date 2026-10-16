"""Rehearsal reports: drafting, sending to a distribution list and confirming receipt."""

BASE = "/api/productions/prod-id"


def _body(**overrides):
    body = {
        "title": "Rehearsal report #1",
        "report_date": "2026-10-20",
        "rehearsal_date_id": "date-1",
        "sections": {"general": "Ran Act 1.", "props": "Need two more chairs."},
        "distribution": ["director-id", "staff-member-id"],
    }
    body.update(overrides)
    return body


async def _create(client, auth_headers, who="staff-member-id", **overrides):
    return await client.post(f"{BASE}/reports", json=_body(**overrides), headers=auth_headers(who))


class TestCreate:
    async def test_staff_create_a_draft(self, client, auth_headers):
        response = await _create(client, auth_headers)
        assert response.status_code == 201
        data = response.json()
        assert data["status"] == "draft"
        assert data["recipient_count"] == 2
        assert data["author_name"] == "Test Staff"

    async def test_cast_cannot_create(self, client, auth_headers):
        assert (await _create(client, auth_headers, "cast-member-id")).status_code == 403

    async def test_template_lists_departments(self, client, auth_headers):
        data = (
            await client.get(f"{BASE}/reports/template", headers=auth_headers("staff-member-id"))
        ).json()
        keys = [s["key"] for s in data["sections"]]
        assert {"scenic", "props", "costumes", "sound", "lighting", "follow_up"} <= set(keys)

    async def test_unknown_section_is_rejected(self, client, auth_headers):
        response = await _create(client, auth_headers, sections={"catering": "Pizza"})
        assert response.status_code == 400

    async def test_empty_sections_are_dropped(self, client, auth_headers):
        created = (
            await _create(client, auth_headers, sections={"general": "Hi", "props": "   "})
        ).json()
        data = (
            await client.get(
                f"{BASE}/reports/{created['id']}", headers=auth_headers("staff-member-id")
            )
        ).json()
        assert data["sections"] == {"general": "Hi"}

    async def test_distribution_must_be_production_members(self, client, auth_headers):
        response = await _create(client, auth_headers, distribution=["outsider-id"])
        assert response.status_code == 400

    async def test_title_is_required(self, client, auth_headers):
        assert (await _create(client, auth_headers, title="  ")).status_code == 400

    async def test_bad_date_is_rejected(self, client, auth_headers):
        assert (await _create(client, auth_headers, report_date="tomorrow")).status_code == 400


class TestSend:
    async def test_cannot_send_without_recipients_or_notes(self, client, auth_headers):
        headers = auth_headers("staff-member-id")
        empty_dist = (await _create(client, auth_headers, distribution=[])).json()
        assert (
            await client.post(f"{BASE}/reports/{empty_dist['id']}/send", headers=headers)
        ).status_code == 400
        empty_notes = (await _create(client, auth_headers, sections={})).json()
        assert (
            await client.post(f"{BASE}/reports/{empty_notes['id']}/send", headers=headers)
        ).status_code == 400

    async def test_sending_marks_it_sent(self, client, auth_headers):
        created = (await _create(client, auth_headers)).json()
        sent = await client.post(
            f"{BASE}/reports/{created['id']}/send", headers=auth_headers("staff-member-id")
        )
        assert sent.status_code == 200
        assert sent.json()["status"] == "sent"
        assert sent.json()["recipients"] == 2

    async def test_recipients_can_read_only_after_it_is_sent(self, client, auth_headers):
        created = (await _create(client, auth_headers, distribution=["cast-member-id"])).json()
        cast = auth_headers("cast-member-id")
        assert (
            await client.get(f"{BASE}/reports/{created['id']}", headers=cast)
        ).status_code == 403
        assert (await client.get(f"{BASE}/reports", headers=cast)).json() == []

        await client.post(
            f"{BASE}/reports/{created['id']}/send", headers=auth_headers("staff-member-id")
        )
        got = await client.get(f"{BASE}/reports/{created['id']}", headers=cast)
        assert got.status_code == 200
        assert got.json()["my_acknowledged"] is False
        assert "recipients" not in got.json()  # only staff see the confirmation list
        listing = (await client.get(f"{BASE}/reports", headers=cast)).json()
        assert [r["id"] for r in listing] == [created["id"]]

    async def test_people_not_on_the_list_are_refused(self, client, auth_headers):
        created = (await _create(client, auth_headers, distribution=["cast-member-id"])).json()
        await client.post(
            f"{BASE}/reports/{created['id']}/send", headers=auth_headers("staff-member-id")
        )
        response = await client.get(
            f"{BASE}/reports/{created['id']}", headers=auth_headers("other-cast-user-id")
        )
        assert response.status_code == 403


class TestAcknowledge:
    async def test_recipient_confirms_and_staff_see_it(self, client, auth_headers):
        created = (
            await _create(client, auth_headers, distribution=["cast-member-id", "staff-member-id"])
        ).json()
        await client.post(
            f"{BASE}/reports/{created['id']}/send", headers=auth_headers("staff-member-id")
        )
        ack = await client.post(
            f"{BASE}/reports/{created['id']}/ack", headers=auth_headers("cast-member-id")
        )
        assert ack.status_code == 200

        data = (
            await client.get(f"{BASE}/reports/{created['id']}", headers=auth_headers("director-id"))
        ).json()
        by_id = {r["user_id"]: r for r in data["recipients"]}
        assert by_id["cast-member-id"]["acknowledged_at"] is not None
        assert by_id["staff-member-id"]["acknowledged_at"] is None

    async def test_non_recipient_cannot_confirm(self, client, auth_headers):
        created = (await _create(client, auth_headers, distribution=["staff-member-id"])).json()
        await client.post(
            f"{BASE}/reports/{created['id']}/send", headers=auth_headers("staff-member-id")
        )
        response = await client.post(
            f"{BASE}/reports/{created['id']}/ack", headers=auth_headers("cast-member-id")
        )
        assert response.status_code == 403


class TestUpdateDelete:
    async def test_update_title_sections_and_list(self, client, auth_headers):
        created = (await _create(client, auth_headers)).json()
        headers = auth_headers("staff-member-id")
        response = await client.put(
            f"{BASE}/reports/{created['id']}",
            json={
                "title": "Renamed",
                "sections": {"sound": "Mic 4 crackles"},
                "distribution": ["director-id"],
            },
            headers=headers,
        )
        assert response.status_code == 200
        data = (await client.get(f"{BASE}/reports/{created['id']}", headers=headers)).json()
        assert data["title"] == "Renamed"
        assert data["sections"] == {"sound": "Mic 4 crackles"}
        assert data["distribution"] == ["director-id"]

    async def test_staff_cannot_delete_someone_elses_report_but_director_can(
        self, client, auth_headers
    ):
        created = (await _create(client, auth_headers, who="director-id")).json()
        refused = await client.delete(
            f"{BASE}/reports/{created['id']}", headers=auth_headers("staff-member-id")
        )
        assert refused.status_code == 403
        allowed = await client.delete(
            f"{BASE}/reports/{created['id']}", headers=auth_headers("director-id")
        )
        assert allowed.status_code == 204

    async def test_unknown_report_is_404(self, client, auth_headers):
        response = await client.get(
            f"{BASE}/reports/00000000-0000-0000-0000-000000000000",
            headers=auth_headers("staff-member-id"),
        )
        assert response.status_code == 404


class TestAttendanceSnapshot:
    async def test_report_carries_the_attendance_for_its_rehearsal(self, client, auth_headers):
        staff = auth_headers("staff-member-id")
        await client.put(
            f"{BASE}/attendance/date-1/status/cast-member-id?status=late", headers=staff
        )
        await client.put(
            f"{BASE}/attendance/date-1/status/other-cast-user-id?status=absent", headers=staff
        )
        created = (await _create(client, auth_headers)).json()
        data = (await client.get(f"{BASE}/reports/{created['id']}", headers=staff)).json()
        assert [x["name"] for x in data["attendance"]["late"]] == ["Test Cast"]
        assert data["attendance"]["absent"] == ["Other Cast"]

    async def test_snapshot_endpoint_for_the_editor(self, client, auth_headers):
        staff = auth_headers("staff-member-id")
        await client.put(
            f"{BASE}/attendance/date-1/status/cast-member-id?status=excused", headers=staff
        )
        data = (await client.get(f"{BASE}/reports/snapshot/date-1", headers=staff)).json()
        assert data["excused"] == ["Test Cast"]
        assert (
            await client.get(
                f"{BASE}/reports/snapshot/date-1", headers=auth_headers("cast-member-id")
            )
        ).status_code == 403
