import re
from datetime import date, datetime, time, timedelta
from typing import Any, Optional

BREACHED_PASSWORDS = {
    "password", "123456", "12345678", "qwerty", "abc123",
    "monkey", "1234567", "letmein", "trustno1", "dragon"
}

PERMISSIONS = {
    "create_theater": {"director": True, "staff": False, "cast": False},
    "create_production": {"director": True, "staff": False, "cast": False},
    "edit_production": {"director": True, "staff": True, "cast": False},
    "edit_schedule": {"director": True, "staff": True, "cast": False},
    "post_bulletin": {"director": True, "staff": True, "cast": False},
    "view_bulletin": {"director": True, "staff": True, "cast": True},
    "view_all_conflicts": {"director": True, "staff": True, "cast": False},
    "submit_conflicts": {"director": False, "staff": False, "cast": True},
    "elevate_cast": {"director": True, "staff": False, "cast": False},
    "demote_staff": {"director": True, "staff": False, "cast": False},
    "remove_member": {"director": True, "staff": False, "cast": False},
    "generate_invite": {"director": True, "staff": True, "cast": False},
    "delete_production": {"director": True, "staff": False, "cast": False},
    "reset_conflicts": {"director": True, "staff": False, "cast": False},
    "view_personal_schedule": {"director": True, "staff": True, "cast": True},
    "chat_with_anyone": {"director": True, "staff": True, "cast": False},
    "chat_with_staff_director": {"director": True, "staff": True, "cast": True},
}

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
}


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
) -> dict[str, Any]:
    if start_time >= end_time:
        return {"error": "Start time must be before end time"}

    if not selected_days:
        return {"error": "No rehearsal days selected"}

    day_name_to_num = {
        "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
        "friday": 4, "saturday": 5, "sunday": 6
    }
    selected_day_nums = {day_name_to_num[d] for d in selected_days if d in day_name_to_num}
    blocked_set = set(blocked_dates)

    dates = []
    warnings = []

    current = first_rehearsal
    while current < opening_night:
        if current.weekday() in selected_day_nums and current not in blocked_set:
            dates.append({
                "date": current,
                "start_time": start_time,
                "end_time": end_time,
                "type": "regular"
            })
        current += timedelta(days=1)

    if tech_week_enabled and tech_week_days > 0:
        tech_start = max(first_rehearsal, opening_night - timedelta(days=tech_week_days))
        tech_end = opening_night - timedelta(days=1)

        current = tech_start
        while current <= tech_end:
            if current in blocked_set:
                warnings.append(f"Blocked date {current} falls within tech week and will be skipped")
                dates = [d for d in dates if d["date"] != current]
            else:
                existing = next((d for d in dates if d["date"] == current), None)
                if existing:
                    existing["type"] = "tech"
                else:
                    dates.append({
                        "date": current,
                        "start_time": start_time,
                        "end_time": end_time,
                        "type": "tech"
                    })
            current += timedelta(days=1)

        if dress_rehearsal_enabled:
            tech_dates = [d for d in dates if d["type"] == "tech"]
            if tech_dates:
                tech_dates.sort(key=lambda x: x["date"])
                tech_dates[-1]["type"] = "dress"

    current = opening_night
    while current <= closing_night:
        if current not in blocked_set:
            dates.append({
                "date": current,
                "start_time": start_time,
                "end_time": end_time,
                "type": "performance"
            })
        current += timedelta(days=1)

    dates.sort(key=lambda x: x["date"])

    if not dates:
        return {"error": "No rehearsal dates could be generated. Please adjust your settings."}

    result = {"dates": dates}
    if warnings:
        result["warnings"] = warnings
    return result


def check_age_gate(dob: date, reference_date: date) -> dict[str, bool]:
    age = reference_date.year - dob.year
    if (reference_date.month, reference_date.day) < (dob.month, dob.day):
        age -= 1
    return {"allowed": age >= 13}


def derive_age_range(dob: date, reference_date: date) -> str:
    age = reference_date.year - dob.year
    if (reference_date.month, reference_date.day) < (dob.month, dob.day):
        age -= 1
    return "13-17" if age < 18 else "18+"


def validate_password(password: str) -> dict[str, Any]:
    if len(password) < 8:
        return {"valid": False, "reason": "Password must be at least 8 characters long."}
    if password.lower() in BREACHED_PASSWORDS:
        return {"valid": False, "reason": "This password is too common. Choose a different one."}
    return {"valid": True, "reason": ""}


def check_permission(role: str, action: str) -> bool:
    if action not in PERMISSIONS:
        return False
    role_perms = PERMISSIONS[action]
    return role_perms.get(role, False)


def can_send_message(sender_role: str, recipient_role: str) -> bool:
    if sender_role == "cast" and recipient_role == "cast":
        return False
    return True


def validate_production_dates(
    first_rehearsal: date,
    opening_night: date,
    closing_night: date
) -> dict[str, bool]:
    return {
        "valid": first_rehearsal <= opening_night <= closing_night
    }


def sanitize_markdown(text: str) -> str:
    dangerous_tags = [
        r'<script\b[^>]*>(.*?)</script>',
        r'<iframe\b[^>]*>(.*?)</iframe>',
        r'<img\b[^>]*>',
        r'on\w+\s*=\s*["\']',
        r'javascript:',
    ]
    result = text
    for pattern in dangerous_tags:
        result = re.sub(pattern, '', result, flags=re.IGNORECASE | re.DOTALL)
    return result


def validate_field_lengths(field_name: str, value: str) -> dict[str, bool]:
    max_len = FIELD_MAX_LENGTHS.get(field_name)
    if max_len is None:
        return {"valid": True}
    return {"valid": len(value) <= max_len}


def validate_invite_token(
    token: str,
    expires_at: datetime,
    use_count: int,
    max_uses: int,
    current_time: datetime
) -> dict[str, Any]:
    if current_time >= expires_at:
        return {"valid": False, "reason": "This invite link has expired."}
    if use_count >= max_uses:
        return {"valid": False, "reason": "This invite link is no longer available."}
    return {"valid": True, "reason": ""}