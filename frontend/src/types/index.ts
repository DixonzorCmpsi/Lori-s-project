export interface User {
  id: string;
  email: string;
  name: string;
  age_range: string | null;
  email_verified: boolean;
  email_notifications: boolean;
  parental_consent: boolean;
  parent_email: string | null;
  avatar_url?: string;
  created_at?: string;
}

export interface Theater {
  id: string;
  owner_id: string;
  name: string;
  city: string;
  state: string;
  created_at?: string;
}

export interface Production {
  id: string;
  theater_id: string;
  name: string;
  estimated_cast_size: number;
  extra_conflict_windows: number;
  first_rehearsal: string;
  opening_night: string;
  closing_night: string;
  is_archived: boolean;
  archived_at?: string;
  created_at?: string;
}

export interface RehearsalDate {
  id: string;
  production_id: string;
  date: string;
  start_time: string;
  end_time: string;
  type: 'regular' | 'tech' | 'dress' | 'performance' | 'blocked';
  note: string | null;
  is_cancelled: boolean;
  is_deleted: boolean;
}

export interface BulletinPost {
  id: string;
  production_id: string;
  author_id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  notify_members: boolean;
  created_at: string;
  updated_at?: string;
}

export interface Member {
  id: string;
  production_id: string;
  user_id: string;
  role: Role;
  joined_at?: string;
  name?: string;
  email?: string;
  conflicts_submitted?: boolean;
}

export interface InviteToken {
  id: string;
  production_id: string;
  token: string;
  expires_at: string;
  max_uses: number;
  use_count: number;
}

export interface CastProfile {
  id: string;
  production_id: string;
  user_id: string;
  display_name: string;
  phone: string | null;
  role_character: string | null;
  headshot_url: string | null;
}

export interface ConflictSubmission {
  id: string;
  production_id: string;
  user_id: string;
  submitted_at: string;
}

export interface CastConflict {
  id: string;
  rehearsal_date_id: string;
  reason: string | null;
}

export interface Conversation {
  id: string;
  participant_id: string;
  participant_name: string;
  participant_role: string;
  last_message: string | null;
  last_message_sender_id: string | null;
  last_message_at: string | null;
  unread_count: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  is_read: boolean;
  is_deleted: boolean;
  created_at: string;
}

export interface ApiError {
  error: string;
  message: string;
  fields?: { field: string; message: string }[];
}

export interface Team {
  id: string;
  name: string;
  member_count: number;
  member_user_ids: string[];
}

export interface ConflictStatus {
  submissions_used: number;
  total_windows: number;
  remaining_windows: number;
  has_initial_submission: boolean;
}

export type Role = 'director' | 'staff' | 'cast';

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
