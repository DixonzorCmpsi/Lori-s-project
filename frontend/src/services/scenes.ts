import { apiClient } from './api';

export interface SceneCast {
  user_id: string;
  name: string;
  character_name: string | null;
}

export interface Scene {
  id: string;
  name: string;
  description: string | null;
  order_index: number;
  cast: SceneCast[];
}

export interface SceneAvailability {
  scene_id: string;
  name: string;
  status: 'green' | 'yellow' | 'red';
  total_cast: number;
  conflicts: { user_id: string; name: string; reason: string | null }[];
}

const base = (id: string) => `/productions/${id}/scenes`;

export const listScenes = (id: string) => apiClient<Scene[]>(base(id));
export const createScene = (id: string, data: { name: string; description?: string; order_index: number }) =>
  apiClient<Scene>(base(id), { method: 'POST', body: JSON.stringify(data) });
export const updateScene = (id: string, sceneId: string, data: { name?: string; description?: string; order_index?: number }) =>
  apiClient(`${base(id)}/${sceneId}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteScene = (id: string, sceneId: string) => apiClient(`${base(id)}/${sceneId}`, { method: 'DELETE' });
export const addSceneCast = (id: string, sceneId: string, data: { user_id: string; character_name?: string }) =>
  apiClient(`${base(id)}/${sceneId}/cast`, { method: 'POST', body: JSON.stringify(data) });
export const updateSceneCast = (id: string, sceneId: string, userId: string, characterName: string) =>
  apiClient(`${base(id)}/${sceneId}/cast/${userId}`, { method: 'PATCH', body: JSON.stringify({ character_name: characterName }) });
export const removeSceneCast = (id: string, sceneId: string, userId: string) =>
  apiClient(`${base(id)}/${sceneId}/cast/${userId}`, { method: 'DELETE' });
export const getSceneAvailability = (id: string, dateId: string) =>
  apiClient<SceneAvailability[]>(`${base(id)}/availability?rehearsal_date_id=${dateId}`);
