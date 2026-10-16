import { apiClient, apiUpload, getStoredToken } from './api';
import { API_BASE_URL } from '@/utils/constants';

export const DOCUMENT_CATEGORIES = [
  { id: 'script', label: 'Script' },
  { id: 'music', label: 'Music' },
  { id: 'schedule', label: 'Schedule' },
  { id: 'handbook', label: 'Handbook' },
  { id: 'design', label: 'Design' },
  { id: 'other', label: 'Other' },
] as const;

export interface DocumentItem {
  id: string;
  title: string;
  category: string;
  description: string | null;
  filename: string;
  content_type: string;
  size_bytes: number;
  uploaded_by_name: string | null;
  created_at: string;
}

const base = (id: string) => `/productions/${id}/documents`;

export const listDocuments = (id: string) => apiClient<DocumentItem[]>(base(id));

export function uploadDocument(id: string, file: File, meta: { title: string; category: string; description: string }) {
  const form = new FormData();
  form.append('file', file);
  form.append('title', meta.title);
  form.append('category', meta.category);
  form.append('description', meta.description);
  return apiUpload<DocumentItem>(base(id), form);
}

export const updateDocument = (id: string, docId: string, data: { title?: string; category?: string; description?: string }) =>
  apiClient<DocumentItem>(`${base(id)}/${docId}`, { method: 'PATCH', body: JSON.stringify(data) });

export const deleteDocument = (id: string, docId: string) => apiClient(`${base(id)}/${docId}`, { method: 'DELETE' });

/** Fetch the file with the auth header and return it as a Blob. */
export async function fetchDocumentBlob(id: string, doc: DocumentItem): Promise<Blob> {
  const token = getStoredToken();
  const response = await fetch(`${API_BASE_URL}${base(id)}/${doc.id}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!response.ok) throw new Error('Could not load that file');
  return response.blob();
}

/** Save a Blob to the user's computer. */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadDocument(id: string, doc: DocumentItem): Promise<void> {
  saveBlob(await fetchDocumentBlob(id, doc), doc.filename);
}

export type ViewKind = 'pdf' | 'image' | 'audio' | 'video' | 'text' | 'markdown' | 'csv' | 'docx' | 'xlsx' | 'none';

/** How a file can be shown inside the app. Anything else is offered as a download. */
export function viewKind(filename: string): ViewKind {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) return 'image';
  if (['mp3', 'm4a', 'wav'].includes(ext)) return 'audio';
  if (ext === 'mp4') return 'video';
  if (ext === 'txt') return 'text';
  if (['md', 'markdown'].includes(ext)) return 'markdown';
  if (ext === 'csv') return 'csv';
  if (ext === 'docx') return 'docx';
  if (ext === 'xlsx') return 'xlsx';
  return 'none';
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
