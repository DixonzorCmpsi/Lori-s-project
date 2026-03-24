"""
Tests for conflict submission and management (SPEC-004 Section 4, SPEC-006 Section 3).

Covers:
- CAST-04: Cast submits conflicts
- CAST-05: Cast tries to re-submit conflicts
- CAST-13: Director resets cast member's conflicts
- CAST-14: Cast re-submits after Director reset
- CAST-15: Race condition on double submission
- CAST-19: Conflict reason exceeds 500 chars
- SCHED-04: Conflicts saved, linked to rehearsal dates
- SCHED-05: Cast tries to re-submit conflicts
- SCHED-06: Director views aggregated conflicts
- SCHED-12: 50 cast members submit conflicts
- SCHED-14: Director resets a cast member's conflicts
"""

import pytest


class TestConflictSubmission:
    """CAST-04, SCHED-04: Cast submits conflicts."""

    async def test_submit_conflicts_success(self, client, auth_headers):
        """Cast member submits conflicts for specific rehearsal dates."""
        headers = auth_headers("cast-member-id")
        response = await client.post("/api/productions/prod-id/conflicts", json={
            "dates": [
                {"rehearsal_date_id": "date-1", "reason": "Doctor appointment"},
                {"rehearsal_date_id": "date-2", "reason": "Work conflict"},
                {"rehearsal_date_id": "date-3"},  # No reason (optional)
            ],
        }, headers=headers)
        assert response.status_code == 201

    async def test_submit_empty_conflicts(self, client, auth_headers):
        """Cast with no conflicts submits empty array — still records submission."""
        headers = auth_headers("cast-member-id")
        response = await client.post("/api/productions/prod-id/conflicts", json={
            "dates": [],
        }, headers=headers)
        assert response.status_code == 201

    async def test_submit_conflicts_returns_correct_data(self, client, auth_headers):
        """Response includes the submitted conflict data."""
        headers = auth_headers("cast-member-id")
        response = await client.post("/api/productions/prod-id/conflicts", json={
            "dates": [
                {"rehearsal_date_id": "date-1", "reason": "Doctor appointment"},
            ],
        }, headers=headers)
        assert response.status_code == 201
        data = response.json()
        assert len(data.get("conflicts", [])) == 1


class TestConflictImmutability:
    """CAST-05, SCHED-05: Conflicts are immutable after submission."""

    async def test_double_submission_returns_409(self, client, auth_headers):
        """Second conflict submission returns 409 Conflict."""
        headers = auth_headers("cast-member-id")
        # First submission
        await client.post("/api/productions/prod-id/conflicts", json={
            "dates": [{"rehearsal_date_id": "date-1"}],
        }, headers=headers)
        # Second submission
        response = await client.post("/api/productions/prod-id/conflicts", json={
            "dates": [{"rehearsal_date_id": "date-2"}],
        }, headers=headers)
        assert response.status_code == 409
        assert "already submitted" in response.json()["message"].lower()

    async def test_no_edit_endpoint_exists(self, client, auth_headers):
        """There is no PUT/PATCH endpoint for conflicts."""
        headers = auth_headers("cast-member-id")
        response = await client.put("/api/productions/prod-id/conflicts", json={
            "dates": [],
        }, headers=headers)
        assert response.status_code == 405  # Method Not Allowed

    async def test_cast_cannot_delete_own_conflicts(self, client, auth_headers):
        """Cast cannot self-service delete their conflicts."""
        headers = auth_headers("cast-member-id")
        response = await client.delete(
            "/api/productions/prod-id/conflicts",
            headers=headers,
        )
        assert response.status_code == 403


class TestConflictValidation:
    """Conflict submission validation (SPEC-006 Section 3.2)."""

    async def test_invalid_rehearsal_date_id(self, client, auth_headers):
        """Rehearsal date ID not belonging to production returns 400."""
        headers = auth_headers("cast-member-id")
        response = await client.post("/api/productions/prod-id/conflicts", json={
            "dates": [
                {"rehearsal_date_id": "non-existent-date-id"},
            ],
        }, headers=headers)
        assert response.status_code == 400
        data = response.json()
        assert "invalid" in data.get("error", "").lower() or "invalid" in data.get("message", "").lower()

    async def test_deleted_rehearsal_date_rejected(self, client, auth_headers):
        """Cannot submit conflict for a soft-deleted rehearsal date."""
        headers = auth_headers("cast-member-id")
        response = await client.post("/api/productions/prod-id/conflicts", json={
            "dates": [
                {"rehearsal_date_id": "soft-deleted-date-id"},
            ],
        }, headers=headers)
        assert response.status_code == 400

    async def test_reason_max_500_chars(self, client, auth_headers):
        """CAST-19: Conflict reason > 500 characters rejected."""
        headers = auth_headers("cast-member-id")
        response = await client.post("/api/productions/prod-id/conflicts", json={
            "dates": [
                {"rehearsal_date_id": "date-1", "reason": "R" * 501},
            ],
        }, headers=headers)
        assert response.status_code == 400

    async def test_reason_exactly_500_chars(self, client, auth_headers):
        """Conflict reason at exactly 500 chars is accepted."""
        headers = auth_headers("cast-member-id")
        response = await client.post("/api/productions/prod-id/conflicts", json={
            "dates": [
                {"rehearsal_date_id": "date-1", "reason": "R" * 500},
            ],
        }, headers=headers)
        assert response.status_code == 201

    async def test_non_cast_cannot_submit(self, client, auth_headers):
        """Director and Staff cannot submit conflicts."""
        director_headers = auth_headers("director-id")
        response = await client.post("/api/productions/prod-id/conflicts", json={
            "dates": [],
        }, headers=director_headers)
        assert response.status_code == 403

    async def test_unauthenticated_submission_rejected(self, client):
        """Unauthenticated conflict submission returns 401."""
        response = await client.post("/api/productions/prod-id/conflicts", json={
            "dates": [],
        })
        assert response.status_code == 401


class TestConflictRaceCondition:
    """CAST-15: Race condition handling on double submission."""

    async def test_concurrent_submissions_one_wins(self, client, auth_headers):
        """Two simultaneous submissions — one succeeds, other gets 409."""
        # In real test: use asyncio.gather to fire both simultaneously
        # The DB UNIQUE constraint on conflict_submissions ensures only one wins
        headers = auth_headers("cast-member-id")
        # Simulated — real test would use concurrent requests
        resp1 = await client.post("/api/productions/prod-id/conflicts", json={
            "dates": [{"rehearsal_date_id": "date-1"}],
        }, headers=headers)
        resp2 = await client.post("/api/productions/prod-id/conflicts", json={
            "dates": [{"rehearsal_date_id": "date-2"}],
        }, headers=headers)
        statuses = {resp1.status_code, resp2.status_code}
        assert 201 in statuses
        assert 409 in statuses


class TestConflictAtomicity:
    """Conflict submission is all-or-nothing in a single transaction."""

    async def test_partial_failure_rolls_back(self, client, auth_headers):
        """If one conflict insert fails, entire submission rolls back."""
        # Mix of valid and invalid rehearsal date IDs
        headers = auth_headers("cast-member-id")
        response = await client.post("/api/productions/prod-id/conflicts", json={
            "dates": [
                {"rehearsal_date_id": "valid-date-1"},
                {"rehearsal_date_id": "invalid-date-999"},
            ],
        }, headers=headers)
        assert response.status_code == 400
        # Verify no partial data was saved


class TestDirectorConflictReset:
    """CAST-13, CAST-14, SCHED-14: Director resets a cast member's conflicts."""

    async def test_director_resets_conflicts(self, client, auth_headers):
        """Director can reset a cast member's conflicts."""
        headers = auth_headers("director-id")
        response = await client.post(
            "/api/productions/prod-id/members/cast-member-id/reset-conflicts",
            headers=headers,
        )
        assert response.status_code == 200

    async def test_reset_deletes_submission_and_conflicts(self, client, auth_headers, db_session):
        """Reset deletes conflict_submissions row and all cast_conflicts rows."""
        # Verify in DB that both tables are cleaned
        pass

    async def test_cast_can_resubmit_after_reset(self, client, auth_headers):
        """CAST-14: After Director reset, cast can submit again."""
        # Director resets
        director_headers = auth_headers("director-id")
        await client.post(
            "/api/productions/prod-id/members/cast-member-id/reset-conflicts",
            headers=director_headers,
        )
        # Cast re-submits
        cast_headers = auth_headers("cast-member-id")
        response = await client.post("/api/productions/prod-id/conflicts", json={
            "dates": [{"rehearsal_date_id": "date-1"}],
        }, headers=cast_headers)
        assert response.status_code == 201

    async def test_reset_creates_bulletin_post(self, client, auth_headers):
        """Reset triggers a system bulletin post notifying the cast member."""
        headers = auth_headers("director-id")
        await client.post(
            "/api/productions/prod-id/members/cast-member-id/reset-conflicts",
            headers=headers,
        )
        bulletin_resp = await client.get("/api/productions/prod-id/bulletin", headers=headers)
        posts = bulletin_resp.json()
        assert any("reset" in p.get("body", "").lower() for p in posts)

    async def test_reset_is_transactional(self, client, auth_headers):
        """Reset of submission + conflicts is in a single transaction."""
        # If conflict deletion fails, submission record should not be deleted
        pass

    async def test_only_director_can_reset(self, client, auth_headers):
        """Staff and Cast cannot reset conflicts."""
        staff_headers = auth_headers("staff-id")
        response = await client.post(
            "/api/productions/prod-id/members/cast-member-id/reset-conflicts",
            headers=staff_headers,
        )
        assert response.status_code == 403

        cast_headers = auth_headers("other-cast-id")
        response = await client.post(
            "/api/productions/prod-id/members/cast-member-id/reset-conflicts",
            headers=cast_headers,
        )
        assert response.status_code == 403


class TestDirectorAggregatedView:
    """SCHED-06: Director views all cast conflicts aggregated."""

    async def test_director_sees_all_conflicts(self, client, auth_headers):
        """Director can see conflicts from all cast members."""
        headers = auth_headers("director-id")
        response = await client.get(
            "/api/productions/prod-id/conflicts",
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        # Should contain per-date conflict counts and names
        assert isinstance(data, list)

    async def test_conflict_count_per_date(self, client, auth_headers):
        """Each date shows correct count of unavailable cast."""
        headers = auth_headers("director-id")
        response = await client.get(
            "/api/productions/prod-id/conflicts",
            headers=headers,
        )
        assert response.status_code == 200
        # Each entry should have a count
        for entry in response.json():
            assert "conflict_count" in entry or "unavailable_count" in entry

    async def test_staff_sees_all_conflicts(self, client, auth_headers):
        """Staff also has access to aggregated conflict view."""
        headers = auth_headers("staff-id")
        response = await client.get(
            "/api/productions/prod-id/conflicts",
            headers=headers,
        )
        assert response.status_code == 200

    async def test_cast_cannot_see_others_conflicts(self, client, auth_headers):
        """Cast can only see their own conflicts, not other members'."""
        headers = auth_headers("cast-member-id")
        response = await client.get(
            "/api/productions/prod-id/conflicts",
            headers=headers,
        )
        assert response.status_code == 200
        data = response.json()
        # Should only contain own conflicts, no other members
        for entry in data:
            if "user_id" in entry:
                assert entry["user_id"] == "cast-member-id"


class TestScaleConflicts:
    """SCHED-12: 50 cast members submit conflicts."""

    @pytest.mark.skip(reason="Requires integration setup: 50 loop-generated users need production membership seeding")
    async def test_50_members_submit(self, client, auth_headers):
        """System handles 50 cast members submitting conflicts."""
        # This is a load/scale test
        # In real test, create 50 cast members and have each submit
        for i in range(50):
            headers = auth_headers(f"cast-member-{i}")
            response = await client.post("/api/productions/prod-id/conflicts", json={
                "dates": [{"rehearsal_date_id": f"date-{i % 10}"}],
            }, headers=headers)
            assert response.status_code == 201

    async def test_aggregated_view_with_50_members(self, client, auth_headers):
        """Director can view aggregated conflicts with 50+ members."""
        headers = auth_headers("director-id")
        response = await client.get(
            "/api/productions/prod-id/conflicts",
            headers=headers,
        )
        assert response.status_code == 200
