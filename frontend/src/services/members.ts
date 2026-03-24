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
