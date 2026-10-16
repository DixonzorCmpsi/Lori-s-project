import { apiClient } from './api';

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';
export type NoticeKind = 'late' | 'absent';

export interface Notice {
  kind: NoticeKind;
  minutes_late: number | null;
  note: string | null;
  created_at: string;
}

export interface CallDate {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  type: string;
  location: string | null;
  note: string | null;
  is_cancelled: boolean;
}

export interface CalledPerson {
  user_id: string;
  name: string;
  status?: AttendanceStatus | null;
  checked_in_at?: string | null;
  notice?: Notice | null;
  has_conflict?: boolean;
}

export interface DoubleBooking {
  kind: 'room' | 'person' | 'overlap' | 'signup';
  date: string;
  location: string | null;
  items: { id: string; type: string; start_time: string; end_time: string; location: string | null }[];
  people: { user_id: string; name: string }[];
  slot?: { id: string; title: string; start_time: string; end_time: string };
}

export interface CallSheet {
  date: CallDate;
  full_company: boolean;
  called: CalledPerson[];
  my: { called: boolean; status: AttendanceStatus | null; checked_in_at: string | null; notice: Notice | null };
  summary?: { called: number; present: number; late: number; absent: number; excused: number; unmarked: number; notices: number };
  warnings?: DoubleBooking[];
}

export interface MemberAttendance {
  user_id: string;
  name: string;
  called: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  unmarked: number;
  rate: number | null;
}

export const getCallSheet = (productionId: string, dateId: string) =>
  apiClient<CallSheet>(`/productions/${productionId}/call-sheet/${dateId}`);

export const checkIn = (productionId: string, dateId: string) =>
  apiClient<{ status: string; already_checked_in: boolean }>(`/productions/${productionId}/attendance/check-in`, {
    method: 'POST', body: JSON.stringify({ rehearsal_date_id: dateId }),
  });

export const markAttendance = (productionId: string, dateId: string, userId: string, status: AttendanceStatus) =>
  apiClient(`/productions/${productionId}/attendance/${dateId}/status/${userId}?status=${status}`, { method: 'PUT' });

export const clearAttendance = (productionId: string, dateId: string, userId: string) =>
  apiClient(`/productions/${productionId}/attendance/${dateId}/status/${userId}`, { method: 'DELETE' });

export const sendNotice = (productionId: string, data: { rehearsal_date_id: string; kind: NoticeKind; minutes_late?: number; note?: string }) =>
  apiClient(`/productions/${productionId}/attendance/notice`, { method: 'POST', body: JSON.stringify(data) });

export const withdrawNotice = (productionId: string, dateId: string) =>
  apiClient(`/productions/${productionId}/attendance/notice/${dateId}`, { method: 'DELETE' });

export const getAttendanceByMember = (productionId: string) =>
  apiClient<MemberAttendance[]>(`/productions/${productionId}/attendance/by-member`);

export const getDoubleBookings = (productionId: string) =>
  apiClient<DoubleBooking[]>(`/productions/${productionId}/double-bookings`);
