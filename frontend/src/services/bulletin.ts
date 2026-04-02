import { apiClient } from './api';
import type { BulletinPost } from '@/types';

export async function getPosts(productionId: string) {
  return apiClient<BulletinPost[]>(`/productions/${productionId}/bulletin`);
}

export async function createPost(productionId: string, data: { title: string; body: string; notify_members?: boolean }) {
  return apiClient<BulletinPost>(`/productions/${productionId}/bulletin`, { method: 'POST', body: JSON.stringify(data) });
}

export async function updatePost(productionId: string, postId: string, data: { title?: string; body?: string }) {
  return apiClient<BulletinPost>(`/productions/${productionId}/bulletin/${postId}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deletePost(productionId: string, postId: string) {
  return apiClient(`/productions/${productionId}/bulletin/${postId}`, { method: 'DELETE' });
}

export async function pinPost(productionId: string, postId: string) {
  return apiClient(`/productions/${productionId}/bulletin/${postId}/pin`, { method: 'POST' });
}
