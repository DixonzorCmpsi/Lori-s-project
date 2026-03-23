"""
Spec validation tests for the spec optimizer.

These tests validate that the specs are unambiguous and complete by testing
pure functions extracted from the spec requirements. The coder agent
generates an implementation.py from the specs, and these tests validate it.

Tests cover:
- Schedule generation algorithm (deterministic, pure function)
- Age gate logic (COPPA compliance)
- Password validation (breached list, length)
- Permission matrix (role-based access decisions)
- Conflict submission rules
- Date validation (production date ordering)
- Markdown sanitization rules
- Chat boundary rules
- Invite token validation
- Field length constraints
"""

import pytest
from datetime import date, time, timedelta
from implementation import (
    generate_schedule,
    check_age_gate,
    derive_age_range,
    validate_password,
    check_permission,
    validate_production_dates,
    sanitize_markdown,
    can_send_message,
    validate_invite_token,
    validate_field_lengths,
)


# =====================================================================
# SCHEDULE GENERATION (SPEC-003 Section 5, SPEC-006 Section 2)
# =====================================================================

class TestScheduleGeneration:
    """Schedule generation must be deterministic and follow exact rules."""

    def test_basic_schedule(self):
        """Regular rehearsals on selected days only."""
        result = generate_schedule(
            first_rehearsal=date(2026, 4, 6),    # Monday
            opening_night=date(2026, 4, 20),      # Monday
            closing_night=date(2026, 4, 26),
            selected_days=["monday", "wednesday", "friday"],
            start_time=time(18, 0),
            end_time=time(21, 0),
            blocked_dates=[],
            tech_week_enabled=False,
            tech_week_days=0,
            dress_rehearsal_enabled=False,
        )
        assert "error" not in result
        dates = result["dates"]
        assert len(dates) > 0
        # All regular dates should be Mon, Wed, or Fri
        for d in dates:
            if d["type"] == "regular":
                day_name = d["date"].strftime("%A").lower()
                assert day_name in ["monday", "wednesday", "friday"]

    def test_deterministic(self):
        """Same inputs produce identical output."""
        kwargs = dict(
            first_rehearsal=date(2026, 4, 6),
            opening_night=date(2026, 5, 4),
            closing_night=date(2026, 5, 10),
            selected_days=["monday", "wednesday", "friday"],
            start_time=time(18, 0),
            end_time=time(21, 0),
            blocked_dates=[],
            tech_week_enabled=True,
            tech_week_days=5,
            dress_rehearsal_enabled=True,
        )
        r1 = generate_schedule(**kwargs)
        r2 = generate_schedule(**kwargs)
        assert r1 == r2

    def test_blocked_dates_excluded(self):
        """Blocked dates do not appear in output."""
        blocked = date(2026, 4, 8)  # Wednesday
        result = generate_schedule(
            first_rehearsal=date(2026, 4, 6),
            opening_night=date(2026, 4, 20),
            closing_night=date(2026, 4, 26),
            selected_days=["monday", "wednesday", "friday"],
            start_time=time(18, 0),
            end_time=time(21, 0),
            blocked_dates=[blocked],
            tech_week_enabled=False,
            tech_week_days=0,
            dress_rehearsal_enabled=False,
        )
        assert blocked not in [d["date"] for d in result["dates"]]

    def test_tech_week_overrides_day_filter(self):
        """Tech week includes all days, not just selected weekdays."""
        result = generate_schedule(
            first_rehearsal=date(2026, 4, 6),
            opening_night=date(2026, 5, 4),
            closing_night=date(2026, 5, 10),
            selected_days=["monday"],  # Only Monday
            start_time=time(18, 0),
            end_time=time(21, 0),
            blocked_dates=[],
            tech_week_enabled=True,
            tech_week_days=5,
            dress_rehearsal_enabled=False,
        )
        tech = [d for d in result["dates"] if d["type"] == "tech"]
        assert len(tech) == 5  # All 5 days, not just Mondays

    def test_tech_week_consecutive_before_opening(self):
        """Tech week: N consecutive days ending day before opening."""
        result = generate_schedule(
            first_rehearsal=date(2026, 4, 6),
            opening_night=date(2026, 5, 4),
            closing_night=date(2026, 5, 10),
            selected_days=["monday", "wednesday", "friday"],
            start_time=time(18, 0),
            end_time=time(21, 0),
            blocked_dates=[],
            tech_week_enabled=True,
            tech_week_days=5,
            dress_rehearsal_enabled=False,
        )
        tech = sorted([d for d in result["dates"] if d["type"] == "tech"], key=lambda x: x["date"])
        # Last tech day should be May 3 (day before May 4 opening)
        assert tech[-1]["date"] == date(2026, 5, 3)
        # First tech day should be Apr 29
        assert tech[0]["date"] == date(2026, 4, 29)

    def test_blocked_date_in_tech_week_skipped(self):
        """Blocked date within tech week is skipped with warning."""
        blocked = date(2026, 5, 1)
        result = generate_schedule(
            first_rehearsal=date(2026, 4, 6),
            opening_night=date(2026, 5, 4),
            closing_night=date(2026, 5, 10),
            selected_days=["monday", "wednesday", "friday"],
            start_time=time(18, 0),
            end_time=time(21, 0),
            blocked_dates=[blocked],
            tech_week_enabled=True,
            tech_week_days=5,
            dress_rehearsal_enabled=False,
        )
        tech = [d for d in result["dates"] if d["type"] == "tech"]
        assert blocked not in [d["date"] for d in tech]
        assert len(tech) == 4  # 5 minus 1 blocked
        assert any(str(blocked) in w for w in result.get("warnings", []))

    def test_tech_week_clamped_to_first_rehearsal(self):
        """Tech week cannot start before first_rehearsal."""
        result = generate_schedule(
            first_rehearsal=date(2026, 5, 1),
            opening_night=date(2026, 5, 4),
            closing_night=date(2026, 5, 10),
            selected_days=["monday", "wednesday", "friday"],
            start_time=time(18, 0),
            end_time=time(21, 0),
            blocked_dates=[],
            tech_week_enabled=True,
            tech_week_days=10,  # Would go way before first_rehearsal
            dress_rehearsal_enabled=False,
        )
        for d in result["dates"]:
            if d["type"] in ("tech", "dress"):
                assert d["date"] >= date(2026, 5, 1)

    def test_dress_rehearsal_is_last_tech_day(self):
        """Dress rehearsal: last day of tech week, exactly 1 day."""
        result = generate_schedule(
            first_rehearsal=date(2026, 4, 6),
            opening_night=date(2026, 5, 4),
            closing_night=date(2026, 5, 10),
            selected_days=["monday", "wednesday", "friday"],
            start_time=time(18, 0),
            end_time=time(21, 0),
            blocked_dates=[],
            tech_week_enabled=True,
            tech_week_days=5,
            dress_rehearsal_enabled=True,
        )
        dress = [d for d in result["dates"] if d["type"] == "dress"]
        assert len(dress) == 1
        assert dress[0]["date"] == date(2026, 5, 3)  # Day before opening

    def test_dress_without_tech_ignored(self):
        """Dress rehearsal requires tech week. No tech = no dress."""
        result = generate_schedule(
            first_rehearsal=date(2026, 4, 6),
            opening_night=date(2026, 5, 4),
            closing_night=date(2026, 5, 10),
            selected_days=["monday", "wednesday", "friday"],
            start_time=time(18, 0),
            end_time=time(21, 0),
            blocked_dates=[],
            tech_week_enabled=False,
            tech_week_days=0,
            dress_rehearsal_enabled=True,
        )
        dress = [d for d in result["dates"] if d["type"] == "dress"]
        assert len(dress) == 0

    def test_performance_dates(self):
        """Performance dates: opening_night to closing_night inclusive."""
        result = generate_schedule(
            first_rehearsal=date(2026, 4, 6),
            opening_night=date(2026, 5, 4),
            closing_night=date(2026, 5, 10),
            selected_days=["monday", "wednesday", "friday"],
            start_time=time(18, 0),
            end_time=time(21, 0),
            blocked_dates=[],
            tech_week_enabled=False,
            tech_week_days=0,
            dress_rehearsal_enabled=False,
        )
        perf = [d for d in result["dates"] if d["type"] == "performance"]
        perf_dates = [d["date"] for d in perf]
        assert date(2026, 5, 4) in perf_dates
        assert date(2026, 5, 10) in perf_dates
        assert len(perf) == 7

    def test_blocked_performance_date_excluded(self):
        """Blocked dates during performance period are excluded."""
        blocked = date(2026, 5, 7)
        result = generate_schedule(
            first_rehearsal=date(2026, 4, 6),
            opening_night=date(2026, 5, 4),
            closing_night=date(2026, 5, 10),
            selected_days=["monday", "wednesday", "friday"],
            start_time=time(18, 0),
            end_time=time(21, 0),
            blocked_dates=[blocked],
            tech_week_enabled=False,
            tech_week_days=0,
            dress_rehearsal_enabled=False,
        )
        perf = [d for d in result["dates"] if d["type"] == "performance"]
        assert blocked not in [d["date"] for d in perf]

    def test_dates_sorted_ascending(self):
        """All output dates sorted ascending."""
        result = generate_schedule(
            first_rehearsal=date(2026, 4, 6),
            opening_night=date(2026, 5, 4),
            closing_night=date(2026, 5, 10),
            selected_days=["monday", "wednesday", "friday"],
            start_time=time(18, 0),
            end_time=time(21, 0),
            blocked_dates=[],
            tech_week_enabled=True,
            tech_week_days=5,
            dress_rehearsal_enabled=True,
        )
        date_values = [d["date"] for d in result["dates"]]
        assert date_values == sorted(date_values)

    def test_empty_schedule_error(self):
        """All dates blocked → error returned."""
        first = date(2026, 4, 6)
        opening = date(2026, 4, 13)
        closing = date(2026, 4, 19)
        blocked = [first + timedelta(days=i) for i in range(20)]
        result = generate_schedule(
            first_rehearsal=first,
            opening_night=opening,
            closing_night=closing,
            selected_days=["monday", "wednesday", "friday"],
            start_time=time(18, 0),
            end_time=time(21, 0),
            blocked_dates=blocked,
            tech_week_enabled=False,
            tech_week_days=0,
            dress_rehearsal_enabled=False,
        )
        assert "error" in result

    def test_start_after_end_error(self):
        """start_time >= end_time → error."""
        result = generate_schedule(
            first_rehearsal=date(2026, 4, 6),
            opening_night=date(2026, 5, 4),
            closing_night=date(2026, 5, 10),
            selected_days=["monday"],
            start_time=time(21, 0),
            end_time=time(18, 0),
            blocked_dates=[],
            tech_week_enabled=False,
            tech_week_days=0,
            dress_rehearsal_enabled=False,
        )
        assert "error" in result

    def test_all_dates_have_correct_times(self):
        """Every date has the specified start and end times."""
        result = generate_schedule(
            first_rehearsal=date(2026, 4, 6),
            opening_night=date(2026, 4, 20),
            closing_night=date(2026, 4, 26),
            selected_days=["monday", "wednesday", "friday"],
            start_time=time(18, 30),
            end_time=time(21, 15),
            blocked_dates=[],
            tech_week_enabled=False,
            tech_week_days=0,
            dress_rehearsal_enabled=False,
        )
        for d in result["dates"]:
            assert d["start_time"] == time(18, 30)
            assert d["end_time"] == time(21, 15)

    def test_tech_replaces_regular(self):
        """Regular date during tech week becomes tech type."""
        result = generate_schedule(
            first_rehearsal=date(2026, 4, 6),
            opening_night=date(2026, 5, 4),
            closing_night=date(2026, 5, 10),
            selected_days=["monday", "wednesday", "friday"],
            start_time=time(18, 0),
            end_time=time(21, 0),
            blocked_dates=[],
            tech_week_enabled=True,
            tech_week_days=5,
            dress_rehearsal_enabled=False,
        )
        tech_start = date(2026, 4, 29)
        tech_end = date(2026, 5, 3)
        for d in result["dates"]:
            if tech_start <= d["date"] <= tech_end:
                assert d["type"] in ("tech", "dress")


# =====================================================================
# AGE GATE (SPEC-001 Section 7.1, SPEC-002 Section 2.3)
# =====================================================================

class TestAgeGate:
    """Age gate: block under 13, derive age_range, never store raw DOB."""

    def test_under_13_blocked(self):
        """User under 13 returns blocked=True."""
        result = check_age_gate(date(2015, 6, 1), reference_date=date(2026, 3, 23))
        assert result["allowed"] is False

    def test_exactly_13_allowed(self):
        """User exactly 13 today is allowed."""
        ref = date(2026, 3, 23)
        dob = date(2013, 3, 23)
        result = check_age_gate(dob, reference_date=ref)
        assert result["allowed"] is True

    def test_day_before_13_blocked(self):
        """User who turns 13 tomorrow is blocked."""
        ref = date(2026, 3, 23)
        dob = date(2013, 3, 24)
        result = check_age_gate(dob, reference_date=ref)
        assert result["allowed"] is False

    def test_age_range_teen(self):
        """13-17 year old gets age_range='13-17'."""
        result = derive_age_range(date(2010, 6, 1), reference_date=date(2026, 3, 23))
        assert result == "13-17"

    def test_age_range_adult(self):
        """18+ year old gets age_range='18+'."""
        result = derive_age_range(date(1990, 1, 1), reference_date=date(2026, 3, 23))
        assert result == "18+"

    def test_exactly_18_adult(self):
        """User exactly 18 today is '18+'."""
        ref = date(2026, 3, 23)
        dob = date(2008, 3, 23)
        result = derive_age_range(dob, reference_date=ref)
        assert result == "18+"


# =====================================================================
# PASSWORD VALIDATION (SPEC-002 Section 2.2)
# =====================================================================

class TestPasswordValidation:
    """Password rules: min 8 chars, no breached passwords, no complexity."""

    def test_valid_password(self):
        result = validate_password("alllowercasebutlong")
        assert result["valid"] is True

    def test_too_short(self):
        result = validate_password("short")
        assert result["valid"] is False
        assert "8" in result["reason"]

    def test_breached_password(self):
        result = validate_password("password")
        assert result["valid"] is False
        assert "common" in result["reason"].lower() or "breach" in result["reason"].lower()

    def test_breached_case_insensitive(self):
        result = validate_password("PASSWORD")
        assert result["valid"] is False

    def test_no_complexity_rules(self):
        """No uppercase/number rules — only length + breach check."""
        result = validate_password("onlylowercaseletters")
        assert result["valid"] is True


# =====================================================================
# PERMISSION MATRIX (SPEC-002 Section 3.2)
# =====================================================================

class TestPermissions:
    """Full RBAC permission matrix — every action for every role."""

    def test_director_create_theater(self):
        assert check_permission("director", "create_theater") is True

    def test_staff_cannot_create_theater(self):
        assert check_permission("staff", "create_theater") is False

    def test_cast_cannot_create_theater(self):
        assert check_permission("cast", "create_theater") is False

    def test_director_create_production(self):
        assert check_permission("director", "create_production") is True

    def test_staff_cannot_create_production(self):
        assert check_permission("staff", "create_production") is False

    def test_cast_cannot_create_production(self):
        assert check_permission("cast", "create_production") is False

    def test_director_edit_production(self):
        assert check_permission("director", "edit_production") is True

    def test_staff_edit_production(self):
        assert check_permission("staff", "edit_production") is True

    def test_cast_cannot_edit_production(self):
        assert check_permission("cast", "edit_production") is False

    def test_director_edit_schedule(self):
        assert check_permission("director", "edit_schedule") is True

    def test_staff_edit_schedule(self):
        assert check_permission("staff", "edit_schedule") is True

    def test_cast_cannot_edit_schedule(self):
        assert check_permission("cast", "edit_schedule") is False

    def test_director_post_bulletin(self):
        assert check_permission("director", "post_bulletin") is True

    def test_staff_post_bulletin(self):
        assert check_permission("staff", "post_bulletin") is True

    def test_cast_cannot_post_bulletin(self):
        assert check_permission("cast", "post_bulletin") is False

    def test_all_view_bulletin(self):
        assert check_permission("director", "view_bulletin") is True
        assert check_permission("staff", "view_bulletin") is True
        assert check_permission("cast", "view_bulletin") is True

    def test_director_view_all_conflicts(self):
        assert check_permission("director", "view_all_conflicts") is True

    def test_staff_view_all_conflicts(self):
        assert check_permission("staff", "view_all_conflicts") is True

    def test_cast_cannot_view_all_conflicts(self):
        assert check_permission("cast", "view_all_conflicts") is False

    def test_only_cast_submits_conflicts(self):
        assert check_permission("cast", "submit_conflicts") is True
        assert check_permission("director", "submit_conflicts") is False
        assert check_permission("staff", "submit_conflicts") is False

    def test_director_elevate_cast(self):
        assert check_permission("director", "elevate_cast") is True

    def test_staff_cannot_elevate(self):
        assert check_permission("staff", "elevate_cast") is False

    def test_cast_cannot_elevate(self):
        assert check_permission("cast", "elevate_cast") is False

    def test_director_remove_member(self):
        assert check_permission("director", "remove_member") is True

    def test_staff_cannot_remove(self):
        assert check_permission("staff", "remove_member") is False

    def test_cast_cannot_remove(self):
        assert check_permission("cast", "remove_member") is False

    def test_director_generate_invite(self):
        assert check_permission("director", "generate_invite") is True

    def test_staff_generate_invite(self):
        assert check_permission("staff", "generate_invite") is True

    def test_cast_cannot_generate_invite(self):
        assert check_permission("cast", "generate_invite") is False

    def test_director_delete_production(self):
        assert check_permission("director", "delete_production") is True

    def test_staff_cannot_delete_production(self):
        assert check_permission("staff", "delete_production") is False

    def test_cast_cannot_delete_production(self):
        assert check_permission("cast", "delete_production") is False

    def test_director_reset_conflicts(self):
        assert check_permission("director", "reset_conflicts") is True

    def test_staff_cannot_reset_conflicts(self):
        assert check_permission("staff", "reset_conflicts") is False

    def test_cast_cannot_reset_conflicts(self):
        assert check_permission("cast", "reset_conflicts") is False


# =====================================================================
# CHAT BOUNDARY RULES (SPEC-005 Section 2)
# =====================================================================

class TestChatBoundaries:
    """Cast-to-cast is blocked. Director/Staff can message anyone."""

    def test_director_to_cast(self):
        assert can_send_message("director", "cast") is True

    def test_director_to_staff(self):
        assert can_send_message("director", "staff") is True

    def test_staff_to_cast(self):
        assert can_send_message("staff", "cast") is True

    def test_staff_to_director(self):
        assert can_send_message("staff", "director") is True

    def test_cast_to_director(self):
        assert can_send_message("cast", "director") is True

    def test_cast_to_staff(self):
        assert can_send_message("cast", "staff") is True

    def test_cast_to_cast_blocked(self):
        assert can_send_message("cast", "cast") is False


# =====================================================================
# DATE VALIDATION (SPEC-003 Section 4)
# =====================================================================

class TestDateValidation:
    """first_rehearsal <= opening_night <= closing_night."""

    def test_valid_dates(self):
        result = validate_production_dates(
            first_rehearsal=date(2026, 4, 1),
            opening_night=date(2026, 6, 1),
            closing_night=date(2026, 6, 7),
        )
        assert result["valid"] is True

    def test_first_after_opening_invalid(self):
        result = validate_production_dates(
            first_rehearsal=date(2026, 7, 1),
            opening_night=date(2026, 6, 1),
            closing_night=date(2026, 6, 7),
        )
        assert result["valid"] is False

    def test_opening_after_closing_invalid(self):
        result = validate_production_dates(
            first_rehearsal=date(2026, 4, 1),
            opening_night=date(2026, 6, 10),
            closing_night=date(2026, 6, 7),
        )
        assert result["valid"] is False

    def test_same_day_valid(self):
        d = date(2026, 6, 1)
        result = validate_production_dates(
            first_rehearsal=d, opening_night=d, closing_night=d,
        )
        assert result["valid"] is True


# =====================================================================
# MARKDOWN SANITIZATION (SPEC-003 Section 6.2)
# =====================================================================

class TestMarkdownSanitization:
    """Server-side sanitization before storage."""

    def test_script_tag_stripped(self):
        result = sanitize_markdown("Hello <script>alert('xss')</script> World")
        assert "<script>" not in result
        assert "alert" not in result

    def test_bold_preserved(self):
        result = sanitize_markdown("**bold text**")
        assert "bold text" in result

    def test_iframe_stripped(self):
        result = sanitize_markdown('<iframe src="https://evil.com"></iframe>')
        assert "<iframe" not in result

    def test_img_stripped(self):
        result = sanitize_markdown('<img src="https://evil.com/tracker.png" />')
        assert "<img" not in result

    def test_link_preserved(self):
        result = sanitize_markdown("[Example](https://example.com)")
        assert "example.com" in result

    def test_javascript_uri_stripped(self):
        result = sanitize_markdown('[click](javascript:alert(1))')
        assert "javascript:" not in result


# =====================================================================
# FIELD LENGTH VALIDATION (Multiple specs)
# =====================================================================

class TestFieldLengths:
    """Max length constraints from specs."""

    def test_theater_name_max_200(self):
        result = validate_field_lengths("theater_name", "A" * 200)
        assert result["valid"] is True
        result = validate_field_lengths("theater_name", "A" * 201)
        assert result["valid"] is False

    def test_city_max_100(self):
        result = validate_field_lengths("city", "A" * 100)
        assert result["valid"] is True
        result = validate_field_lengths("city", "A" * 101)
        assert result["valid"] is False

    def test_production_name_max_200(self):
        result = validate_field_lengths("production_name", "A" * 200)
        assert result["valid"] is True
        result = validate_field_lengths("production_name", "A" * 201)
        assert result["valid"] is False

    def test_post_title_max_200(self):
        result = validate_field_lengths("post_title", "A" * 200)
        assert result["valid"] is True
        result = validate_field_lengths("post_title", "A" * 201)
        assert result["valid"] is False

    def test_post_body_max_10000(self):
        result = validate_field_lengths("post_body", "A" * 10000)
        assert result["valid"] is True
        result = validate_field_lengths("post_body", "A" * 10001)
        assert result["valid"] is False

    def test_note_max_1000(self):
        result = validate_field_lengths("note", "A" * 1000)
        assert result["valid"] is True
        result = validate_field_lengths("note", "A" * 1001)
        assert result["valid"] is False

    def test_conflict_reason_max_500(self):
        result = validate_field_lengths("conflict_reason", "A" * 500)
        assert result["valid"] is True
        result = validate_field_lengths("conflict_reason", "A" * 501)
        assert result["valid"] is False

    def test_message_body_max_2000(self):
        result = validate_field_lengths("message_body", "A" * 2000)
        assert result["valid"] is True
        result = validate_field_lengths("message_body", "A" * 2001)
        assert result["valid"] is False

    def test_email_max_320(self):
        result = validate_field_lengths("email", "a" * 308 + "@example.com")
        assert result["valid"] is True
        result = validate_field_lengths("email", "a" * 310 + "@example.com")
        assert result["valid"] is False

    def test_display_name_max_200(self):
        result = validate_field_lengths("display_name", "A" * 200)
        assert result["valid"] is True
        result = validate_field_lengths("display_name", "A" * 201)
        assert result["valid"] is False
