import { apiClient, apiUpload } from './api';
import type { CastProfile } from '@/types';

export async function getProfile(productionId: string) {
  return apiClient<CastProfile>(`/productions/${productionId}/profile`);
}

export async function createProfile(productionId: string, data: { display_name: string; phone?: string; role_character?: string }) {
  return apiClient<CastProfile>(`/productions/${productionId}/profile`, { method: 'POST', body: JSON.stringify(data) });
}

export async function uploadHeadshot(productionId: string, file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return apiUpload<{ headshot_url: string }>(`/productions/${productionId}/profile/headshot`, formData);
}

export async function deleteHeadshot(productionId: string) {
  return apiClient(`/productions/${productionId}/profile/headshot`, { method: 'DELETE' });
}
