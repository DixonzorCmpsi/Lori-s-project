from datetime import date, time, datetime, timedelta
from typing import Any, Optional
import re

DAY_MAP = {
    "monday": 0,
    "tuesday": 1,
    "wednesday": 2,
    "thursday": 3,
    "friday": 4,
    "saturday": 5,
    "sunday": 6,
}

PERMISSION_MATRIX = {
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

BREACHED_PASSWORDS = {
    "password",
    "123456",
    "12345678",
    "qwerty",
    "abc123",
    "monkey",
    "1234567",
    "letmein",
    "trustno1",
    "dragon",
    "baseball",
    "iloveyou",
    "master",
    "sunshine",
    "ashley",
    "bailey",
    "passw0rd",
    "shadow",
    "123123",
    "654321",
    "superman",
    "qazwsx",
    "michael",
    "football",
    "password1",
    "password123",
    "welcome",
    "welcome1",
    "ninja",
    "mustang",
    "password12",
    "admin",
    "admin123",
    "login",
    "starwars",
    "hello",
    "charlie",
    "donald",
    "princess",
    "qwerty123",
    "whatever",
    "freedom",
    "trustme",
    "hunter2",
    "batman",
    "soccer",
    "thomas",
    "killer",
    "joshua",
    "matthew",
    "daniel",
    "andrew",
    "jordan",
    "robert",
    "jessica",
    "jennifer",
    "michael1",
    "michael2",
    "summer",
    "winter",
    "spring",
    "autumn",
    "corvette",
    "ferrari",
    "porsche",
    "mercedes",
    "camaro",
    "yamaha",
    "harley",
    "racing",
    "george",
    "chicken",
    "pepper",
    "coffee",
    "loveme",
    "please",
    "heather",
    "hannah",
    "ginger",
    "maggie",
    "rabbit",
    "anthony",
    "justin",
    "whatever1",
    "access",
    "money",
    "buster",
    "thunder",
    "tigger",
    "rocket",
    "samsung",
    "alexander",
    "martin",
    "cheese",
    "merlin",
    "diamond",
    "cookie",
    "computer",
    "secret",
    "matrix",
    "orange",
    "banana",
    "purple",
    "silver",
    "golden",
    "marina",
    "albert",
    "melissa",
    "lovely",
    "butterfly",
    "liverpool",
    "arsenal",
    "chelsea",
    "player",
    "jackson",
    "william",
    "richard",
    "christian",
    "soccer1",
    "hockey",
    "dallas",
    "austin",
    "yellow",
    "zxcvbn",
    "zxcvbnm",
    "asdfgh",
    "asdfghjkl",
    "qwertyuiop",
    "1q2w3e4r",
    "1q2w3e4r5t",
    "1qaz2wsx",
    "q1w2e3r4",
    "passw0rd1",
    "password2",
    "letmein1",
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


def check_permission(role: str, action: str) -> bool:
    if action not in PERMISSION_MATRIX:
        return False
    if role not in PERMISSION_MATRIX[action]:
        return False
    return PERMISSION_MATRIX[action][role]


def can_send_message(sender_role: str, recipient_role: str) -> bool:
    if sender_role == "cast" and recipient_role == "cast":
        return False
    return True


def check_age_gate(dob: date, reference_date: date) -> dict[str, bool]:
    age = reference_date.year - dob.year
    if (reference_date.month, reference_date.day) < (dob.month, dob.day):
        age -= 1
    return {"allowed": age >= 13}


def derive_age_range(dob: date, reference_date: date) -> str:
    age = reference_date.year - dob.year
    if (reference_date.month, reference_date.day) < (dob.month, dob.day):
        age -= 1
    if age >= 18:
        return "18+"
    return "13-17"


def validate_password(password: str) -> dict[str, Any]:
    if len(password) < 8:
        return {"valid": False, "reason": "Password must be at least 8 characters"}

    if password.lower() in BREACHED_PASSWORDS:
        return {
            "valid": False,
            "reason": "This password is too common. Choose a different one.",
        }

    return {"valid": True, "reason": ""}


def validate_production_dates(
    first_rehearsal: date, opening_night: date, closing_night: date
) -> dict[str, bool]:
    return {
        "valid": first_rehearsal <= opening_night and opening_night <= closing_night
    }


def validate_invite_token(
    token: str,
    expires_at: datetime,
    use_count: int,
    max_uses: int,
    current_time: datetime,
) -> dict[str, Any]:
    if expires_at < current_time:
        return {"valid": False, "reason": "Token has expired"}

    if use_count >= max_uses:
        return {"valid": False, "reason": "Token has reached maximum uses"}

    return {"valid": True, "reason": ""}


def validate_field_lengths(field_name: str, value: Optional[str]) -> dict[str, bool]:
    if value is None:
        return {"valid": True}

    if field_name not in FIELD_MAX_LENGTHS:
        return {"valid": True}

    return {"valid": len(value) <= FIELD_MAX_LENGTHS[field_name]}


def sanitize_markdown(text: str) -> str:
    text = re.sub(
        r"<script[^>]*>.*?</script>", "", text, flags=re.IGNORECASE | re.DOTALL
    )
    text = re.sub(
        r"<iframe[^>]*>.*?</iframe>", "", text, flags=re.IGNORECASE | re.DOTALL
    )
    text = re.sub(r"<img[^>]*>", "", text, flags=re.IGNORECASE)
    text = re.sub(r"<style[^>]*>.*?</style>", "", text, flags=re.IGNORECASE | re.DOTALL)
    text = re.sub(r'\s*on\w+\s*=\s*["\'].*?["\']', "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*on\w+\s*=\s*[^\s>]+", "", text, flags=re.IGNORECASE)
    text = re.sub(r"javascript:", "", text, flags=re.IGNORECASE)
    text = re.sub(r"data:", "", text, flags=re.IGNORECASE)
    return text


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

    blocked_set = set(blocked_dates)
    selected_day_nums = set(DAY_MAP[d] for d in selected_days)
    dates = []
    warnings = []

    current = first_rehearsal
    while current < opening_night:
        if current not in blocked_set and current.weekday() in selected_day_nums:
            dates.append(
                {
                    "date": current,
                    "start_time": start_time,
                    "end_time": end_time,
                    "type": "regular",
                }
            )
        current += timedelta(days=1)

    if tech_week_enabled and tech_week_days > 0:
        tech_start = max(
            first_rehearsal, opening_night - timedelta(days=tech_week_days)
        )
        tech_end = opening_night - timedelta(days=1)
        current = tech_start
        while current <= tech_end:
            if current in blocked_set:
                warnings.append(
                    f"Blocked date {current} falls within tech week and will be skipped"
                )
            else:
                dates = [d for d in dates if d["date"] != current]
                dates.append(
                    {
                        "date": current,
                        "start_time": start_time,
                        "end_time": end_time,
                        "type": "tech",
                    }
                )
            current += timedelta(days=1)

        if dress_rehearsal_enabled:
            tech_dates = [d for d in dates if d["type"] == "tech"]
            if tech_dates:
                tech_dates[-1]["type"] = "dress"

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

    dates.sort(key=lambda x: x["date"])

    if not dates:
        return {
            "error": "No rehearsal dates could be generated. Please adjust your settings."
        }

    return {"dates": dates, "warnings": warnings}
