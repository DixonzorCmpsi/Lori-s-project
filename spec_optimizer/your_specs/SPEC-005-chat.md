# SPEC-005: Chat System

**Status:** Draft
**Last Updated:** 2026-03-21
**Depends On:** SPEC-001, SPEC-002

---

## Goals (Immutable)

- 1-on-1 DMs with role-based boundaries enforced at the API level
- WebSocket real-time delivery with authenticated upgrade and periodic session revalidation
- Conversation deduplication via SELECT ... FOR UPDATE to prevent duplicate conversations
- Rate limiting at 30 messages per minute per user
- Director message moderation (delete any message in their production)
- Self-delete window of exactly 5 minutes for users deleting their own messages

## Non-Goals (Explicit Exclusions)

- Group chats
- File or image sharing in chat
- Read receipts beyond the is_read boolean
- Typing indicators
- Message search
- Chat export
- End-to-end encryption
- Automated content filtering

## Success Metric

A cast member can NEVER see another cast member in their contact list or send them a message, even via direct API calls. All messages deliver in under 2 seconds via WebSocket.

## Immutable Constraints

- Cast-to-cast messaging is blocked at the API level, not just the UI. Any cast-to-cast message attempt returns 403 Forbidden.
- Messages have a maximum length of 2000 characters enforced by a DB CHECK constraint: `CHECK (char_length(body) <= 2000)`.
- WebSocket auth validates the session on upgrade handshake AND re-validates every 5 minutes. Expired sessions close with code 4401.
- Rate limit is exactly 30 messages per minute per user. Exceeding returns an error frame (WebSocket) or HTTP 429 (REST).
- Director can delete any message in any conversation within their production.
- Self-delete window is exactly 5 minutes from message creation. After 5 minutes, only the Director can delete.

---

## 1. Overview

The chat system provides 1-on-1 direct messages with strict role-based boundaries enforced at the API level.

## 2. Chat Rules by Role

| Sender | Can Message | Cannot Message |
|--------|------------|----------------|
| Director | Anyone in the production | — |
| Staff | Anyone in the production | — |
| Cast | Director and Staff only | Other cast members |

Cast-to-cast messaging is blocked at the API level (see Section 8).

## 3. Chat Architecture

### 3.1 Conversation Model

Chats are **1-on-1 direct messages** between two users within a production context.

- No group chats in v1 (bulletin board serves the group communication need)
- Conversations are scoped to a production
- A conversation is created on first message between two users
- **Conversation deduplication:** Before creating a new conversation, the server MUST check if a conversation already exists between the same two participants in the same production. Use a `SELECT ... FOR UPDATE` within a transaction to prevent race conditions where two simultaneous requests create duplicate conversations. If a conversation exists, reuse it

### 3.2 Message Flow

```
User opens Chat
  -> Sees list of conversations (sorted by most recent message `created_at DESC`)
  -> Clicks a conversation -> sees message history (ordered by `created_at ASC`, paginated at 50 messages per page, load-more for older)
  -> Types message -> sends
  -> Recipient sees message in real-time (WebSocket) or on next load
```

### 3.3 Who Appears in the Contact List

| User Role | Sees in Contact List |
|-----------|---------------------|
| Director | All Staff + All Cast in production |
| Staff | Director + All Staff + All Cast in production |
| Cast | Director + All Staff in production |

Cast members MUST NOT see other cast members in their contact list. The query MUST filter by `role IN ('director', 'staff')` for cast users.

### 3.4 Starting a New Conversation

1. User clicks "New Message" button in the chat view
2. A contact picker shows all eligible contacts (filtered by role per Section 3.3)
3. User selects a contact
4. Server runs the deduplication check (Section 3.1): if a conversation already exists with this participant pair in this production, return it. Otherwise create a new one
5. User is redirected to the conversation view and can type their first message

## 4. Real-Time Delivery

- **Production:** Supabase Realtime channels for real-time message delivery. Each conversation has a channel (`conversation:{id}`). When a message is saved via API, the server broadcasts to the channel. Client subscribes on chat page load.
- **Development:** Local `ws` WebSocket server (or Supabase Realtime if dev has Supabase configured). Controlled by `NEXT_PUBLIC_REALTIME_PROVIDER` env var (`supabase` or `ws`).
- **Fallback:** If Realtime connection drops, client polls `GET /api/conversations/:id/messages` every 10 seconds until reconnected.
- Messages are persisted to PostgreSQL (via Drizzle ORM) immediately on send, regardless of realtime transport.
- Unread message count MUST be shown as a numeric badge on the Chat nav item. Display the exact count for 1-99; display "99+" when the count is 100+.

### 4.1 WebSocket Authentication

**Note:** In production with Supabase Realtime, authentication is handled via short-lived JWTs (see below). The ws-specific auth rules apply to the local dev WebSocket server and the self-hosted fallback.

WebSocket connections MUST be authenticated. The upgrade handshake is not automatically protected by HTTP-only cookies in all environments.

**Requirements:**

**Production (Supabase Realtime):**

- The server generates a short-lived JWT (5-minute expiry) for each authenticated user via a `POST /api/realtime/token` endpoint. This JWT is signed with the Supabase JWT secret and includes the user's ID, production ID, and role
- The client uses this JWT to authenticate with Supabase Realtime channels
- Channel access is controlled by Supabase Row Level Security (RLS) policies that verify the JWT claims against production_members
- When the JWT expires (every 5 minutes), the client requests a fresh token. If the user's session has been revoked, the new token request MUST fail with 401 and the client MUST disconnect. If the user's role has changed, the new token reflects the updated role
- Cast-to-Cast blocking is enforced by RLS: a Cast member's JWT only grants subscribe access to channels where the other participant has the role `director` and channels where the other participant has the role `staff`

**Development / Self-Hosted (ws library):**

- On WebSocket upgrade, the server validates the session cookie. If auth fails, reject with HTTP 401
- Sessions are re-validated every 5 minutes. If expired or revoked, close with code 4401
- Each connection is scoped to a single production. The server verifies membership before allowing upgrade
- Cast-to-Cast blocking enforced on every message send

### 4.2 Rate Limiting

- **Message rate limit:** Max 30 messages per minute per user across all conversations
- Exceeding the limit MUST return an error frame over WebSocket. For the REST fallback, exceeding the limit MUST return HTTP `429`
- **Production:** Rate limit tracked in the database: a `chat_rate_limits` table with `(user_id, window_start TIMESTAMPTZ, message_count INTEGER)`. On each message, the server increments the count for the current 60-second window. If count exceeds 30, the message is rejected. Old windows are cleaned up lazily. **Development:** In-memory counter (simpler, acceptable for local dev).

## 5. Message Format

| Field | Type | Notes |
|-------|------|-------|
| Sender | User reference | Who sent it |
| Body | Text | Plain text, max 2000 chars |
| Timestamp | DateTime | Server-set on receipt |
| Read | Boolean | Whether recipient has seen it |

No file attachments, images, or rich formatting in v1.

### 5.1 Read Status

Messages are marked as read when the recipient opens the conversation. The client MUST send `POST /api/conversations/:id/mark-read` when the conversation view is opened and whenever the browser tab gains focus. This sets `is_read = TRUE` on all messages in that conversation where `sender_id != current_user_id` and `is_read = FALSE`. The unread count badge on the Chat nav item reflects the total unread messages across all conversations. No read receipt notification is sent to the sender (non-goal).

## 6. Database Schema

```sql
-- Cross-references: full schemas in SPEC-002 and SPEC-003
CREATE TABLE users (id UUID PRIMARY KEY);
CREATE TABLE productions (id UUID PRIMARY KEY);

CREATE TABLE conversations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_id UUID NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE conversation_participants (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(conversation_id, user_id)
);

-- Deduplication: find-or-create pattern using SELECT ... FOR UPDATE in a transaction.
-- Before INSERT INTO conversations, query for an existing conversation where BOTH
-- participants match within the same production. If found, reuse it.

CREATE TABLE messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES users(id),
  body            TEXT NOT NULL CHECK (char_length(body) <= 2000),
  is_read         BOOLEAN DEFAULT FALSE,
  is_deleted      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Deleted messages: When a message is deleted (by Director moderation or self-delete within 5 min),
-- the row is UPDATE'd: body is replaced with '[Message removed by director]' or '[Message deleted]',
-- and a `is_deleted BOOLEAN DEFAULT FALSE` flag is set to TRUE. The original body is not recoverable.

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_unread ON messages(conversation_id, is_read) WHERE is_read = FALSE;

CREATE TABLE chat_rate_limits (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  window_start  TIMESTAMPTZ NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 1,
  UNIQUE(user_id, window_start)
);
```

## 7. Message Moderation

**Director moderation capabilities:**
- Director can **delete any message** in any conversation within their production
- Deleted messages are replaced with "[Message removed by director]" — they are not silently erased. The original message body is overwritten in the database (not recoverable)
- Director can **view a deletion log**: a list of all deleted messages showing message ID, conversation ID, deleted_at timestamp, deleted_by user ID, and the replacement text. This log is a query against `messages WHERE is_deleted = TRUE` ordered by `created_at DESC`, paginated at 50 per page
- Staff MUST NOT delete other users' messages. Only the Director has moderation rights. Staff attempts return `403 Forbidden`

**User capabilities:**
- Any user can delete their **own** messages within 5 minutes of sending. After 5 minutes, messages are permanent (unless Director deletes)
- Deleted-by-user messages show "[Message deleted]" to the other participant

Moderation is manual by the Director. No automated content filtering exists in v1.

**Real-time deletion propagation:** When a message is deleted via the API, the server broadcasts a `message:deleted` event on the conversation's Realtime channel (or WebSocket in dev) with the message ID and replacement text. The client updates the local message in-place without requiring a page refresh.

## 8. Access Control Enforcement

The chat boundary is enforced at the **API level**, not just the UI:

1. When a Cast member requests their contact list, the query filters out other Cast members
2. When a Cast member sends a message, the server MUST verify the recipient's role is `director` / `staff`. Recipients with the role `cast` MUST be rejected with 403
3. If a Cast member attempts to message another Cast member via API, return `403 Forbidden`

## 9. Test Scenarios

| ID | Scenario | Expected Result |
|----|----------|-----------------|
| CHAT-01 | Director sends message to cast member | Message delivered, visible to both |
| CHAT-02 | Cast sends message to director | Message delivered, visible to both |
| CHAT-03 | Cast sends message to staff | Message delivered, visible to both |
| CHAT-04 | Cast attempts to message another cast member | 403 Forbidden |
| CHAT-05 | Cast contact list | Only shows Director and Staff |
| CHAT-06 | Director contact list | Shows all Staff and Cast |
| CHAT-07 | Real-time delivery via WebSocket | Recipient sees message without refresh |
| CHAT-08 | Unread count | Badge shows correct unread message count |
| CHAT-09 | User not in production tries to chat | 403 Forbidden |
| CHAT-10 | Message exceeds 2000 chars | Rejected with validation error |
| CHAT-11 | User sends 31+ messages in one minute | Rate limited, error returned |
| CHAT-12 | WebSocket upgrade without valid session | 401 Rejected |
| CHAT-13 | Session expires during active WebSocket | Connection closed with code 4401 |
| CHAT-14 | Two users simultaneously start a conversation | Only one conversation created (dedup) |
| CHAT-15 | Cast member sends WebSocket frame to another cast | Server rejects, boundary enforced |
| CHAT-16 | Staff member (elevated cast) contacts list | Shows Director + other Staff + all Cast |
| CHAT-17 | Director deletes a cast member's message | Message replaced with "[Message removed by director]" |
| CHAT-18 | User deletes own message within 5 minutes | Message replaced with "[Message deleted]" |
| CHAT-19 | User tries to delete own message after 5 minutes | Deletion blocked — message is permanent |
| CHAT-20 | Staff tries to delete another user's message | 403 Forbidden — only Director can moderate |
