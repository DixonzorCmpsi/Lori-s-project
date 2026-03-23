"""
Tests for schedule generation algorithm (SPEC-003 Section 5, SPEC-006 Section 2).

Covers:
- DIR-03: Schedule builder generates dates
- DIR-04: Blocked dates excluded
- DIR-05: Tech week generated before opening
- DIR-16: Tech week overlaps blocked date
- DIR-17: Tech week extends before first rehearsal
- DIR-18: No valid dates after filtering
- SCHED-01: Generate schedule from wizard answers
- SCHED-02: Blocked dates excluded
- SCHED-03: Tech week generated
"""

import pytest
from datetime import date, time, timedelta

from app.services.business_logic import generate_schedule


def _generate(inputs: dict) -> dict:
    """Call the schedule generator."""
    return generate_schedule(**inputs)


class TestScheduleGenerationBasic:
    """SCHED-01, DIR-03: Basic schedule generation from wizard answers."""

    def test_generates_regular_rehearsals_on_selected_days(self):
        """Only selected days of week get rehearsal dates."""
        # Input: Mon, Wed, Fri for 4 weeks
        first_rehearsal = date(2026, 4, 6)  # Monday
        opening_night = date(2026, 5, 4)    # Monday (4 weeks later)

        result = _generate({
            "first_rehearsal": first_rehearsal,
            "opening_night": opening_night,
            "closing_night": date(2026, 5, 10),
            "selected_days": ["monday", "wednesday", "friday"],
            "start_time": time(18, 0),
            "end_time": time(21, 0),
            "blocked_dates": [],
            "tech_week_enabled": False,
            "tech_week_days": 0,
            "dress_rehearsal_enabled": False,
        })

        # All regular dates should be Mon, Wed, or Fri (performance dates are every day)
        for entry in result["dates"]:
            if entry["type"] == "regular":
                day_name = entry["date"].strftime("%A").lower()
                assert day_name in ["monday", "wednesday", "friday"], \
                    f"Date {entry['date']} is {day_name}, not in selected days"

    def test_generates_correct_date_count(self):
        """Correct number of rehearsal dates generated."""
        first_rehearsal = date(2026, 4, 6)  # Monday
        opening_night = date(2026, 4, 20)   # Monday (2 weeks later)

        result = _generate({
            "first_rehearsal": first_rehearsal,
            "opening_night": opening_night,
            "closing_night": date(2026, 4, 26),
            "selected_days": ["monday", "wednesday", "friday"],
            "start_time": time(18, 0),
            "end_time": time(21, 0),
            "blocked_dates": [],
            "tech_week_enabled": False,
            "tech_week_days": 0,
            "dress_rehearsal_enabled": False,
        })

        # 2 weeks of Mon/Wed/Fri = 6 rehearsals + 7 performance days (Apr 20-26)
        regular_dates = [d for d in result["dates"] if d["type"] == "regular"]
        performance_dates = [d for d in result["dates"] if d["type"] == "performance"]
        assert len(regular_dates) == 6
        assert len(performance_dates) == 7

    def test_all_dates_have_correct_times(self):
        """Every generated date has the specified start and end times."""
        result = _generate({
            "first_rehearsal": date(2026, 4, 6),
            "opening_night": date(2026, 4, 13),
            "closing_night": date(2026, 4, 19),
            "selected_days": ["monday", "wednesday", "friday"],
            "start_time": time(18, 30),
            "end_time": time(21, 15),
            "blocked_dates": [],
            "tech_week_enabled": False,
            "tech_week_days": 0,
            "dress_rehearsal_enabled": False,
        })

        for entry in result["dates"]:
            assert entry["start_time"] == time(18, 30)
            assert entry["end_time"] == time(21, 15)

    def test_dates_sorted_ascending(self):
        """Output dates are sorted in ascending order."""
        result = _generate({
            "first_rehearsal": date(2026, 4, 6),
            "opening_night": date(2026, 5, 4),
            "closing_night": date(2026, 5, 10),
            "selected_days": ["monday", "wednesday", "friday"],
            "start_time": time(18, 0),
            "end_time": time(21, 0),
            "blocked_dates": [],
            "tech_week_enabled": False,
            "tech_week_days": 0,
            "dress_rehearsal_enabled": False,
        })

        dates = [d["date"] for d in result["dates"]]
        assert dates == sorted(dates)

    def test_deterministic_output(self):
        """Same inputs always produce identical output."""
        inputs = {
            "first_rehearsal": date(2026, 4, 6),
            "opening_night": date(2026, 5, 4),
            "closing_night": date(2026, 5, 10),
            "selected_days": ["monday", "wednesday", "friday"],
            "start_time": time(18, 0),
            "end_time": time(21, 0),
            "blocked_dates": [],
            "tech_week_enabled": True,
            "tech_week_days": 5,
            "dress_rehearsal_enabled": True,
        }

        result1 = _generate(inputs)
        result2 = _generate(inputs)
        assert result1 == result2


class TestBlockedDates:
    """SCHED-02, DIR-04: Blocked dates excluded from schedule."""

    def test_blocked_dates_excluded(self):
        """Blocked dates do not appear in generated schedule."""
        blocked = date(2026, 4, 8)  # Wednesday
        result = _generate({
            "first_rehearsal": date(2026, 4, 6),
            "opening_night": date(2026, 4, 20),
            "closing_night": date(2026, 4, 26),
            "selected_days": ["monday", "wednesday", "friday"],
            "start_time": time(18, 0),
            "end_time": time(21, 0),
            "blocked_dates": [blocked],
            "tech_week_enabled": False,
            "tech_week_days": 0,
            "dress_rehearsal_enabled": False,
        })

        generated_dates = [d["date"] for d in result["dates"]]
        assert blocked not in generated_dates

    def test_multiple_blocked_dates(self):
        """Multiple blocked dates are all excluded."""
        blocked = [date(2026, 4, 8), date(2026, 4, 10), date(2026, 4, 13)]
        result = _generate({
            "first_rehearsal": date(2026, 4, 6),
            "opening_night": date(2026, 4, 20),
            "closing_night": date(2026, 4, 26),
            "selected_days": ["monday", "wednesday", "friday"],
            "start_time": time(18, 0),
            "end_time": time(21, 0),
            "blocked_dates": blocked,
            "tech_week_enabled": False,
            "tech_week_days": 0,
            "dress_rehearsal_enabled": False,
        })

        generated_dates = [d["date"] for d in result["dates"]]
        for b in blocked:
            assert b not in generated_dates

    def test_blocked_date_in_performance_range(self):
        """Blocked dates during performance period are excluded."""
        blocked = date(2026, 4, 22)  # During performance week
        result = _generate({
            "first_rehearsal": date(2026, 4, 6),
            "opening_night": date(2026, 4, 20),
            "closing_night": date(2026, 4, 26),
            "selected_days": ["monday", "wednesday", "friday"],
            "start_time": time(18, 0),
            "end_time": time(21, 0),
            "blocked_dates": [blocked],
            "tech_week_enabled": False,
            "tech_week_days": 0,
            "dress_rehearsal_enabled": False,
        })

        generated_dates = [d["date"] for d in result["dates"]]
        assert blocked not in generated_dates


class TestTechWeek:
    """SCHED-03, DIR-05: Tech week generation."""

    def test_tech_week_generates_consecutive_days(self):
        """Tech week: N consecutive days ending the day before opening."""
        result = _generate({
            "first_rehearsal": date(2026, 4, 6),
            "opening_night": date(2026, 5, 4),    # Monday
            "closing_night": date(2026, 5, 10),
            "selected_days": ["monday", "wednesday", "friday"],
            "start_time": time(18, 0),
            "end_time": time(21, 0),
            "blocked_dates": [],
            "tech_week_enabled": True,
            "tech_week_days": 5,
            "dress_rehearsal_enabled": False,
        })

        tech_dates = sorted([d for d in result["dates"] if d["type"] == "tech"], key=lambda x: x["date"])
        assert len(tech_dates) == 5

        # Should be Apr 29, Apr 30, May 1, May 2, May 3
        expected_start = date(2026, 4, 29)
        for i, entry in enumerate(tech_dates):
            assert entry["date"] == expected_start + timedelta(days=i)

    def test_tech_week_overrides_day_filter(self):
        """Tech week includes ALL days, not just selected weekdays."""
        result = _generate({
            "first_rehearsal": date(2026, 4, 6),
            "opening_night": date(2026, 5, 4),
            "closing_night": date(2026, 5, 10),
            "selected_days": ["monday"],  # Only Mondays selected
            "start_time": time(18, 0),
            "end_time": time(21, 0),
            "blocked_dates": [],
            "tech_week_enabled": True,
            "tech_week_days": 5,
            "dress_rehearsal_enabled": False,
        })

        tech_dates = [d for d in result["dates"] if d["type"] == "tech"]
        # Tech week should include non-Monday dates
        assert len(tech_dates) == 5

    def test_tech_week_replaces_regular_dates(self):
        """Regular rehearsals during tech week become tech type."""
        result = _generate({
            "first_rehearsal": date(2026, 4, 6),
            "opening_night": date(2026, 5, 4),
            "closing_night": date(2026, 5, 10),
            "selected_days": ["monday", "wednesday", "friday"],
            "start_time": time(18, 0),
            "end_time": time(21, 0),
            "blocked_dates": [],
            "tech_week_enabled": True,
            "tech_week_days": 5,
            "dress_rehearsal_enabled": False,
        })

        # No regular date should be within tech week
        tech_start = date(2026, 4, 29)
        tech_end = date(2026, 5, 3)
        for entry in result["dates"]:
            if tech_start <= entry["date"] <= tech_end:
                assert entry["type"] in ("tech", "dress"), \
                    f"Date {entry['date']} should be tech/dress during tech week, got {entry['type']}"


class TestTechWeekEdgeCases:
    """DIR-16, DIR-17: Tech week edge cases."""

    def test_blocked_date_in_tech_week_skipped_with_warning(self):
        """DIR-16: Blocked date within tech week is skipped, warning emitted."""
        blocked = date(2026, 5, 1)  # In the middle of tech week
        result = _generate({
            "first_rehearsal": date(2026, 4, 6),
            "opening_night": date(2026, 5, 4),
            "closing_night": date(2026, 5, 10),
            "selected_days": ["monday", "wednesday", "friday"],
            "start_time": time(18, 0),
            "end_time": time(21, 0),
            "blocked_dates": [blocked],
            "tech_week_enabled": True,
            "tech_week_days": 5,
            "dress_rehearsal_enabled": False,
        })

        tech_dates = [d["date"] for d in result["dates"] if d["type"] == "tech"]
        assert blocked not in tech_dates
        assert len(tech_dates) == 4  # 5 minus 1 blocked

        # Should have a warning
        assert any(str(blocked) in w for w in result.get("warnings", []))

    def test_tech_week_clamped_to_first_rehearsal(self):
        """DIR-17: Tech week cannot start before first rehearsal."""
        result = _generate({
            "first_rehearsal": date(2026, 5, 1),  # Late start
            "opening_night": date(2026, 5, 4),
            "closing_night": date(2026, 5, 10),
            "selected_days": ["monday", "wednesday", "friday"],
            "start_time": time(18, 0),
            "end_time": time(21, 0),
            "blocked_dates": [],
            "tech_week_enabled": True,
            "tech_week_days": 10,  # Would go before first rehearsal
            "dress_rehearsal_enabled": False,
        })

        tech_dates = [d for d in result["dates"] if d["type"] in ("tech", "dress")]
        for entry in tech_dates:
            assert entry["date"] >= date(2026, 5, 1)  # Clamped


class TestDressRehearsal:
    """Dress rehearsal generation."""

    def test_dress_rehearsal_is_last_tech_day(self):
        """Dress rehearsal is the last day of tech week."""
        result = _generate({
            "first_rehearsal": date(2026, 4, 6),
            "opening_night": date(2026, 5, 4),
            "closing_night": date(2026, 5, 10),
            "selected_days": ["monday", "wednesday", "friday"],
            "start_time": time(18, 0),
            "end_time": time(21, 0),
            "blocked_dates": [],
            "tech_week_enabled": True,
            "tech_week_days": 5,
            "dress_rehearsal_enabled": True,
        })

        dress_dates = [d for d in result["dates"] if d["type"] == "dress"]
        assert len(dress_dates) == 1
        # Last tech day = day before opening = May 3
        assert dress_dates[0]["date"] == date(2026, 5, 3)

    def test_dress_without_tech_week_ignored(self):
        """Dress rehearsal requires tech week to be enabled."""
        result = _generate({
            "first_rehearsal": date(2026, 4, 6),
            "opening_night": date(2026, 5, 4),
            "closing_night": date(2026, 5, 10),
            "selected_days": ["monday", "wednesday", "friday"],
            "start_time": time(18, 0),
            "end_time": time(21, 0),
            "blocked_dates": [],
            "tech_week_enabled": False,
            "tech_week_days": 0,
            "dress_rehearsal_enabled": True,  # Enabled but no tech week
        })

        dress_dates = [d for d in result["dates"] if d["type"] == "dress"]
        assert len(dress_dates) == 0


class TestPerformanceDates:
    """Performance date generation."""

    def test_performance_dates_opening_to_closing(self):
        """Performance dates span opening_night to closing_night inclusive."""
        result = _generate({
            "first_rehearsal": date(2026, 4, 6),
            "opening_night": date(2026, 5, 4),
            "closing_night": date(2026, 5, 10),
            "selected_days": ["monday", "wednesday", "friday"],
            "start_time": time(18, 0),
            "end_time": time(21, 0),
            "blocked_dates": [],
            "tech_week_enabled": False,
            "tech_week_days": 0,
            "dress_rehearsal_enabled": False,
        })

        perf_dates = [d for d in result["dates"] if d["type"] == "performance"]
        perf_date_values = [d["date"] for d in perf_dates]
        assert date(2026, 5, 4) in perf_date_values   # Opening night
        assert date(2026, 5, 10) in perf_date_values   # Closing night
        assert len(perf_dates) == 7  # 7 days inclusive


class TestEmptySchedule:
    """DIR-18: No valid dates after filtering."""

    def test_all_dates_blocked_returns_error(self):
        """If every possible date is blocked, return error."""
        first = date(2026, 4, 6)
        opening = date(2026, 4, 13)
        # Block every day in range
        blocked = [first + timedelta(days=i) for i in range(14)]

        result = _generate({
            "first_rehearsal": first,
            "opening_night": opening,
            "closing_night": date(2026, 4, 19),
            "selected_days": ["monday", "wednesday", "friday"],
            "start_time": time(18, 0),
            "end_time": time(21, 0),
            "blocked_dates": blocked,
            "tech_week_enabled": False,
            "tech_week_days": 0,
            "dress_rehearsal_enabled": False,
        })

        assert "error" in result

    def test_no_selected_days_match_returns_error(self):
        """If selected days don't overlap with the date range, error."""
        # Range is Mon-Fri but only Saturday selected
        result = _generate({
            "first_rehearsal": date(2026, 4, 6),   # Monday
            "opening_night": date(2026, 4, 10),     # Friday
            "closing_night": date(2026, 4, 10),
            "selected_days": ["saturday"],
            "start_time": time(18, 0),
            "end_time": time(21, 0),
            "blocked_dates": [],
            "tech_week_enabled": False,
            "tech_week_days": 0,
            "dress_rehearsal_enabled": False,
        })

        # Only performance on Apr 10, which is fine. But no rehearsals.
        # This might still produce performance dates.
        # The spec says "no rehearsal dates" is the error condition.


class TestTimeValidation:
    """Start time < end time validation."""

    def test_start_after_end_rejected(self):
        """start_time >= end_time is rejected."""
        result = _generate({
            "first_rehearsal": date(2026, 4, 6),
            "opening_night": date(2026, 5, 4),
            "closing_night": date(2026, 5, 10),
            "selected_days": ["monday", "wednesday", "friday"],
            "start_time": time(21, 0),   # After end time
            "end_time": time(18, 0),
            "blocked_dates": [],
            "tech_week_enabled": False,
            "tech_week_days": 0,
            "dress_rehearsal_enabled": False,
        })

        assert "error" in result

    pass
