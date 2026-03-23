/**
 * Tests for Chat View components.
 *
 * Covers:
 * - CHAT-05: Cast contact list
 * - CHAT-06: Director contact list
 * - CHAT-08: Unread count badge
 * - CHAT-10: Message max length
 * - Message display and sending
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
// import { ChatView } from '@/components/chat/ChatView'
// import { ConversationList } from '@/components/chat/ConversationList'
// import { MessageThread } from '@/components/chat/MessageThread'

describe('ConversationList', () => {
  it.todo('renders list of conversations sorted by most recent')
  it.todo('shows contact name and last message preview')
  it.todo('shows unread count badge per conversation')
  it.todo('shows "New Message" button')
})

describe('ContactPicker', () => {
  it.todo('shows eligible contacts based on role')
  it.todo('cast sees only Director and Staff')
  it.todo('director sees all Staff and Cast')
  it.todo('staff sees Director + Staff + Cast')
  it.todo('cast does NOT see other cast members')
})

describe('MessageThread', () => {
  it.todo('renders messages ordered oldest-first')
  it.todo('shows sender name and timestamp')
  it.todo('shows "[Message deleted]" for deleted messages')
  it.todo('shows "[Message removed by director]" for moderated messages')
  it.todo('shows message input field')
  it.todo('enforces 2000 char max on input')
  it.todo('sends message on Enter key')
  it.todo('disables send button for empty input')
  it.todo('shows load-more button for older messages (pagination)')
})

describe('UnreadBadge', () => {
  it.todo('shows exact count for 1-99 unread')
  it.todo('shows "99+" when count >= 100')
  it.todo('shows no badge when count is 0')
})

describe('MessageDeletion', () => {
  it.todo('shows delete option on own message within 5 minutes')
  it.todo('hides delete option on own message after 5 minutes')
  it.todo('Director sees delete option on all messages')
  it.todo('Staff does NOT see delete on others messages')
})

describe('ChatRateLimit', () => {
  it.todo('shows rate limit error when exceeding 30/min')
})
