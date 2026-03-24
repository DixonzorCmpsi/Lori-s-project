import { apiClient } from './api';
import type { User } from '@/types';

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface RegisterResponse {
  id?: string;
  email?: string;
  name?: string;
  age_range?: string;
  email_verified?: boolean;
  message?: string;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  return apiClient<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function register(data: {
  email: string;
  name: string;
  password: string;
  date_of_birth: string;
}): Promise<RegisterResponse> {
  return apiClient<RegisterResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getMe(): Promise<User> {
  return apiClient<User>('/auth/me');
}

export async function logout(): Promise<void> {
  return apiClient('/auth/logout', { method: 'POST' });
}

export async function logoutAll(): Promise<void> {
  return apiClient('/auth/logout-all', { method: 'POST' });
}

export async function forgotPassword(email: string): Promise<{ message: string }> {
  return apiClient('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, new_password: string): Promise<{ message: string }> {
  return apiClient('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, new_password }),
  });
}

export async function verifyEmail(token: string): Promise<{ message: string }> {
  return apiClient('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function resendVerification(email: string): Promise<{ message: string }> {
  return apiClient('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function completeProfile(date_of_birth: string): Promise<{ age_range: string }> {
  return apiClient('/auth/complete-profile', {
    method: 'POST',
    body: JSON.stringify({ date_of_birth }),
  });
}

export async function deleteAccount(): Promise<void> {
  return apiClient('/auth/account', { method: 'DELETE' });
}
