import { api, uploadFile } from '@/shared/api/client';
import type { ImportSession } from '@/shared/types';

function toSession(j: Record<string, unknown>): ImportSession {
  return {
    id: j.id as string,
    filename: j.filename as string,
    importedBy: (j.createdBy as string) ?? '',
    importedAt: j.createdAt as string,
    totalRows: (j.totalRows as number) ?? 0,
    validRows: (j.validRows as number) ?? 0,
    warningRows: (j.warningRows as number) ?? 0,
    errorRows: (j.invalidRows as number) ?? 0,
    status: j.status as ImportSession['status'],
  };
}

export async function uploadExcel(file: File): Promise<{ id: string; [key: string]: unknown }> {
  return uploadFile('/import/upload', file);
}

export async function getJobs(): Promise<ImportSession[]> {
  const data = await api.get<Record<string, unknown>[]>('/import/jobs');
  return data.map(toSession);
}

export async function getJob(id: string): Promise<Record<string, unknown>> {
  return api.get(`/import/jobs/${id}`);
}

export async function confirmJob(id: string, committedBy?: string): Promise<unknown> {
  return api.post(`/import/jobs/${id}/confirm`, { committed_by: committedBy });
}

export async function cancelJob(id: string): Promise<void> {
  await api.post(`/import/jobs/${id}/cancel`);
}

export function getTemplateUrl(): string {
  const base = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  const token = localStorage.getItem('fuel_token');
  return `${base}/export/template${token ? `?token=${token}` : ''}`;
}

export function getSnapshotUrl(): string {
  const base = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  const token = localStorage.getItem('fuel_token');
  return `${base}/export/snapshot${token ? `?token=${token}` : ''}`;
}
