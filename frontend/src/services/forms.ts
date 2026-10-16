import { apiClient } from './api';

export interface FormListItem {
  id: string;
  title: string;
  audience: 'all' | 'cast';
  requires_guardian: boolean;
  is_active: boolean;
  created_at: string;
  signed: boolean;
  applies_to_me: boolean;
  signed_count?: number;
  required_count?: number;
}

export interface FormDetail {
  id: string;
  title: string;
  body: string;
  audience: 'all' | 'cast';
  requires_guardian: boolean;
  is_active: boolean;
  applies_to_me: boolean;
  locked: boolean;
  my_signature: { signed_name: string; signed_at: string; guardian_name: string | null; guardian_email: string | null } | null;
}

export interface SignatureStatus {
  form_id: string;
  title: string;
  signed: { user_id: string; name: string; role: string; signed_at: string; guardian_name: string | null; guardian_email: string | null }[];
  pending: { user_id: string; name: string; role: string; is_minor: boolean }[];
}

const base = (id: string) => `/productions/${id}/forms`;

export const listForms = (id: string) => apiClient<FormListItem[]>(base(id));
export const getForm = (id: string, formId: string) => apiClient<FormDetail>(`${base(id)}/${formId}`);
export const createForm = (id: string, data: { title: string; body: string; requires_guardian: boolean; audience: string }) =>
  apiClient<{ id: string }>(base(id), { method: 'POST', body: JSON.stringify(data) });
export const updateForm = (id: string, formId: string, data: Record<string, unknown>) =>
  apiClient(`${base(id)}/${formId}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteForm = (id: string, formId: string) => apiClient(`${base(id)}/${formId}`, { method: 'DELETE' });
export const signForm = (id: string, formId: string, data: { signed_name: string; agree: boolean; guardian_name?: string; guardian_email?: string }) =>
  apiClient(`${base(id)}/${formId}/sign`, { method: 'POST', body: JSON.stringify(data) });
export const getSignatures = (id: string, formId: string) => apiClient<SignatureStatus>(`${base(id)}/${formId}/signatures`);
export const remindUnsigned = (id: string, formId: string) =>
  apiClient<{ pending: number; emailed: number }>(`${base(id)}/${formId}/remind`, { method: 'POST' });
