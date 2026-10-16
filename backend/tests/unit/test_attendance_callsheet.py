"""Attendance, call sheets, late/absent notices and the per-person attendance report."""

import uuid
from datetime import date, time, timedelta

import pytest

from app.models import CastAssignment, RehearsalDate
from tests.conftest import CAST_USER_ID, PRODUCTION_ID

BASE = "/api/productions/prod-id"


async def _past_date(db_session, days_ago=3, start=(18, 0), end=(21, 0)):
    rd = RehearsalDate(
        id=str(uuid.uuid4()),
        production_id=PRODUCTION_ID,
        rehearsal_date=date.today() - timedelta(days=days_ago),
        start_time=time(*start),
        end_time=time(*end),
        type="regular",
    )
    db_session.add(rd)
    await db_session.commit()
    return rd.id


class TestCheckIn:
    async def test_cast_checks_in_once(self, client, auth_headers):
        headers = auth_headers("cast-member-id")
        first = await client.post(
            f"{BASE}/attendance/check-in", json={"rehearsal_date_id": "date-1"}, headers=headers
        )
        assert first.status_code == 201
        assert first.json()["status"] == "present"
        assert first.json()["already_checked_in"] is False
        again = await client.post(
            f"{BASE}/attendance/check-in", json={"rehearsal_date_id": "date-1"}, headers=headers
        )
        assert again.json()["already_checked_in"] is True

    async def test_outsider_cannot_check_in(self, client, auth_headers):
        response = await client.post(
            f"{BASE}/attendance/check-in",
            json={"rehearsal_date_id": "date-1"},
            headers=auth_headers("outsider-id"),
        )
        assert response.status_code == 403

    async def test_unknown_date_is_404(self, client, auth_headers):
        response = await client.post(
            f"{BASE}/attendance/check-in",
            json={"rehearsal_date_id": str(uuid.uuid4())},
            headers=auth_headers("cast-member-id"),
        )
        assert response.status_code == 404


class TestMarking:
    async def test_staff_can_mark_before_check_in(self, client, auth_headers):
        response = await client.put(
            f"{BASE}/attendance/date-1/status/cast-member-id?status=absent",
            headers=auth_headers("staff-member-id"),
        )
        assert response.status_code == 200
        sheet = (
            await client.get(f"{BASE}/call-sheet/date-1", headers=auth_headers("staff-member-id"))
        ).json()
        row = next(c for c in sheet["called"] if c["user_id"] == "cast-member-id")
        assert row["status"] == "absent"

    async def test_invalid_status_is_rejected(self, client, auth_headers):
        response = await client.put(
            f"{BASE}/attendance/date-1/status/cast-member-id?status=vacation",
            headers=auth_headers("staff-member-id"),
        )
        assert response.status_code == 400

    async def test_cast_cannot_mark_others(self, client, auth_headers):
        response = await client.put(
            f"{BASE}/attendance/date-1/status/other-cast-user-id?status=present",
            headers=auth_headers("cast-member-id"),
        )
        assert response.status_code == 403

    async def test_clearing_a_mark(self, client, auth_headers):
        headers = auth_headers("staff-member-id")
        await client.put(
            f"{BASE}/attendance/date-1/status/cast-member-id?status=late", headers=headers
        )
        cleared = await client.delete(
            f"{BASE}/attendance/date-1/status/cast-member-id", headers=headers
        )
        assert cleared.status_code == 204
        sheet = (await client.get(f"{BASE}/call-sheet/date-1", headers=headers)).json()
        row = next(c for c in sheet["called"] if c["user_id"] == "cast-member-id")
        assert row["status"] is None

    async def test_staff_attendance_view_lists_names(self, client, auth_headers):
        headers = auth_headers("staff-member-id")
        await client.put(
            f"{BASE}/attendance/date-1/status/cast-member-id?status=present", headers=headers
        )
        data = (await client.get(f"{BASE}/attendance/date-1", headers=headers)).json()
        assert data["checked_in"][0]["name"] == "Test Cast"
        assert data["total_checked_in"] == 1
        assert all(p["name"] for p in data["not_checked_in"])

    async def test_cast_attendance_view_is_only_their_own(self, client, auth_headers):
        data = (
            await client.get(f"{BASE}/attendance/date-1", headers=auth_headers("cast-member-id"))
        ).json()
        assert data["checked_in"] is False
        assert "not_checked_in" not in data


class TestCallSheet:
    async def test_no_assignments_means_full_company(self, client, auth_headers):
        sheet = (
            await client.get(f"{BASE}/call-sheet/date-1", headers=auth_headers("staff-member-id"))
        ).json()
        assert sheet["full_company"] is True
        ids = {c["user_id"] for c in sheet["called"]}
        assert {"cast-member-id", "other-cast-user-id"} <= ids
        assert "director-id" not in ids
        assert sheet["summary"]["called"] == len(sheet["called"])
        assert sheet["summary"]["unmarked"] == len(sheet["called"])

    async def test_assignments_narrow_the_call(self, client, auth_headers, db_session):
        db_session.add(
            CastAssignment(
                production_id=PRODUCTION_ID,
                rehearsal_date_id=(await _lookup_date(db_session, "date-1")),
                user_id=CAST_USER_ID,
            )
        )
        await db_session.commit()
        sheet = (
            await client.get(f"{BASE}/call-sheet/date-1", headers=auth_headers("staff-member-id"))
        ).json()
        assert sheet["full_company"] is False
        assert [c["user_id"] for c in sheet["called"]] == ["cast-member-id"]

        mine = (
            await client.get(f"{BASE}/call-sheet/date-1", headers=auth_headers("cast-member-id"))
        ).json()
        other = (
            await client.get(
                f"{BASE}/call-sheet/date-1", headers=auth_headers("other-cast-user-id")
            )
        ).json()
        assert mine["my"]["called"] is True
        assert other["my"]["called"] is False

    async def test_cast_see_names_but_not_other_peoples_status(self, client, auth_headers):
        await client.put(
            f"{BASE}/attendance/date-1/status/other-cast-user-id?status=absent",
            headers=auth_headers("staff-member-id"),
        )
        sheet = (
            await client.get(f"{BASE}/call-sheet/date-1", headers=auth_headers("cast-member-id"))
        ).json()
        assert all("status" not in c for c in sheet["called"])
        assert "summary" not in sheet and "warnings" not in sheet

    async def test_outsider_is_refused(self, client, auth_headers):
        response = await client.get(
            f"{BASE}/call-sheet/date-1", headers=auth_headers("outsider-id")
        )
        assert response.status_code == 403


class TestNotices:
    async def test_late_notice_shows_on_the_call_sheet(self, client, auth_headers):
        response = await client.post(
            f"{BASE}/attendance/notice",
            json={"rehearsal_date_id": "date-1", "kind": "late", "minutes_late": 20, "note": "Bus"},
            headers=auth_headers("cast-member-id"),
        )
        assert response.status_code == 201
        sheet = (
            await client.get(f"{BASE}/call-sheet/date-1", headers=auth_headers("staff-member-id"))
        ).json()
        row = next(c for c in sheet["called"] if c["user_id"] == "cast-member-id")
        assert row["notice"]["kind"] == "late"
        assert row["notice"]["minutes_late"] == 20
        assert sheet["summary"]["notices"] == 1

    async def test_a_second_notice_replaces_the_first(self, client, auth_headers):
        headers = auth_headers("cast-member-id")
        await client.post(
            f"{BASE}/attendance/notice",
            json={"rehearsal_date_id": "date-1", "kind": "late", "minutes_late": 10},
            headers=headers,
        )
        await client.post(
            f"{BASE}/attendance/notice",
            json={"rehearsal_date_id": "date-1", "kind": "absent"},
            headers=headers,
        )
        mine = (await client.get(f"{BASE}/call-sheet/date-1", headers=headers)).json()["my"]
        assert mine["notice"]["kind"] == "absent"
        assert mine["notice"]["minutes_late"] is None

    @pytest.mark.parametrize(
        "payload",
        [
            {"kind": "vacation"},
            {"kind": "late"},
            {"kind": "late", "minutes_late": 0},
            {"kind": "late", "minutes_late": 500},
            {"kind": "absent", "note": "x" * 501},
        ],
    )
    async def test_bad_notices_are_rejected(self, client, auth_headers, payload):
        response = await client.post(
            f"{BASE}/attendance/notice",
            json={"rehearsal_date_id": "date-1", **payload},
            headers=auth_headers("cast-member-id"),
        )
        assert response.status_code == 400

    async def test_cannot_send_a_notice_for_a_past_rehearsal(
        self, client, auth_headers, db_session
    ):
        past = await _past_date(db_session, days_ago=5)
        response = await client.post(
            f"{BASE}/attendance/notice",
            json={"rehearsal_date_id": past, "kind": "absent"},
            headers=auth_headers("cast-member-id"),
        )
        assert response.status_code == 400

    async def test_withdrawing_a_notice(self, client, auth_headers):
        headers = auth_headers("cast-member-id")
        await client.post(
            f"{BASE}/attendance/notice",
            json={"rehearsal_date_id": "date-1", "kind": "absent"},
            headers=headers,
        )
        assert (
            await client.delete(f"{BASE}/attendance/notice/date-1", headers=headers)
        ).status_code == 204
        assert (
            await client.delete(f"{BASE}/attendance/notice/date-1", headers=headers)
        ).status_code == 404


class TestReports:
    async def test_by_member_totals_and_rate(self, client, auth_headers, db_session):
        first = await _past_date(db_session, 4)
        second = await _past_date(db_session, 3)
        third = await _past_date(db_session, 2)
        headers = auth_headers("staff-member-id")
        for date_id, status in ((first, "present"), (second, "late"), (third, "absent")):
            await client.put(
                f"{BASE}/attendance/{date_id}/status/cast-member-id?status={status}",
                headers=headers,
            )

        rows = (await client.get(f"{BASE}/attendance/by-member", headers=headers)).json()
        row = next(r for r in rows if r["user_id"] == "cast-member-id")
        assert row["called"] == 3
        assert (row["present"], row["late"], row["absent"]) == (1, 1, 1)
        assert row["rate"] == 67  # (present + late) / called
        other = next(r for r in rows if r["user_id"] == "other-cast-user-id")
        assert other["unmarked"] == 3 and other["rate"] == 0

    async def test_excused_absences_do_not_hurt_the_rate(self, client, auth_headers, db_session):
        first = await _past_date(db_session, 3)
        second = await _past_date(db_session, 2)
        headers = auth_headers("staff-member-id")
        await client.put(
            f"{BASE}/attendance/{first}/status/cast-member-id?status=present", headers=headers
        )
        await client.put(
            f"{BASE}/attendance/{second}/status/cast-member-id?status=excused", headers=headers
        )
        rows = (await client.get(f"{BASE}/attendance/by-member", headers=headers)).json()
        row = next(r for r in rows if r["user_id"] == "cast-member-id")
        assert row["rate"] == 100

    async def test_by_member_is_staff_only(self, client, auth_headers):
        response = await client.get(
            f"{BASE}/attendance/by-member", headers=auth_headers("cast-member-id")
        )
        assert response.status_code == 403

    async def test_summary_per_date(self, client, auth_headers):
        headers = auth_headers("staff-member-id")
        await client.put(
            f"{BASE}/attendance/date-1/status/cast-member-id?status=present", headers=headers
        )
        rows = (await client.get(f"{BASE}/attendance", headers=headers)).json()
        row = next(r for r in rows if r["rehearsal_date_id"] == "date-1")
        assert row["checked_in"] == 1 and row["total"] >= 2


async def _lookup_date(db_session, raw):
    from tests.conftest import str_to_uuid

    return str_to_uuid(raw)
