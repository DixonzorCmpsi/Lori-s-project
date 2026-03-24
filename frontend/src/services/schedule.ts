import { apiClient } from './api';
import type { RehearsalDate } from '@/types';

export interface ScheduleWizardInput {
  selected_days: string[];
  start_time: string;
  end_time: string;
  blocked_dates: string[];
  tech_week_enabled: boolean;
  tech_week_days: number;
  dress_rehearsal_enabled: boolean;
}

export async function generateSchedule(productionId: string, input: ScheduleWizardInput) {
  return apiClient<{ dates: RehearsalDate[] }>(`/productions/${productionId}/schedule/generate`, {
    method: 'POST', body: JSON.stringify(input),
  });
}

export async function getSchedule(productionId: string) {
  return apiClient<RehearsalDate[]>(`/productions/${productionId}/schedule`);
}

export async function addDate(productionId: string, data: { date: string; start_time: string; end_time: string; type: string }) {
  return apiClient<RehearsalDate>(`/productions/${productionId}/schedule`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updateDate(productionId: string, dateId: string, data: { start_time?: string; end_time?: string; note?: string }) {
  return apiClient<RehearsalDate>(`/productions/${productionId}/schedule/${dateId}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function cancelDate(productionId: string, dateId: string) {
  return apiClient(`/productions/${productionId}/schedule/${dateId}/cancel`, { method: 'POST' });
}

export async function deleteDate(productionId: string, dateId: string, permanent = false) {
  return apiClient(`/productions/${productionId}/schedule/${dateId}${permanent ? '?permanent=true' : ''}`, { method: 'DELETE' });
}
