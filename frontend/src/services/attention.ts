import { apiClient } from './api';

export interface NextCall {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  type: string;
  location: string | null;
  is_today: boolean;
  my_status: string | null;
  my_notice: { kind: string; minutes_late: number | null } | null;
}

export interface Attention {
  pending_acks: { kind: string; id: string; title: string }[];
  forms_to_sign: { id: string; title: string }[];
  next_call: NextCall | null;
  unconfirmed_posts?: { id: string; title: string; pending: number; total: number }[];
  incomplete_forms?: { id: string; title: string; pending: number; total: number }[];
  notices?: { user_id: string; name: string; kind: string; minutes_late: number | null; note: string | null; rehearsal_date_id: string; date: string; start_time: string }[];
  double_booking_count?: number;
}

export const getAttention = (productionId: string) => apiClient<Attention>(`/productions/${productionId}/attention`);
