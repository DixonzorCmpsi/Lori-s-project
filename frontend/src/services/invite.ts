import { apiClient } from './api';
import type { InviteToken } from '@/types';

export async function getInvite(productionId: string) {
  return apiClient<InviteToken>(`/productions/${productionId}/invite`);
}

export async function createInvite(productionId: string) {
  return apiClient<InviteToken>(`/productions/${productionId}/invite`, { method: 'POST' });
}

export async function regenerateInvite(productionId: string) {
  return apiClient<InviteToken>(`/productions/${productionId}/invite/regenerate`, { method: 'POST' });
}
