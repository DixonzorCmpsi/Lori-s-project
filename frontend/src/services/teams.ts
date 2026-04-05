import { apiClient } from './api';
import type { Team } from '@/types';

export async function getTeams(productionId: string) {
  return apiClient<Team[]>(`/productions/${productionId}/teams`);
}

export async function createTeam(productionId: string, name: string) {
  return apiClient<Team>(`/productions/${productionId}/teams`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export async function deleteTeam(productionId: string, teamId: string) {
  return apiClient(`/productions/${productionId}/teams/${teamId}`, { method: 'DELETE' });
}

export async function setTeamMembers(productionId: string, teamId: string, userIds: string[]) {
  return apiClient(`/productions/${productionId}/teams/${teamId}/members`, {
    method: 'POST',
    body: JSON.stringify({ user_ids: userIds }),
  });
}

export async function cycleMemberTeam(productionId: string, userId: string, teamId: string | null) {
  return apiClient(`/productions/${productionId}/teams/cycle-member`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId, team_id: teamId }),
  });
}

export async function getMyTeam(productionId: string) {
  return apiClient<{ teams: Team[]; teammate_user_ids: string[] }>(
    `/productions/${productionId}/teams/my-team`
  );
}
