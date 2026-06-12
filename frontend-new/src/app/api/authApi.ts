import { api } from './client';

export interface AuthUser {
  id: string;
  username: string;
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
