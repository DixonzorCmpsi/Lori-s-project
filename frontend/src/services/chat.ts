import { apiClient } from './api';
import type { Conversation, Message } from '@/types';

export async function getContacts(productionId: string) {
  return apiClient<{ id: string; name: string; role: string }[]>(`/productions/${productionId}/contacts`);
}

export async function getConversations(productionId: string) {
  return apiClient<Conversation[]>(`/productions/${productionId}/conversations`);
}

export async function sendMessage(productionId: string, recipientId: string, body: string) {
  return apiClient<Message>(`/productions/${productionId}/messages`, {
    method: 'POST', body: JSON.stringify({ recipient_id: recipientId, body }),
  });
}

export async function getMessages(productionId: string, conversationId: string) {
  return apiClient<{ messages: Message[] }>(`/productions/${productionId}/conversations/${conversationId}/messages`);
}

export async function markRead(productionId: string, conversationId: string) {
  return apiClient(`/productions/${productionId}/conversations/${conversationId}/mark-read`, { method: 'POST' });
}

export async function getUnreadCount(productionId: string) {
  return apiClient<{ count: number }>(`/productions/${productionId}/unread-count`);
}

export async function deleteMessage(productionId: string, messageId: string) {
  return apiClient<Message>(`/productions/${productionId}/messages/${messageId}`, { method: 'DELETE' });
}

export async function broadcastMessage(productionId: string, body: string, target: string) {
  return apiClient<{ sent_count: number }>(`/productions/${productionId}/broadcast`, {
    method: 'POST', body: JSON.stringify({ body, target }),
  });
}
