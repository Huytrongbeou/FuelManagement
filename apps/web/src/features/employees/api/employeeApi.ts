import { api } from '@/api/client';

export interface Employee {
  id: string;
  name: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function getEmployees(includeInactive = false): Promise<Employee[]> {
  return api.get<Employee[]>(`/employees${includeInactive ? '?all=true' : ''}`);
}

export function createEmployee(data: { name: string; phone?: string | null }): Promise<Employee> {
  return api.post<Employee>('/employees', data);
}

export function updateEmployee(id: string, data: { name?: string; phone?: string | null; isActive?: boolean }): Promise<Employee> {
  return api.patch<Employee>(`/employees/${id}`, data);
}

export function deactivateEmployee(id: string): Promise<Employee> {
  return api.delete<Employee>(`/employees/${id}`);
}
