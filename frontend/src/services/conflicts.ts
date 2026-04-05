import { apiClient } from './api';
import type { ConflictStatus } from '@/types';

export interface ConflictDate {
  rehearsal_date_id: string;
  reason?: string;
}

export async function submitConflicts(productionId: string, dates: ConflictDate[]) {
  return apiClient(`/productions/${productionId}/conflicts`, { method: 'POST', body: JSON.stringify({ dates }) });
}

export async function getConflicts(productionId: string) {
  return apiClient<any[]>(`/productions/${productionId}/conflicts`);
}

export async function getConflictStatus(productionId: string) {
  return apiClient<ConflictStatus>(`/productions/${productionId}/conflicts/status`);
}
