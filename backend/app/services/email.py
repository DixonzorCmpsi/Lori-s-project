"""Email service using Resend for transactional emails."""

import logging
from typing import Optional

from app.config import get_settings

logger = logging.getLogger(__name__)

_APP_NAME = "Digital Call Board"
_BASE_URL = None  # set lazily from settings


def _get_base_url() -> str:
    global _BASE_URL
    if _BASE_URL is None:
        s = get_settings()
        _BASE_URL = s.nextauth_url or "http://localhost:5173"
    return _BASE_URL


def _init_resend() -> bool:
    """Initialize Resend SDK. Returns True if configured."""
    s = get_settings()
    if not s.resend_api_key:
        logger.warning("RESEND_API_KEY not set — emails will be logged but not sent")
        return False
    import resend
    resend.api_key = s.resend_api_key
    return True


def _send(to: str, subject: str, html: str) -> bool:
    """Send an email. Returns True on success."""
    s = get_settings()
    if not _init_resend():
        logger.info(f"[EMAIL DRY RUN] To: {to} | Subject: {subject}")
        return False
    try:
        import resend
        resend.Emails.send({
            "from": f"{_APP_NAME} <{s.email_from}>",
            "to": [to],
            "subject": subject,
            "html": html,
        })
        logger.info(f"Email sent to {to}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email to {to}: {e}")
        return False


# ── Template helpers ──

def _wrap(content: str) -> str:
    """Wrap content in a minimal styled email container."""
    base = _get_base_url()
    return f"""
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #333;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="font-family: Georgia, serif; color: #2a2a2a; font-size: 22px; margin: 0;">Digital Call Board</h1>
        <p style="color: #888; font-size: 12px; margin: 4px 0 0;">Theater Production Management</p>
      </div>
      <div style="background: #fafafa; border: 1px solid #e5e5e5; border-radius: 8px; padding: 24px;">
        {content}
      </div>
      <p style="text-align: center; color: #aaa; font-size: 11px; margin-top: 24px;">
        <a href="{base}" style="color: #aaa;">callboard.deetalk.win</a>
      </p>
    </div>
    """


def _btn(url: str, label: str) -> str:
    return f"""
    <div style="text-align: center; margin: 20px 0;">
      <a href="{url}" style="display: inline-block; background: #D4AF37; color: #1a1a1a; padding: 12px 28px;
        border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 13px; letter-spacing: 0.03em;">
        {label}
      </a>
    </div>
    """


# ── Public API ──

def send_invite_email(to: str, production_name: str, invite_url: str, inviter_name: str) -> bool:
    """Send an invite link to join a production."""
    return _send(to, f"You're invited to {production_name}", _wrap(f"""
        <h2 style="color: #2a2a2a; font-size: 18px; margin: 0 0 8px;">{inviter_name} invited you</h2>
        <p style="color: #555; font-size: 14px; line-height: 1.6;">
          You've been invited to join <strong>{production_name}</strong> on the Digital Call Board.
          Click below to create your account and join the production.
        </p>
        {_btn(invite_url, "Join the Production")}
        <p style="color: #999; font-size: 11px;">If the button doesn't work, copy this link: {invite_url}</p>
    """))


def send_announcement_email(to: str, production_name: str, title: str, body: str, author_name: str) -> bool:
    """Send a bulletin announcement notification."""
    return _send(to, f"[{production_name}] {title}", _wrap(f"""
        <p style="color: #888; font-size: 12px; margin: 0 0 4px;">New announcement from {author_name}</p>
        <h2 style="color: #2a2a2a; font-size: 18px; margin: 0 0 12px;">{title}</h2>
        <div style="color: #555; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">{body[:500]}{'...' if len(body) > 500 else ''}</div>
        {_btn(_get_base_url(), "Open Call Board")}
    """))


def send_team_message_email(to: str, production_name: str, team_name: str, message: str, sender_name: str) -> bool:
    """Send a team message notification."""
    return _send(to, f"[{production_name}] Message from {sender_name}", _wrap(f"""
        <p style="color: #888; font-size: 12px; margin: 0 0 4px;">Team: {team_name}</p>
        <h2 style="color: #2a2a2a; font-size: 18px; margin: 0 0 12px;">Message from {sender_name}</h2>
        <div style="color: #555; font-size: 14px; line-height: 1.6; background: #f5f5f5; padding: 12px; border-radius: 4px;">
          {message[:500]}{'...' if len(message) > 500 else ''}
        </div>
        {_btn(_get_base_url(), "Open Chat")}
    """))


def send_conflict_reminder_email(to: str, production_name: str, cast_name: str) -> bool:
    """Remind a cast member to submit their conflicts."""
    return _send(to, f"[{production_name}] Please submit your conflicts", _wrap(f"""
        <h2 style="color: #2a2a2a; font-size: 18px; margin: 0 0 12px;">Hi {cast_name},</h2>
        <p style="color: #555; font-size: 14px; line-height: 1.6;">
          Your director is waiting for your conflict submission for <strong>{production_name}</strong>.
          Let them know which dates you can't make so they can plan around your schedule.
        </p>
        {_btn(_get_base_url(), "Submit Conflicts")}
    """))


def send_email_verification(to: str, name: str, verify_url: str) -> bool:
    """Send email verification link."""
    return _send(to, "Verify your email", _wrap(f"""
        <h2 style="color: #2a2a2a; font-size: 18px; margin: 0 0 12px;">Welcome, {name}!</h2>
        <p style="color: #555; font-size: 14px; line-height: 1.6;">
          Please verify your email address to get started with the Digital Call Board.
        </p>
        {_btn(verify_url, "Verify Email")}
        <p style="color: #999; font-size: 11px;">This link expires in 24 hours.</p>
    """))


def send_password_reset(to: str, name: str, reset_url: str) -> bool:
    """Send password reset link."""
    return _send(to, "Reset your password", _wrap(f"""
        <h2 style="color: #2a2a2a; font-size: 18px; margin: 0 0 12px;">Hi {name},</h2>
        <p style="color: #555; font-size: 14px; line-height: 1.6;">
          We received a request to reset your password. Click below to choose a new one.
        </p>
        {_btn(reset_url, "Reset Password")}
        <p style="color: #999; font-size: 11px;">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
    """))


def send_direct_email(to: str, production_name: str, subject: str, body: str, sender_name: str) -> bool:
    """Send a direct email (director → cast member)."""
    return _send(to, f"[{production_name}] {subject}", _wrap(f"""
        <p style="color: #888; font-size: 12px; margin: 0 0 4px;">From {sender_name}</p>
        <h2 style="color: #2a2a2a; font-size: 18px; margin: 0 0 12px;">{subject}</h2>
        <div style="color: #555; font-size: 14px; line-height: 1.6; white-space: pre-wrap;">{body}</div>
        {_btn(_get_base_url(), "Open Call Board")}
    """))
