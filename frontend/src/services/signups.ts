import { apiClient } from './api';

export interface SignupSlot {
  id: string;
  title: string;
  description: string | null;
  date: string;
  start_time: string;
  end_time: string;
  location: string | null;
  capacity: number;
  filled: number;
  full: boolean;
  people: { user_id: string; name: string }[];
  mine: boolean;
}

export interface SlotInput {
  title: string;
  description?: string;
  date: string;
  start_time: string;
  end_time: string;
  location?: string;
  capacity: number;
}

const base = (id: string) => `/productions/${id}/signups`;

export const listSlots = (id: string) => apiClient<SignupSlot[]>(base(id));
export const createSlot = (id: string, data: SlotInput) => apiClient<SignupSlot>(base(id), { method: 'POST', body: JSON.stringify(data) });
export const updateSlot = (id: string, slotId: string, data: Partial<SlotInput>) =>
  apiClient<SignupSlot>(`${base(id)}/${slotId}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteSlot = (id: string, slotId: string) => apiClient(`${base(id)}/${slotId}`, { method: 'DELETE' });
export const joinSlot = (id: string, slotId: string, force = false) =>
  apiClient<SignupSlot>(`${base(id)}/${slotId}/join${force ? '?force=true' : ''}`, { method: 'POST' });
export const leaveSlot = (id: string, slotId: string) => apiClient(`${base(id)}/${slotId}/join`, { method: 'DELETE' });
export const removeEntry = (id: string, slotId: string, userId: string) => apiClient(`${base(id)}/${slotId}/entries/${userId}`, { method: 'DELETE' });
