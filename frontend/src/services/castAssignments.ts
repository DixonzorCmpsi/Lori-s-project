import { apiClient } from './api';

export interface MemberDetails {
  user_id: string;
  name: string | null;
  email: string | null;
  role: string;
  display_name: string | null;
  character: string | null;
  phone: string | null;
  headshot_url: string | null;
  conflicts_submitted: boolean;
  conflicts: { date: string | null; reason: string | null }[];
  assigned_dates: { id: string; date: string; type: string; start_time: string; end_time: string }[];
}

export interface CastAssignment {
  id: string;
  user_id: string;
  rehearsal_date_id: string;
  date: string | null;
  type: string | null;
  start_time: string | null;
  end_time: string | null;
}

export function getMemberDetails(productionId: string, userId: string) {
  return apiClient<MemberDetails>(`/productions/${productionId}/members/${userId}/details`);
}

export function getAssignments(productionId: string, userId?: string) {
  const qs = userId ? `?user_id=${userId}` : '';
  return apiClient<CastAssignment[]>(`/productions/${productionId}/assignments${qs}`);
}

export function assignCast(productionId: string, userId: string, rehearsalDateId: string) {
  return apiClient(`/productions/${productionId}/assignments`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, rehearsal_date_id: rehearsalDateId }),
  });
}

export function bulkAssignCast(productionId: string, userId: string, rehearsalDateIds: string[]) {
  return apiClient(`/productions/${productionId}/assignments/bulk`, {
    method: 'PUT',
    body: JSON.stringify({ user_id: userId, rehearsal_date_ids: rehearsalDateIds }),
  });
}

export function unassignCast(productionId: string, userId: string, rehearsalDateId: string) {
  return apiClient(`/productions/${productionId}/assignments?user_id=${userId}&rehearsal_date_id=${rehearsalDateId}`, {
    method: 'DELETE',
  });
}
