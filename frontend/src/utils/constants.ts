export const API_BASE_URL = '/api';

export const MAX_LENGTHS = {
  email: 320,
  name: 200,
  theater_name: 200,
  city: 100,
  state: 100,
  production_name: 200,
  post_title: 200,
  post_body: 10000,
  note: 1000,
  conflict_reason: 500,
  message_body: 2000,
  display_name: 200,
  phone: 20,
  role_character: 200,
} as const;

export const ROLES = {
  DIRECTOR: 'director' as const,
  STAFF: 'staff' as const,
  CAST: 'cast' as const,
};

export const SCHEDULE_COLORS = {
  regular: { bg: 'bg-amber-600/20', text: 'text-amber-400', label: 'Regular' },
  tech: { bg: 'bg-blue-600/20', text: 'text-blue-400', label: 'Tech' },
  dress: { bg: 'bg-purple-600/20', text: 'text-purple-400', label: 'Dress' },
  performance: { bg: 'bg-red-600/20', text: 'text-red-400', label: 'Performance' },
} as const;

export const CONFLICT_SEVERITY = {
  none: { bg: 'bg-green-600/20', text: 'text-green-400' },
  low: { bg: 'bg-amber-600/20', text: 'text-amber-400' },
  medium: { bg: 'bg-orange-600/20', text: 'text-orange-400' },
  high: { bg: 'bg-red-600/20', text: 'text-red-400' },
} as const;

export function getConflictSeverity(count: number) {
  if (count === 0) return CONFLICT_SEVERITY.none;
  if (count <= 2) return CONFLICT_SEVERITY.low;
  if (count <= 4) return CONFLICT_SEVERITY.medium;
  return CONFLICT_SEVERITY.high;
}
