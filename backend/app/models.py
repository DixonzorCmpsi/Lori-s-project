"""SQLAlchemy ORM models."""

import datetime as dt
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Integer,
    LargeBinary,
    String,
    Text,
    Time,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def uuid_default():
    return str(uuid4())


def utcnow():
    return dt.datetime.utcnow()


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uuid_default)
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    google_id: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    age_range: Mapped[str | None] = mapped_column(String(10), nullable=True)
    email_notifications: Mapped[bool] = mapped_column(Boolean, default=True)
    parental_consent: Mapped[bool] = mapped_column(Boolean, default=False)
    parent_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    parent_phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    token_version: Mapped[int] = mapped_column(Integer, default=0)
    failed_login_attempts: Mapped[int] = mapped_column(Integer, default=0)
    locked_until: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    theaters: Mapped[list["Theater"]] = relationship(
        "Theater", back_populates="owner", foreign_keys="Theater.owner_id"
    )
    production_members: Mapped[list["ProductionMember"]] = relationship(
        "ProductionMember", back_populates="user"
    )
    cast_profiles: Mapped[list["CastProfile"]] = relationship("CastProfile", back_populates="user")
    conflict_submissions: Mapped[list["ConflictSubmission"]] = relationship(
        "ConflictSubmission", back_populates="user"
    )
    messages_sent: Mapped[list["Message"]] = relationship(
        "Message", back_populates="sender", foreign_keys="Message.sender_id"
    )


class Theater(Base):
    __tablename__ = "theaters"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uuid_default)
    owner_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    city: Mapped[str] = mapped_column(String(100), nullable=False)
    state: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)

    owner: Mapped["User"] = relationship("User", back_populates="theaters", foreign_keys=[owner_id])
    productions: Mapped[list["Production"]] = relationship(
        "Production", back_populates="theater", cascade="all, delete-orphan"
    )


class Production(Base):
    __tablename__ = "productions"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uuid_default)
    theater_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("theaters.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    estimated_cast_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    first_rehearsal: Mapped[dt.date] = mapped_column(Date, nullable=False)
    opening_night: Mapped[dt.date] = mapped_column(Date, nullable=False)
    closing_night: Mapped[dt.date] = mapped_column(Date, nullable=False)
    extra_conflict_windows: Mapped[int] = mapped_column(Integer, default=0)
    is_archived: Mapped[bool] = mapped_column(Boolean, default=False)
    archived_at: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    theater: Mapped["Theater"] = relationship("Theater", back_populates="productions")
    members: Mapped[list["ProductionMember"]] = relationship(
        "ProductionMember", back_populates="production", cascade="all, delete-orphan"
    )
    rehearsal_dates: Mapped[list["RehearsalDate"]] = relationship(
        "RehearsalDate", back_populates="production", cascade="all, delete-orphan"
    )
    bulletin_posts: Mapped[list["BulletinPost"]] = relationship(
        "BulletinPost", back_populates="production", cascade="all, delete-orphan"
    )
    cast_profiles: Mapped[list["CastProfile"]] = relationship(
        "CastProfile", back_populates="production", cascade="all, delete-orphan"
    )
    conflict_submissions: Mapped[list["ConflictSubmission"]] = relationship(
        "ConflictSubmission", back_populates="production", cascade="all, delete-orphan"
    )
    conversations: Mapped[list["Conversation"]] = relationship(
        "Conversation", back_populates="production", cascade="all, delete-orphan"
    )
    invite_tokens: Mapped[list["InviteToken"]] = relationship(
        "InviteToken", back_populates="production", cascade="all, delete-orphan"
    )
    scenes: Mapped[list["Scene"]] = relationship(
        "Scene", back_populates="production", cascade="all, delete-orphan"
    )
    teams: Mapped[list["Team"]] = relationship(
        "Team", back_populates="production", cascade="all, delete-orphan"
    )


class ProductionMember(Base):
    __tablename__ = "production_members"
    __table_args__ = (UniqueConstraint("production_id", "user_id", name="uq_production_user"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uuid_default)
    production_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("productions.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="cast")
    extra_conflict_windows: Mapped[int | None] = mapped_column(Integer, nullable=True)
    conflicts_used: Mapped[int] = mapped_column(Integer, default=0)
    # Secret token for this member's personal calendar feed (.ics subscription)
    calendar_token: Mapped[str | None] = mapped_column(String(64), unique=True, nullable=True)
    joined_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)

    production: Mapped["Production"] = relationship("Production", back_populates="members")
    user: Mapped["User"] = relationship("User", back_populates="production_members")


class RehearsalDate(Base):
    __tablename__ = "rehearsal_dates"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uuid_default)
    production_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("productions.id", ondelete="CASCADE"),
        nullable=False,
    )
    rehearsal_date: Mapped[dt.date] = mapped_column("date", Date, nullable=False)
    start_time: Mapped[dt.time] = mapped_column(Time, nullable=False)
    end_time: Mapped[dt.time] = mapped_column(Time, nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False)
    note: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    is_cancelled: Mapped[bool] = mapped_column(Boolean, default=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    deleted_at: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)

    production: Mapped["Production"] = relationship("Production", back_populates="rehearsal_dates")
    conflicts: Mapped[list["CastConflict"]] = relationship(
        "CastConflict", back_populates="rehearsal_date", cascade="all, delete-orphan"
    )


class BulletinPost(Base):
    __tablename__ = "bulletin_posts"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uuid_default)
    production_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("productions.id", ondelete="CASCADE"),
        nullable=False,
    )
    author_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    notify_members: Mapped[bool] = mapped_column(Boolean, default=False)
    requires_ack: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    production: Mapped["Production"] = relationship("Production", back_populates="bulletin_posts")


class CastProfile(Base):
    __tablename__ = "cast_profiles"
    __table_args__ = (UniqueConstraint("production_id", "user_id", name="uq_cast_profile"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uuid_default)
    production_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("productions.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    role_character: Mapped[str | None] = mapped_column(String(200), nullable=True)
    headshot_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    production: Mapped["Production"] = relationship("Production", back_populates="cast_profiles")
    user: Mapped["User"] = relationship("User", back_populates="cast_profiles")


class ConflictSubmission(Base):
    __tablename__ = "conflict_submissions"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uuid_default)
    production_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("productions.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    window_index: Mapped[int] = mapped_column(Integer, default=0)
    submitted_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)

    production: Mapped["Production"] = relationship(
        "Production", back_populates="conflict_submissions"
    )
    user: Mapped["User"] = relationship("User", back_populates="conflict_submissions")
    conflicts: Mapped[list["CastConflict"]] = relationship(
        "CastConflict", back_populates="submission", cascade="all, delete-orphan"
    )


class CastConflict(Base):
    __tablename__ = "cast_conflicts"
    __table_args__ = (UniqueConstraint("user_id", "rehearsal_date_id", name="uq_cast_conflict"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uuid_default)
    production_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("productions.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    rehearsal_date_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("rehearsal_dates.id", ondelete="CASCADE"),
        nullable=False,
    )
    submission_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("conflict_submissions.id", ondelete="CASCADE"),
        nullable=False,
    )
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    submitted_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)

    rehearsal_date: Mapped["RehearsalDate"] = relationship(
        "RehearsalDate", back_populates="conflicts"
    )
    submission: Mapped["ConflictSubmission"] = relationship(
        "ConflictSubmission", back_populates="conflicts"
    )


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uuid_default)
    production_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("productions.id", ondelete="CASCADE"),
        nullable=False,
    )
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)

    production: Mapped["Production"] = relationship("Production", back_populates="conversations")
    participants: Mapped[list["ConversationParticipant"]] = relationship(
        "ConversationParticipant",
        back_populates="conversation",
        cascade="all, delete-orphan",
    )
    messages: Mapped[list["Message"]] = relationship(
        "Message", back_populates="conversation", cascade="all, delete-orphan"
    )


class ConversationParticipant(Base):
    __tablename__ = "conversation_participants"
    __table_args__ = (
        UniqueConstraint("conversation_id", "user_id", name="uq_conversation_participant"),
    )

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uuid_default)
    conversation_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    conversation: Mapped["Conversation"] = relationship(
        "Conversation", back_populates="participants"
    )


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uuid_default)
    conversation_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    sender_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)

    conversation: Mapped["Conversation"] = relationship("Conversation", back_populates="messages")
    sender: Mapped["User"] = relationship("User", back_populates="messages_sent")


class InviteToken(Base):
    __tablename__ = "invite_tokens"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uuid_default)
    production_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("productions.id", ondelete="CASCADE"),
        nullable=False,
    )
    token: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    expires_at: Mapped[dt.datetime] = mapped_column(DateTime, nullable=False)
    max_uses: Mapped[int] = mapped_column(Integer, default=100)
    use_count: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)

    production: Mapped["Production"] = relationship("Production", back_populates="invite_tokens")


class Scene(Base):
    """A scene/act breakdown for the production (e.g. Act 1 Scene 2, pages 1-10)."""

    __tablename__ = "scenes"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uuid_default)
    production_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("productions.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)

    production: Mapped["Production"] = relationship("Production", back_populates="scenes")
    roles: Mapped[list["SceneRole"]] = relationship(
        "SceneRole", back_populates="scene", cascade="all, delete-orphan"
    )


class SceneRole(Base):
    """Links a cast member to a scene — which actors are needed for which scene."""

    __tablename__ = "scene_roles"
    __table_args__ = (UniqueConstraint("scene_id", "user_id", name="uq_scene_role"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uuid_default)
    scene_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("scenes.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    character_name: Mapped[str | None] = mapped_column(String(200), nullable=True)

    scene: Mapped["Scene"] = relationship("Scene", back_populates="roles")


class CastAssignment(Base):
    """Links a cast member to a specific rehearsal date — determines which dates
    each cast member sees on their personal calendar."""

    __tablename__ = "cast_assignments"
    __table_args__ = (UniqueConstraint("rehearsal_date_id", "user_id", name="uq_cast_assignment"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uuid_default)
    production_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("productions.id", ondelete="CASCADE"),
        nullable=False,
    )
    rehearsal_date_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("rehearsal_dates.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)

    production: Mapped["Production"] = relationship("Production")
    rehearsal_date: Mapped["RehearsalDate"] = relationship("RehearsalDate")
    user: Mapped["User"] = relationship("User")


class Attendance(Base):
    """Rehearsal check-in record — logs when a cast member checks in."""

    __tablename__ = "attendance"
    __table_args__ = (UniqueConstraint("rehearsal_date_id", "user_id", name="uq_attendance"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uuid_default)
    production_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("productions.id", ondelete="CASCADE"),
        nullable=False,
    )
    rehearsal_date_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("rehearsal_dates.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    checked_in_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="present"
    )  # present, late, absent, excused

    production: Mapped["Production"] = relationship("Production")
    rehearsal_date: Mapped["RehearsalDate"] = relationship("RehearsalDate")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uuid_default)
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    expires_at: Mapped[dt.datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)


class EmailVerificationToken(Base):
    __tablename__ = "email_verification_tokens"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uuid_default)
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    expires_at: Mapped[dt.datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)


class ChatRateLimit(Base):
    __tablename__ = "chat_rate_limits"
    __table_args__ = (UniqueConstraint("user_id", "window_start", name="uq_chat_rate_limit"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uuid_default)
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    window_start: Mapped[dt.datetime] = mapped_column(DateTime, nullable=False)
    message_count: Mapped[int] = mapped_column(Integer, default=1)


class BlockedMember(Base):
    """Blocked users cannot rejoin a production via invite link."""

    __tablename__ = "blocked_members"
    __table_args__ = (UniqueConstraint("production_id", "user_id", name="uq_blocked_member"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uuid_default)
    production_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("productions.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    blocked_by: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    blocked_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)


class Team(Base):
    """A named group within a production. Cast in the same team can message each other."""

    __tablename__ = "teams"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uuid_default)
    production_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("productions.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)

    production: Mapped["Production"] = relationship("Production", back_populates="teams")
    members: Mapped[list["TeamMember"]] = relationship(
        "TeamMember", back_populates="team", cascade="all, delete-orphan"
    )


class TeamMember(Base):
    """Links a user to a team within a production."""

    __tablename__ = "team_members"
    __table_args__ = (UniqueConstraint("team_id", "user_id", name="uq_team_member"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uuid_default)
    team_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("teams.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)

    team: Mapped["Team"] = relationship("Team", back_populates="members")


class EmergencyContact(Base):
    """Emergency contact for a user — supports 2 contacts (1 required, 1 optional)."""

    __tablename__ = "emergency_contacts"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uuid_default)
    user_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    contact_order: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    relationship: Mapped[str] = mapped_column(String(50), nullable=False, default="parent")
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class AuditLog(Base):
    """COPPA audit trail — logs data access, changes, consent, and deletions."""

    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uuid_default)
    user_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), nullable=True)
    actor_id: Mapped[str | None] = mapped_column(UUID(as_uuid=False), nullable=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)
    resource_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    details: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)


def _fk_production() -> Mapped[str]:
    return mapped_column(
        UUID(as_uuid=False),
        ForeignKey("productions.id", ondelete="CASCADE"),
        nullable=False,
    )


def _fk_user() -> Mapped[str]:
    return mapped_column(
        UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )


class Acknowledgement(Base):
    """A member confirming they have seen something (a bulletin post, a report)."""

    __tablename__ = "acknowledgements"
    __table_args__ = (UniqueConstraint("kind", "target_id", "user_id", name="uq_acknowledgement"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uuid_default)
    production_id: Mapped[str] = _fk_production()
    kind: Mapped[str] = mapped_column(String(20), nullable=False)  # bulletin, report
    target_id: Mapped[str] = mapped_column(String(36), nullable=False)
    user_id: Mapped[str] = _fk_user()
    acknowledged_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)


class AttendanceNotice(Base):
    """A cast member telling the stage manager they will be late or absent."""

    __tablename__ = "attendance_notices"
    __table_args__ = (UniqueConstraint("rehearsal_date_id", "user_id", name="uq_attendance_notice"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uuid_default)
    production_id: Mapped[str] = _fk_production()
    rehearsal_date_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("rehearsal_dates.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[str] = _fk_user()
    kind: Mapped[str] = mapped_column(String(10), nullable=False)  # late, absent
    minutes_late: Mapped[int | None] = mapped_column(Integer, nullable=True)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)


class RehearsalReport(Base):
    """Stage manager's end-of-day report, split into department sections."""

    __tablename__ = "rehearsal_reports"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uuid_default)
    production_id: Mapped[str] = _fk_production()
    rehearsal_date_id: Mapped[str | None] = mapped_column(
        UUID(as_uuid=False),
        ForeignKey("rehearsal_dates.id", ondelete="SET NULL"),
        nullable=True,
    )
    report_date: Mapped[dt.date] = mapped_column(Date, nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    author_id: Mapped[str] = _fk_user()
    sections: Mapped[dict] = mapped_column(JSON, default=dict)
    distribution: Mapped[list] = mapped_column(JSON, default=list)  # user ids
    status: Mapped[str] = mapped_column(String(10), default="draft")  # draft, sent
    sent_at: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


class SignupSlot(Base):
    """An open call: a shift or task that members can sign up for."""

    __tablename__ = "signup_slots"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uuid_default)
    production_id: Mapped[str] = _fk_production()
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    slot_date: Mapped[dt.date] = mapped_column(Date, nullable=False)
    start_time: Mapped[dt.time] = mapped_column(Time, nullable=False)
    end_time: Mapped[dt.time] = mapped_column(Time, nullable=False)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    capacity: Mapped[int] = mapped_column(Integer, default=1)
    created_by: Mapped[str] = _fk_user()
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)

    entries: Mapped[list["SignupEntry"]] = relationship(
        "SignupEntry", back_populates="slot", cascade="all, delete-orphan"
    )


class SignupEntry(Base):
    __tablename__ = "signup_entries"
    __table_args__ = (UniqueConstraint("slot_id", "user_id", name="uq_signup_entry"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uuid_default)
    slot_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("signup_slots.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[str] = _fk_user()
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)

    slot: Mapped["SignupSlot"] = relationship("SignupSlot", back_populates="entries")


class Document(Base):
    """A file shared with the company (script, music, handbook). Stored in the database."""

    __tablename__ = "documents"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uuid_default)
    production_id: Mapped[str] = _fk_production()
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    category: Mapped[str] = mapped_column(String(30), default="other")
    description: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    content_type: Mapped[str] = mapped_column(String(120), nullable=False)
    size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    data: Mapped[bytes] = mapped_column(LargeBinary, nullable=False, deferred=True)
    uploaded_by: Mapped[str] = _fk_user()
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)


class FormTemplate(Base):
    """A permission slip, waiver or policy that members e-sign."""

    __tablename__ = "form_templates"

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uuid_default)
    production_id: Mapped[str] = _fk_production()
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    requires_guardian: Mapped[bool] = mapped_column(Boolean, default=True)
    audience: Mapped[str] = mapped_column(String(10), default="all")  # all, cast
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[str] = _fk_user()
    created_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)

    signatures: Mapped[list["FormSignature"]] = relationship(
        "FormSignature", back_populates="form", cascade="all, delete-orphan"
    )


class FormSignature(Base):
    __tablename__ = "form_signatures"
    __table_args__ = (UniqueConstraint("form_id", "user_id", name="uq_form_signature"),)

    id: Mapped[str] = mapped_column(UUID(as_uuid=False), primary_key=True, default=uuid_default)
    form_id: Mapped[str] = mapped_column(
        UUID(as_uuid=False), ForeignKey("form_templates.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[str] = _fk_user()
    signed_name: Mapped[str] = mapped_column(String(200), nullable=False)
    guardian_name: Mapped[str | None] = mapped_column(String(200), nullable=True)
    guardian_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    signed_at: Mapped[dt.datetime] = mapped_column(DateTime, default=utcnow)

    form: Mapped["FormTemplate"] = relationship("FormTemplate", back_populates="signatures")
