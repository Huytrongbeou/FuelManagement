import { api } from '@/api/client';

export type UserRole = 'admin' | 'manager' | 'staff';

export interface ManagedUser {
  id: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Quản trị viên',
  manager: 'Quản lý',
  staff: 'Nhân viên',
};

export function getUsers(): Promise<ManagedUser[]> {
  return api.get<ManagedUser[]>('/users');
}

export function createUser(data: { username: string; password: string; role: UserRole }): Promise<ManagedUser> {
  return api.post<ManagedUser>('/users', data);
}

/** Every field is optional — send only what changed. */
export function updateUser(
  id: string,
  data: { role?: UserRole; isActive?: boolean; password?: string }
): Promise<ManagedUser> {
  return api.patch<ManagedUser>(`/users/${id}`, data);
}

/** Deactivates rather than erasing, so past fuel records keep pointing at a real account. */
export function deactivateUser(id: string): Promise<ManagedUser> {
  return api.delete<ManagedUser>(`/users/${id}`);
}
