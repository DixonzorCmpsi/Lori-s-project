"""COPPA-compliant audit logging service."""

import uuid
from typing import Optional

from app.database import async_session_maker
from app.models import AuditLog


async def log_action(
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    user_id: Optional[str] = None,
    actor_id: Optional[str] = None,
    details: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> None:
    """Log an auditable action. Fire-and-forget — never raises."""
    try:
        async with async_session_maker() as session:
            entry = AuditLog(
                id=str(uuid.uuid4()),
                user_id=user_id,
                actor_id=actor_id,
                action=action,
                resource_type=resource_type,
                resource_id=resource_id,
                details=details,
                ip_address=ip_address,
            )
            session.add(entry)
            await session.commit()
    except Exception:
        pass  # Audit logging must never break the main flow


# Common actions
ACTIONS = {
    "register": "account.register",
    "login": "account.login",
    "login_failed": "account.login_failed",
    "password_change": "account.password_change",
    "password_reset": "account.password_reset",
    "account_delete": "account.delete",
    "profile_update": "profile.update",
    "profile_view": "profile.view",
    "email_pref_change": "preferences.email_notifications",
    "parental_consent": "coppa.parental_consent",
    "parent_email_set": "coppa.parent_email_set",
    "age_verified": "coppa.age_verified",
    "data_export": "coppa.data_export",
    "data_deletion": "coppa.data_deletion",
    "member_blocked": "production.member_blocked",
    "member_removed": "production.member_removed",
    "conflicts_submitted": "production.conflicts_submitted",
    "email_sent": "notification.email_sent",
}
