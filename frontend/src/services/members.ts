import { apiClient } from './api';
import type { Member } from '@/types';

export async function getMembers(productionId: string) {
  return apiClient<Member[]>(`/productions/${productionId}/members`);
}

export async function promoteMember(productionId: string, userId: string) {
  return apiClient(`/productions/${productionId}/members/${userId}/promote`, { method: 'POST' });
}

export async function demoteMember(productionId: string, userId: string) {
  return apiClient(`/productions/${productionId}/members/${userId}/demote`, { method: 'POST' });
}

export async function removeMember(productionId: string, userId: string) {
  return apiClient(`/productions/${productionId}/members/${userId}`, { method: 'DELETE' });
}

export async function resetConflicts(productionId: string, userId: string) {
  return apiClient(`/productions/${productionId}/members/${userId}/reset-conflicts`, { method: 'POST' });
}

export async function blockMember(productionId: string, userId: string, reason?: string) {
  return apiClient(`/productions/${productionId}/members/${userId}/block`, {
    method: 'POST', body: JSON.stringify({ reason: reason || null }),
  });
}

export async function unblockMember(productionId: string, userId: string) {
  return apiClient(`/productions/${productionId}/members/${userId}/unblock`, { method: 'POST' });
}

export async function getBlockedMembers(productionId: string) {
  return apiClient<{ user_id: string; name: string; email: string; reason: string | null; blocked_at: string }[]>(
    `/productions/${productionId}/members/blocked`
  );
}
