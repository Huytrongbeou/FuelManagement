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

export async function confirmJob(id: string, committedBy?: string): Promise<unknown> {
  return api.post(`/import/jobs/${id}/confirm`, { committed_by: committedBy });
}
