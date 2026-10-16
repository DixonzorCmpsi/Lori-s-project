import { apiClient } from './api';

export interface ReportSummary {
  id: string;
  title: string;
  report_date: string;
  rehearsal_date_id: string | null;
  status: 'draft' | 'sent';
  sent_at: string | null;
  author_id: string;
  author_name: string | null;
  recipient_count: number;
}

export interface AttendanceSnapshot {
  called: number;
  present: number;
  late: { name: string; minutes: number | null }[];
  absent: string[];
  excused: string[];
  not_marked: number;
  notices: { name: string; kind: string; minutes_late: number | null; note: string | null }[];
}

export interface Report extends ReportSummary {
  sections: Record<string, string>;
  distribution: string[];
  my_acknowledged: boolean;
  attendance: AttendanceSnapshot | null;
  recipients?: { user_id: string; name: string; role: string; acknowledged_at: string | null }[];
}

export interface ReportInput {
  title: string;
  report_date: string;
  rehearsal_date_id?: string | null;
  sections: Record<string, string>;
  distribution: string[];
}

const base = (id: string) => `/productions/${id}/reports`;

export const getReportTemplate = (id: string) => apiClient<{ sections: { key: string; label: string }[] }>(`${base(id)}/template`);
export const listReports = (id: string) => apiClient<ReportSummary[]>(base(id));
export const getReport = (id: string, reportId: string) => apiClient<Report>(`${base(id)}/${reportId}`);
export const getAttendanceSnapshot = (id: string, dateId: string) => apiClient<Partial<AttendanceSnapshot>>(`${base(id)}/snapshot/${dateId}`);
export const createReport = (id: string, data: ReportInput) => apiClient<ReportSummary>(base(id), { method: 'POST', body: JSON.stringify(data) });
export const updateReport = (id: string, reportId: string, data: Partial<ReportInput>) =>
  apiClient<ReportSummary>(`${base(id)}/${reportId}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteReport = (id: string, reportId: string) => apiClient(`${base(id)}/${reportId}`, { method: 'DELETE' });
export const sendReport = (id: string, reportId: string) =>
  apiClient<{ recipients: number; emailed: number }>(`${base(id)}/${reportId}/send`, { method: 'POST' });
export const acknowledgeReport = (id: string, reportId: string) => apiClient(`${base(id)}/${reportId}/ack`, { method: 'POST' });
