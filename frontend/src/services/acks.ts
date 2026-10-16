import { apiClient } from './api';

export interface AckPerson {
  user_id: string;
  name: string;
  role: string;
  acknowledged_at?: string;
}

export interface AckStatus {
  post_id: string;
  title: string;
  requires_ack: boolean;
  acknowledged: AckPerson[];
  pending: AckPerson[];
}

export const acknowledgePost = (productionId: string, postId: string) =>
  apiClient<{ acknowledged: boolean }>(`/productions/${productionId}/bulletin/${postId}/ack`, { method: 'POST' });

export const getAckStatus = (productionId: string, postId: string) =>
  apiClient<AckStatus>(`/productions/${productionId}/bulletin/${postId}/acks`);

export const remindPending = (productionId: string, postId: string) =>
  apiClient<{ pending: number; emailed: number }>(`/productions/${productionId}/bulletin/${postId}/acks/remind`, { method: 'POST' });
