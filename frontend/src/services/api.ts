import { API_BASE_URL } from '@/utils/constants';
import type { ApiError } from '@/types';

const TOKEN_KEY = 'dcb_token';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiRequestError extends Error {
  code: string;
  fields?: { field: string; message: string }[];
  status: number;
  detail: Record<string, unknown>;

  constructor(status: number, body: ApiError & Record<string, unknown>) {
    super(body.message);
    this.code = body.error;
    this.fields = body.fields;
    this.status = status;
    this.detail = body;
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearStoredToken();
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    const body = await response.json().catch(() => ({ error: 'UNAUTHORIZED', message: 'Session expired' }));
    throw new ApiRequestError(401, body);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({
      error: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    }));
    throw new ApiRequestError(response.status, body);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export async function apiUpload<T>(
  endpoint: string,
  formData: FormData
): Promise<T> {
  const token = getStoredToken();
  const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({
      error: 'INTERNAL_ERROR',
      message: 'Upload failed',
    }));
    throw new ApiRequestError(response.status, body);
  }

  return response.json();
}
