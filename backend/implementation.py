"""
Pure functions extracted from spec requirements.

These functions implement core business logic that can be tested independently
of the database and API layers.
"""

import re
from datetime import date, time, timedelta
from typing import Any


# =====================================================================
# BREACHED PASSWORDS (top 10k - partial list for validation)
# =====================================================================

BREACHED_PASSWORDS = {
    "password",
    "123456",
    "12345678",
    "123456789",
    "qwerty",
    "1234567",
    "dragon",
    "letmein",
    "monkey",
    "abc123",
    "football",
    "baseball",
    "master",
    "sunshine",
    "princess",
    "superman",
    "batman",
    "trustno1",
    "admin",
    "welcome",
    "charlie",
    "donald",
    "login",
    "starwars",
    "computer",
    "server",
    "root",
    "passw0rd",
    "shadow",
    "michael",
}


def _is_breached_password(password: str) -> bool:
    """Check if password is in breached list (case-insensitive)."""
    return password.lower() in BREACHED_PASSWORDS


# =====================================================================
# SCHEDULE GENERATION (SPEC-003 Section 5, SPEC-006 Section 2)
# =====================================================================


def generate_schedule(
    first_rehearsal: date,
    opening_night: date,
    closing_night: date,
    selected_days: list[str],
    start_time: time,
    end_time: time,
    blocked_dates: list[date],
    tech_week_enabled: bool,
    tech_week_days: int,
    dress_rehearsal_enabled: bool,
) -> dict:
    """
    Generate a deterministic rehearsal schedule.
    Same inputs always produce identical output.
    """
    # Validate time
    if start_time >= end_time:
        return {"error": "Start time must be before end time"}

    day_map = {
        "monday": 0,
        "tuesday": 1,
        "wednesday": 2,
        "thursday": 3,
        "friday": 4,
        "saturday": 5,
        "sunday": 6,
    }
    selected_day_nums = {
        day_map[d.lower()] for d in selected_days if d.lower() in day_map
    }

    blocked_set = set(blocked_dates)
    dates = []
    warnings = []

    # Step 1: Regular rehearsals (first_rehearsal to day before opening_night)
    current = first_rehearsal
    while current < opening_night:
        if current.weekday() in selected_day_nums and current not in blocked_set:
            dates.append(
                {
                    "date": current,
                    "start_time": start_time,
                    "end_time": end_time,
                    "type": "regular",
                }
            )
        current += timedelta(days=1)

    # Step 2: Tech week (overrides day-of-week filter)
    tech_dates = []
    if tech_week_enabled and tech_week_days > 0:
        tech_start = max(
            first_rehearsal, opening_night - timedelta(days=tech_week_days)
        )
        tech_end = opening_night - timedelta(days=1)

        current = tech_start
        while current <= tech_end:
            if current in blocked_set:
                warnings.append(f"Blocked date {current} in tech week — skipped")
            else:
                t_type = "tech"
                if dress_rehearsal_enabled and current == tech_end:
                    t_type = "dress"
                tech_dates.append(
                    {
                        "date": current,
                        "start_time": start_time,
                        "end_time": end_time,
                        "type": t_type,
                    }
                )
                # Remove any regular date for this day
                dates = [d for d in dates if d["date"] != current]
            current += timedelta(days=1)

        dates.extend(tech_dates)

    # Step 3: Performance dates (opening_night to closing_night)
    current = opening_night
    while current <= closing_night:
        if current not in blocked_set:
            dates.append(
                {
                    "date": current,
                    "start_time": start_time,
                    "end_time": end_time,
                    "type": "performance",
                }
            )
        current += timedelta(days=1)

    # Sort by date
    dates.sort(key=lambda x: x["date"])

    # Check for empty schedule
    if len([d for d in dates if d["type"] != "performance"]) == 0:
        return {
            "error": "No rehearsal dates could be generated. Please adjust your settings."
        }

    return {"dates": dates, "warnings": warnings}


# =====================================================================
# AGE GATE (SPEC-001 Section 7.1, SPEC-002 Section 2.3)
# =====================================================================


def check_age_gate(date_of_birth: date, reference_date: date = None) -> dict:
    """Check if user is at least 13 years old (COPPA compliance)."""
    if reference_date is None:
        reference_date = date.today()

    age = reference_date.year - date_of_birth.year
    if reference_date.month < date_of_birth.month or (
        reference_date.month == date_of_birth.month
        and reference_date.day < date_of_birth.day
    ):
        age -= 1

    if age < 13:
        return {"allowed": False, "reason": "Must be 13 or older to create an account"}
    return {"allowed": True, "age": age}


def derive_age_range(date_of_birth: date, reference_date: date = None) -> str:
    """Derive age range from date of birth."""
    if reference_date is None:
        reference_date = date.today()

    age = reference_date.year - date_of_birth.year
    if reference_date.month < date_of_birth.month or (
        reference_date.month == date_of_birth.month
        and reference_date.day < date_of_birth.day
    ):
        age -= 1

    if age >= 18:
        return "18+"
    return "13-17"


# =====================================================================
# PASSWORD VALIDATION (SPEC-002 Section 2.2)
# =====================================================================


def validate_password(password: str) -> dict:
    """
    Validate password: min 8 chars, no breached passwords.
    No complexity rules (no uppercase/number requirement).
    """
    if len(password) < 8:
        return {"valid": False, "reason": "Password must be at least 8 characters"}

    if _is_breached_password(password):
        return {
            "valid": False,
            "reason": "This password is too common. Choose a different one.",
        }

    return {"valid": True}


# =====================================================================
# PERMISSION MATRIX (SPEC-002 Section 3.2)
# =====================================================================

PERMISSION_MATRIX = {
    "director": {
        "create_theater": True,
        "create_production": True,
        "edit_production": True,
        "edit_schedule": True,
        "post_bulletin": True,
        "view_bulletin": True,
        "view_all_conflicts": True,
        "submit_conflicts": False,
        "elevate_cast": True,
        "demote_staff": True,
        "remove_member": True,
        "generate_invite": True,
        "delete_production": True,
        "reset_conflicts": True,
        "archive_production": True,
    },
    "staff": {
        "create_theater": False,
        "create_production": False,
        "edit_production": True,
        "edit_schedule": True,
        "post_bulletin": True,
        "view_bulletin": True,
        "view_all_conflicts": True,
        "submit_conflicts": False,
        "elevate_cast": False,
        "demote_staff": False,
        "remove_member": False,
        "generate_invite": True,
        "delete_production": False,
        "reset_conflicts": False,
        "archive_production": False,
    },
    "cast": {
        "create_theater": False,
        "create_production": False,
        "edit_production": False,
        "edit_schedule": False,
        "post_bulletin": False,
        "view_bulletin": True,
        "view_all_conflicts": False,
        "submit_conflicts": True,
        "elevate_cast": False,
        "demote_staff": False,
        "remove_member": False,
        "generate_invite": False,
        "delete_production": False,
        "reset_conflicts": False,
        "archive_production": False,
    },
}


def check_permission(role: str, action: str) -> bool:
    """Check if a role has permission for an action."""
    role_perms = PERMISSION_MATRIX.get(role, {})
    return role_perms.get(action, False)


# =====================================================================
# CHAT BOUNDARY RULES (SPEC-005 Section 2)
# =====================================================================

CHAT_ALLOWANCES = {
    "director": ["director", "staff", "cast"],
    "staff": ["director", "staff", "cast"],
    "cast": ["director", "staff"],
}


def can_send_message(sender_role: str, recipient_role: str) -> bool:
    """Check if sender can message recipient based on roles."""
    allowed = CHAT_ALLOWANCES.get(sender_role, [])
    return recipient_role in allowed


# =====================================================================
# DATE VALIDATION (SPEC-003 Section 4)
# =====================================================================


def validate_production_dates(
    first_rehearsal: date,
    opening_night: date,
    closing_night: date,
) -> dict:
    """Validate production date ordering: first_rehearsal <= opening_night <= closing_night."""
    if first_rehearsal > opening_night:
        return {
            "valid": False,
            "reason": "First rehearsal must be on or before opening night",
        }

    if opening_night > closing_night:
        return {
            "valid": False,
            "reason": "Opening night must be on or before closing night",
        }

    return {"valid": True}


# =====================================================================
# MARKDOWN SANITIZATION (SPEC-003 Section 6.2)
# =====================================================================


def sanitize_markdown(markdown: str) -> str:
    """
    Sanitize Markdown server-side before storage.
    Strip script/iframe/img/event handlers, preserve allowed formatting.
    """
    result = markdown

    # Remove script tags
    result = re.sub(
        r"<script[^>]*>.*?</script>", "", result, flags=re.IGNORECASE | re.DOTALL
    )

    # Remove iframe tags
    result = re.sub(
        r"<iframe[^>]*>.*?</iframe>", "", result, flags=re.IGNORECASE | re.DOTALL
    )

    # Remove img tags
    result = re.sub(r"<img[^>]*>", "", result, flags=re.IGNORECASE)

    # Remove on* event handlers
    result = re.sub(r'\s+on\w+=["\'][^"\']*["\']', "", result, flags=re.IGNORECASE)

    # Remove javascript: URIs
    result = re.sub(r"javascript:", "", result, flags=re.IGNORECASE)

    # Remove data: URIs
    result = re.sub(r"data:", "", result, flags=re.IGNORECASE)

    return result


# =====================================================================
# FIELD LENGTH VALIDATION (Multiple specs)
# =====================================================================

FIELD_MAX_LENGTHS = {
    "theater_name": 200,
    "city": 100,
    "state": 100,
    "production_name": 200,
    "post_title": 200,
    "post_body": 10000,
    "note": 1000,
    "conflict_reason": 500,
    "message_body": 2000,
    "email": 320,
    "display_name": 200,
    "phone": 20,
    "role_character": 200,
    "name": 200,
    "password": 128,
}


def validate_field_lengths(field_name: str, value: str) -> dict:
    """Validate field doesn't exceed max length."""
    max_len = FIELD_MAX_LENGTHS.get(field_name)
    if max_len is None:
        return {"valid": True}  # Unknown field, allow

    if len(value) > max_len:
        return {"valid": False, "reason": f"Field exceeds maximum length of {max_len}"}

    return {"valid": True}


# =====================================================================
# INVITE TOKEN VALIDATION (SPEC-002 Section 2.4)
# =====================================================================


def validate_invite_token(
    token: str,
    expires_at: date,
    max_uses: int,
    use_count: int,
    reference_date: date = None,
) -> dict:
    """Validate invite token is still valid."""
    if reference_date is None:
        reference_date = date.today()

    if expires_at < reference_date:
        return {"valid": False, "reason": "Invite link has expired"}

    if use_count >= max_uses:
        return {"valid": False, "reason": "Invite link no longer available"}

    # Token format check (min 32 chars, URL-safe)
    if len(token) < 32:
        return {"valid": False, "reason": "Invalid token format"}

    if not re.match(r"^[A-Za-z0-9_-]+$", token):
        return {"valid": False, "reason": "Invalid token format"}

    return {"valid": True}
