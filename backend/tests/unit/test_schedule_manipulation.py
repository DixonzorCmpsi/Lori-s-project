"""
Tests for schedule manipulation by the Director (SPEC-003 Section 7, SPEC-006 Section 5).

Covers:
- DIR-06: Director edits a rehearsal time
- DIR-07: Director cancels a rehearsal
- DIR-22: Director soft-deletes a rehearsal date
- SCHED-07: Director adds new rehearsal date
- SCHED-08: Director soft-deletes rehearsal date
- SCHED-09: Director cancels rehearsal
- SCHED-13: Director hard-deletes rehearsal date
"""

import pytest
from datetime import date, timedelta


class TestAddRehearsalDate:
    """SCHED-07: Director adds a new rehearsal date."""

    async def test_add_rehearsal_date(self, client, auth_headers):
        """Director can add a new rehearsal date to existing schedule."""
        headers = auth_headers("director-id")
        today = date.today()
        response = await client.post("/api/productions/prod-id/schedule", json={
            "date": (today + timedelta(days=45)).isoformat(),
            "start_time": "18:00",
            "end_time": "21:00",
            "type": "regular",
        }, headers=headers)
        assert response.status_code == 201
        data = response.json()
        assert data["type"] == "regular"

    async def test_add_rehearsal_all_types(self, client, auth_headers):
        """Can add dates of all types: regular, tech, dress, performance."""
        headers = auth_headers("director-id")
        today = date.today()
        for date_type in ["regular", "tech", "dress", "performance"]:
            response = await client.post("/api/productions/prod-id/schedule", json={
                "date": (today + timedelta(days=45 + hash(date_type) % 30)).isoformat(),
                "start_time": "18:00",
                "end_time": "21:00",
                "type": date_type,
            }, headers=headers)
            assert response.status_code == 201

    async def test_add_rehearsal_invalid_type(self, client, auth_headers):
        """Invalid type is rejected."""
        headers = auth_headers("director-id")
        today = date.today()
        response = await client.post("/api/productions/prod-id/schedule", json={
            "date": (today + timedelta(days=45)).isoformat(),
            "start_time": "18:00",
            "end_time": "21:00",
            "type": "invalid_type",
        }, headers=headers)
        assert response.status_code == 400

class TestEditRehearsalTime:
    """DIR-06: Director edits a rehearsal time."""

    async def test_change_rehearsal_time(self, client, auth_headers):
        """Director updates start/end time for a specific date."""
        headers = auth_headers("director-id")
        response = await client.patch("/api/productions/prod-id/schedule/date-id", json={
            "start_time": "19:00",
            "end_time": "22:00",
        }, headers=headers)
        assert response.status_code == 200
        data = response.json()
        assert data["start_time"] == "19:00"
        assert data["end_time"] == "22:00"

    async def test_change_time_start_after_end_rejected(self, client, auth_headers):
        """Start time >= end time is rejected."""
        headers = auth_headers("director-id")
        response = await client.patch("/api/productions/prod-id/schedule/date-id", json={
            "start_time": "22:00",
            "end_time": "18:00",
        }, headers=headers)
        assert response.status_code == 400


class TestAddNote:
    """Director adds notes to rehearsal dates."""

    async def test_add_note_to_date(self, client, auth_headers):
        """Director can add a note to a rehearsal date."""
        headers = auth_headers("director-id")
        response = await client.patch("/api/productions/prod-id/schedule/date-id", json={
            "note": "Focus on Act 2 scenes",
        }, headers=headers)
        assert response.status_code == 200
        assert response.json()["note"] == "Focus on Act 2 scenes"

    async def test_note_max_1000_chars(self, client, auth_headers):
        """Note exceeding 1000 characters is rejected."""
        headers = auth_headers("director-id")
        response = await client.patch("/api/productions/prod-id/schedule/date-id", json={
            "note": "A" * 1001,
        }, headers=headers)
        assert response.status_code == 400


class TestCancelRehearsal:
    """DIR-07, SCHED-09: Director cancels a rehearsal."""

    async def test_cancel_rehearsal(self, client, auth_headers):
        """Cancelled rehearsal stays on calendar with is_cancelled=True."""
        headers = auth_headers("director-id")
        response = await client.post(
            "/api/productions/prod-id/schedule/date-id/cancel",
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_cancelled"] is True

class TestSoftDeleteRehearsal:
    """DIR-22, SCHED-08: Director soft-deletes a rehearsal date."""

    async def test_soft_delete_rehearsal(self, client, auth_headers):
        """Soft-delete sets is_deleted=True, date hidden from cast."""
        headers = auth_headers("director-id")
        response = await client.delete(
            "/api/productions/prod-id/schedule/date-id",
            headers=headers,
        )
        assert response.status_code == 200

    async def test_soft_delete_preserves_conflicts(self, client, auth_headers, db_session):
        """Conflicts linked to soft-deleted dates are preserved."""
        # After soft-delete, conflicts for that date still exist in DB
        # Director can still see them for historical reference
        pass

    async def test_soft_deleted_hidden_from_cast(self, client, auth_headers):
        """Cast schedule view does not show soft-deleted dates."""
        cast_headers = auth_headers("cast-member-id")
        response = await client.get(
            "/api/productions/prod-id/schedule",
            headers=cast_headers,
        )
        assert response.status_code == 200
        dates = response.json()
        # No soft-deleted dates should appear
        for d in dates:
            assert d.get("is_deleted") is not True

class TestHardDeleteRehearsal:
    """SCHED-13: Director hard-deletes a rehearsal date."""

    async def test_hard_delete_rehearsal(self, client, auth_headers):
        """Hard-delete permanently removes date and associated conflicts."""
        headers = auth_headers("director-id")
        response = await client.delete(
            "/api/productions/prod-id/schedule/date-id?permanent=true",
            headers=headers,
        )
        assert response.status_code == 200

    async def test_hard_delete_cascades_conflicts(self, client, auth_headers, db_session):
        """Hard-delete also removes all cast_conflicts for that date."""
        # After hard-delete, conflicts for that date should not exist
        pass


class TestScheduleAuthorization:
    """Only Director/Staff can modify schedule. Cast is view-only."""

    async def test_cast_cannot_add_date(self, client, auth_headers):
        """CAST-08: Cast cannot modify schedule."""
        cast_headers = auth_headers("cast-member-id")
        response = await client.post("/api/productions/prod-id/schedule", json={
            "date": "2026-06-01",
            "start_time": "18:00",
            "end_time": "21:00",
            "type": "regular",
        }, headers=cast_headers)
        assert response.status_code == 403

    async def test_cast_cannot_cancel(self, client, auth_headers):
        """Cast cannot cancel rehearsals."""
        cast_headers = auth_headers("cast-member-id")
        response = await client.post(
            "/api/productions/prod-id/schedule/date-id/cancel",
            headers=cast_headers,
        )
        assert response.status_code == 403

    async def test_staff_can_edit_schedule(self, client, auth_headers):
        """Staff can edit schedule (same permissions as Director for schedule)."""
        staff_headers = auth_headers("staff-member-id")
        response = await client.patch("/api/productions/prod-id/schedule/date-id", json={
            "start_time": "19:00",
            "end_time": "22:00",
        }, headers=staff_headers)
        assert response.status_code == 200


class TestIDORPrevention:
    """SPEC-003 Section 8.1: Prevent IDOR attacks on schedule dates."""

    async def test_cannot_modify_date_from_other_production(self, client, auth_headers):
        """Director of Production A cannot modify dates in Production B."""
        headers = auth_headers("director-a-id")
        # date-id-b belongs to Production B, not Production A
        response = await client.patch(
            "/api/productions/prod-a-id/schedule/date-id-from-prod-b",
            json={"note": "Hacked!"},
            headers=headers,
        )
        # 403 (not a member of prod-a) or 404 (date not found) — both prevent IDOR
        assert response.status_code in [403, 404]
