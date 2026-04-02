"""Chat router."""

import uuid
from datetime import datetime, timedelta
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select, and_

from app.database import async_session_maker
from app.models import (
    ProductionMember,
    Conversation,
    ConversationParticipant,
    Message,
    User,
    ChatRateLimit,
)
from app.routers.auth import get_current_user
from app.services.business_logic import can_send_message, FIELD_MAX_LENGTHS

router = APIRouter()

# In-memory chat rate limits (reset when module is reimported or app is recreated)
import time as _time_mod
from collections import defaultdict as _defaultdict
_chat_rate_limits: dict = _defaultdict(list)


class SendMessageRequest(BaseModel):
    recipient_id: str
    body: str


async def check_production_member(production_id: str, user_id: str) -> ProductionMember:
    """Check user is a member of production."""
    async with async_session_maker() as session:
        stmt = select(ProductionMember).where(
            ProductionMember.user_id == user_id,
            ProductionMember.production_id == production_id,
        )
        result = await session.execute(stmt)
        member = result.scalar_one_or_none()

        if not member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "FORBIDDEN",
                    "message": "Not a member of this production",
                },
            )
        return member


def check_chat_permission(sender_role: str, recipient_role: str) -> bool:
    """Check if sender can message recipient based on roles."""
    return can_send_message(sender_role, recipient_role)


@router.get("/{production_id}/contacts")
async def get_contacts(
    production_id: str,
    current_user: dict = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Get contact list for chat."""
    member = await check_production_member(production_id, current_user["id"])

    async with async_session_maker() as session:
        if member.role == "cast":
            # Cast can only see director and staff
            stmt = (
                select(ProductionMember, User)
                .join(User)
                .where(
                    ProductionMember.production_id == production_id,
                    ProductionMember.role.in_(["director", "staff"]),
                )
            )
        else:
            # Director/Staff can see everyone
            stmt = (
                select(ProductionMember, User)
                .join(User)
                .where(
                    ProductionMember.production_id == production_id,
                    ProductionMember.user_id != current_user["id"],
                )
            )

        result = await session.execute(stmt)
        contacts = result.all()

        return [
            {
                "id": u.id,
                "name": u.name,
                "role": m.role,
            }
            for m, u in contacts
        ]


@router.get("/{production_id}/conversations")
async def list_conversations(
    production_id: str,
    current_user: dict = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """List all conversations."""
    member = await check_production_member(production_id, current_user["id"])

    async with async_session_maker() as session:
        stmt = select(ConversationParticipant).where(
            ConversationParticipant.user_id == current_user["id"]
        )
        result = await session.execute(stmt)
        participation = result.scalars().all()

        conv_ids = [p.conversation_id for p in participation]

        if not conv_ids:
            return []

        conversations = []
        for conv_id in conv_ids:
            stmt = select(Conversation).where(Conversation.id == conv_id)
            result = await session.execute(stmt)
            conv = result.scalar_one_or_none()

            if conv:
                # Get other participant
                stmt = (
                    select(ConversationParticipant, User)
                    .join(User)
                    .where(
                        ConversationParticipant.conversation_id == conv_id,
                        ConversationParticipant.user_id != current_user["id"],
                    )
                )
                result = await session.execute(stmt)
                other = result.first()

                if other:
                    participant, user = other
                    # Get role from production membership
                    pm_stmt = select(ProductionMember).where(
                        ProductionMember.production_id == production_id,
                        ProductionMember.user_id == user.id,
                    )
                    pm_result = await session.execute(pm_stmt)
                    pm = pm_result.scalar_one_or_none()
                    # Get last message
                    stmt = (
                        select(Message)
                        .where(
                            Message.conversation_id == conv_id,
                        )
                        .order_by(Message.created_at.desc())
                        .limit(1)
                    )
                    result = await session.execute(stmt)
                    last_msg = result.scalar_one_or_none()

                    # Get unread count
                    stmt = select(Message).where(
                        Message.conversation_id == conv_id,
                        Message.sender_id != current_user["id"],
                        Message.is_read == False,
                    )
                    result = await session.execute(stmt)
                    unread = len(result.scalars().all())

                    conversations.append(
                        {
                            "id": conv.id,
                            "participant_id": user.id,
                            "participant_name": user.name,
                            "participant_role": pm.role if pm else "cast",
                            "last_message": last_msg.body if last_msg else None,
                            "last_message_at": last_msg.created_at.isoformat()
                            if last_msg
                            else None,
                            "unread_count": unread,
                        }
                    )

        # Sort by last message time
        conversations.sort(key=lambda x: x["last_message_at"] or "", reverse=True)

        return conversations


@router.post("/{production_id}/messages", status_code=201)
async def send_message(
    production_id: str,
    body: SendMessageRequest,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Send a message to another user."""
    member = await check_production_member(production_id, current_user["id"])

    recipient_id = body.recipient_id
    message_body = body.body

    # Validate body length
    if len(message_body) > FIELD_MAX_LENGTHS.get("message_body", 2000):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "VALIDATION_ERROR", "message": "Message too long"},
        )

    if not message_body.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"error": "VALIDATION_ERROR", "message": "Message cannot be empty"},
        )

    # Check recipient role for cast boundary
    async with async_session_maker() as session:
        stmt = select(ProductionMember).where(
            ProductionMember.production_id == production_id,
            ProductionMember.user_id == recipient_id,
        )
        result = await session.execute(stmt)
        recipient_member = result.scalar_one_or_none()

        if not recipient_member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "NOT_FOUND", "message": "Recipient not found"},
            )

        # Check chat permission
        if not check_chat_permission(member.role, recipient_member.role):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": "FORBIDDEN", "message": "Cannot message this user"},
            )

        # Check rate limit (30 per minute) — in-memory
        uid = current_user["id"]
        now = _time_mod.time()
        _chat_rate_limits[uid] = [t for t in _chat_rate_limits[uid] if now - t < 60]
        if len(_chat_rate_limits[uid]) >= 30:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"error": "RATE_LIMITED", "message": "Rate limit exceeded. Try again later."},
            )
        _chat_rate_limits[uid].append(now)

        # Find or create conversation (deduplication)
        # Look for existing conversation between these two users in this production
        from sqlalchemy import and_
        my_convos = select(ConversationParticipant.conversation_id).where(
            ConversationParticipant.user_id == current_user["id"]
        ).subquery()
        their_convos = select(ConversationParticipant.conversation_id).where(
            ConversationParticipant.user_id == recipient_id
        ).subquery()
        stmt = (
            select(Conversation)
            .where(
                Conversation.production_id == production_id,
                Conversation.id.in_(select(my_convos)),
                Conversation.id.in_(select(their_convos)),
            )
        )
        result = await session.execute(stmt)
        conv = result.scalar_one_or_none()

        if not conv:
            conv = Conversation(
                id=str(uuid.uuid4()),
                production_id=production_id,
            )
            session.add(conv)
            session.add(ConversationParticipant(
                id=str(uuid.uuid4()),
                conversation_id=conv.id,
                user_id=current_user["id"],
            ))
            session.add(ConversationParticipant(
                id=str(uuid.uuid4()),
                conversation_id=conv.id,
                user_id=recipient_id,
            ))
            await session.flush()

        # Create message
        message = Message(
            id=str(uuid.uuid4()),
            conversation_id=conv.id,
            sender_id=current_user["id"],
            body=message_body,
        )
        session.add(message)

        await session.commit()

        return {
            "id": message.id,
            "conversation_id": conv.id,
            "sender_id": message.sender_id,
            "body": message.body,
            "created_at": message.created_at.isoformat(),
        }


@router.get("/{production_id}/conversations/{conversation_id}/messages")
async def get_messages(
    production_id: str,
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Get messages in a conversation."""
    member = await check_production_member(production_id, current_user["id"])

    async with async_session_maker() as session:
        # Verify user is participant
        stmt = select(ConversationParticipant).where(
            ConversationParticipant.conversation_id == conversation_id,
            ConversationParticipant.user_id == current_user["id"],
        )
        result = await session.execute(stmt)
        if not result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": "FORBIDDEN", "message": "Not a participant"},
            )

        # Get messages
        stmt = (
            select(Message)
            .where(
                Message.conversation_id == conversation_id,
            )
            .order_by(Message.created_at.asc())
            .limit(50)
        )

        result = await session.execute(stmt)
        messages = result.scalars().all()

        return {
            "messages": [
                {
                    "id": m.id,
                    "sender_id": m.sender_id,
                    "body": m.body,
                    "is_read": m.is_read,
                    "is_deleted": m.is_deleted,
                    "created_at": m.created_at.isoformat(),
                }
                for m in messages
            ],
        }


@router.post("/{production_id}/conversations/{conversation_id}/mark-read")
async def mark_read(
    production_id: str,
    conversation_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Mark messages as read."""
    await check_production_member(production_id, current_user["id"])

    async with async_session_maker() as session:
        stmt = select(Message).where(
            Message.conversation_id == conversation_id,
            Message.sender_id != current_user["id"],
            Message.is_read == False,
        )
        result = await session.execute(stmt)
        messages = result.scalars().all()

        for m in messages:
            m.is_read = True

        await session.commit()

        return {"message": "Marked as read"}


@router.get("/{production_id}/unread-count")
async def get_unread_count(
    production_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict:
    """Get total unread message count."""
    member = await check_production_member(production_id, current_user["id"])

    async with async_session_maker() as session:
        stmt = select(ConversationParticipant).where(
            ConversationParticipant.user_id == current_user["id"]
        )
        result = await session.execute(stmt)
        participation = result.scalars().all()

        conv_ids = [p.conversation_id for p in participation]

        if not conv_ids:
            return {"count": 0}

        stmt = select(Message).where(
            Message.conversation_id.in_(conv_ids),
            Message.sender_id != current_user["id"],
            Message.is_read == False,
        )
        result = await session.execute(stmt)
        count = len(result.scalars().all())

        return {"count": min(count, 99) if count > 99 else count}


@router.delete("/{production_id}/messages/{message_id}")
async def delete_message(
    production_id: str,
    message_id: str,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Delete a message."""
    member = await check_production_member(production_id, current_user["id"])

    async with async_session_maker() as session:
        stmt = select(Message).where(Message.id == message_id)
        result = await session.execute(stmt)
        message = result.scalar_one_or_none()

        if not message:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"error": "NOT_FOUND", "message": "Message not found"},
            )

        # Check permissions: director can delete any, users can delete own within 5 min
        is_director = member.role == "director"
        is_own_message = message.sender_id == current_user["id"]

        if is_director:
            message.body = "[Message removed by director]"
            message.is_deleted = True
        elif is_own_message:
            age = datetime.utcnow() - message.created_at
            if age > timedelta(minutes=5):
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail={
                        "error": "FORBIDDEN",
                        "message": "Cannot delete after 5 minutes",
                    },
                )
            message.body = "[Message deleted]"
            message.is_deleted = True
        else:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error": "FORBIDDEN",
                    "message": "Cannot delete others' messages",
                },
            )

        await session.commit()

        return {
            "id": message.id,
            "body": message.body,
            "is_deleted": message.is_deleted,
        }


@router.get("/{production_id}/messages/deleted")
async def get_deleted_messages(
    production_id: str,
    current_user: dict = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Get deletion log — all deleted messages in the production."""
    member = await check_production_member(production_id, current_user["id"])

    if member.role != "director":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "FORBIDDEN", "message": "Only directors can view deletion log"},
        )

    async with async_session_maker() as session:
        stmt = (
            select(Message)
            .join(Conversation)
            .where(
                Conversation.production_id == production_id,
                Message.is_deleted == True,
            )
            .order_by(Message.created_at.desc())
        )
        result = await session.execute(stmt)
        messages = result.scalars().all()

        return [
            {
                "id": m.id,
                "conversation_id": m.conversation_id,
                "body": m.body,
                "is_deleted": m.is_deleted,
                "created_at": m.created_at.isoformat() if m.created_at else None,
            }
            for m in messages
        ]


# --- Group / Broadcast Messaging ---

class BroadcastRequest(BaseModel):
    body: str
    target: str = "all"  # "all", "cast", "staff", or a scene_id


@router.post("/{production_id}/broadcast", status_code=201)
async def broadcast_message(
    production_id: str,
    body: BroadcastRequest,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Director/staff broadcasts a message to a group.
    target: 'all' | 'cast' | 'staff' | '<scene_id>'
    Creates individual conversations with each recipient."""
    member = await check_production_member(production_id, current_user["id"])
    if member.role not in ("director", "staff"):
        raise HTTPException(status_code=403, detail={"error": "FORBIDDEN", "message": "Only director/staff can broadcast"})

    if not body.body or not body.body.strip():
        raise HTTPException(status_code=400, detail={"error": "INVALID", "message": "Message body required"})
    if len(body.body) > 2000:
        raise HTTPException(status_code=400, detail={"error": "INVALID", "message": "Message too long (max 2000)"})

    async with async_session_maker() as session:
        # Determine recipients
        if body.target == "all":
            stmt = select(ProductionMember).where(
                ProductionMember.production_id == production_id,
                ProductionMember.user_id != current_user["id"],
            )
        elif body.target == "cast":
            stmt = select(ProductionMember).where(
                ProductionMember.production_id == production_id,
                ProductionMember.role == "cast",
            )
        elif body.target == "staff":
            stmt = select(ProductionMember).where(
                ProductionMember.production_id == production_id,
                ProductionMember.role == "staff",
            )
        else:
            # Scene-specific broadcast — get users assigned to this scene
            from app.models import SceneRole
            scene_roles = (await session.execute(
                select(SceneRole).where(SceneRole.scene_id == body.target)
            )).scalars().all()
            scene_user_ids = [r.user_id for r in scene_roles]
            if not scene_user_ids:
                raise HTTPException(status_code=404, detail={"error": "NOT_FOUND", "message": "No cast in this scene"})
            stmt = select(ProductionMember).where(
                ProductionMember.production_id == production_id,
                ProductionMember.user_id.in_(scene_user_ids),
            )

        recipients = (await session.execute(stmt)).scalars().all()
        sent_count = 0

        for recipient in recipients:
            if recipient.user_id == current_user["id"]:
                continue

            # Find or create conversation
            from sqlalchemy import exists
            subq = select(ConversationParticipant.conversation_id).where(
                ConversationParticipant.user_id == current_user["id"]
            ).correlate(Conversation)
            subq2 = select(ConversationParticipant.conversation_id).where(
                ConversationParticipant.user_id == recipient.user_id
            ).correlate(Conversation)

            conv_result = await session.execute(
                select(Conversation).where(
                    Conversation.production_id == production_id,
                    Conversation.id.in_(subq),
                    Conversation.id.in_(subq2),
                )
            )
            conv = conv_result.scalar_one_or_none()

            if not conv:
                conv = Conversation(id=str(uuid.uuid4()), production_id=production_id)
                session.add(conv)
                await session.flush()
                session.add(ConversationParticipant(
                    id=str(uuid.uuid4()), conversation_id=conv.id, user_id=current_user["id"]
                ))
                session.add(ConversationParticipant(
                    id=str(uuid.uuid4()), conversation_id=conv.id, user_id=recipient.user_id
                ))

            msg = Message(
                id=str(uuid.uuid4()),
                conversation_id=conv.id,
                sender_id=current_user["id"],
                body=body.body,
            )
            session.add(msg)
            sent_count += 1

        await session.commit()

    return {"sent_to": sent_count, "target": body.target}


# --- Report Delay (one-way cast -> director) ---

class ReportDelayRequest(BaseModel):
    message: str = Field(max_length=500)
    rehearsal_date_id: Optional[str] = None


@router.post("/{production_id}/report-delay", status_code=201)
async def report_delay(
    production_id: str,
    body: ReportDelayRequest,
    current_user: dict = Depends(get_current_user),
) -> dict[str, Any]:
    """Cast member sends a one-way delay notice to the director.
    Creates a DM to the director with a formatted delay message."""
    member = await check_production_member(production_id, current_user["id"])

    async with async_session_maker() as session:
        # Find the director
        director_result = await session.execute(
            select(ProductionMember).where(
                ProductionMember.production_id == production_id,
                ProductionMember.role == "director",
            )
        )
        director = director_result.scalar_one_or_none()
        if not director:
            raise HTTPException(status_code=404, detail={"error": "NOT_FOUND", "message": "No director found"})

        # Find or create conversation with director
        subq = select(ConversationParticipant.conversation_id).where(
            ConversationParticipant.user_id == current_user["id"]
        )
        subq2 = select(ConversationParticipant.conversation_id).where(
            ConversationParticipant.user_id == director.user_id
        )
        conv_result = await session.execute(
            select(Conversation).where(
                Conversation.production_id == production_id,
                Conversation.id.in_(subq),
                Conversation.id.in_(subq2),
            )
        )
        conv = conv_result.scalar_one_or_none()

        if not conv:
            conv = Conversation(id=str(uuid.uuid4()), production_id=production_id)
            session.add(conv)
            await session.flush()
            session.add(ConversationParticipant(
                id=str(uuid.uuid4()), conversation_id=conv.id, user_id=current_user["id"]
            ))
            session.add(ConversationParticipant(
                id=str(uuid.uuid4()), conversation_id=conv.id, user_id=director.user_id
            ))

        # Send formatted delay message
        delay_text = f"[DELAY NOTICE] {body.message}"
        msg = Message(
            id=str(uuid.uuid4()),
            conversation_id=conv.id,
            sender_id=current_user["id"],
            body=delay_text,
        )
        session.add(msg)
        await session.commit()

    return {"sent": True, "to": "director"}
