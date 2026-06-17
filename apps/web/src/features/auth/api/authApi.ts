import { api } from '@/shared/api/client';

export type UserRole = 'admin' | 'manager' | 'staff'

export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  isActive: boolean;
}

export interface LoginResponse {
  token: string;
  user: AuthUser;
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  return api.post<LoginResponse>('/auth/login', { username, password });
}

export async function getMe(): Promise<AuthUser> {
  return api.get<AuthUser>('/auth/me');
}
