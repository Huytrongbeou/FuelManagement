import { api, uploadFile } from '@/api/client';
import type { ImportSession, ImportRowIssue } from '@/@types';

/**
 * Derives the real per-row errors / warnings / affected stations for the detail view from the
 * job's own previewData (falling back to validationErrors). Previously the detail dialog showed
 * hardcoded placeholder data regardless of which job was opened.
 */
function deriveDetail(j: Record<string, unknown>, status: string): Pick<ImportSession, 'errors' | 'warnings' | 'affectedStations'> {
  const rows = Array.isArray(j.previewData) ? (j.previewData as Array<Record<string, unknown>>) : [];
  const errors: ImportRowIssue[] = [];
  const warnings: ImportRowIssue[] = [];
  const affected = new Set<string>();

  for (const r of rows) {
    const row = Number(r.rowNum ?? 0);
    const code = String(r.stationCode ?? '');
    const errs = Array.isArray(r.errors) ? (r.errors as string[]) : [];
    const warns = Array.isArray(r.warnings) ? (r.warnings as string[]) : [];
    if (errs.length) errors.push({ row, code, message: errs.join('; ') });
    if (warns.length) warnings.push({ row, code, message: warns.join('; ') });
    // Only a committed import actually updated any station.
    if (status === 'committed' && r.hasFuelActivity && errs.length === 0 && code) affected.add(code);
  }

  // Fallback: older/edge jobs may have validationErrors but no previewData.
  if (errors.length === 0 && Array.isArray(j.validationErrors)) {
    for (const v of j.validationErrors as Array<Record<string, unknown>>) {
      const errs = Array.isArray(v.errors) ? (v.errors as string[]) : [];
      if (errs.length) errors.push({ row: Number(v.row ?? 0), code: '', message: errs.join('; ') });
    }
  }

  return { errors, warnings, affectedStations: [...affected] };
}

function toSession(j: Record<string, unknown>): ImportSession {
  const status = j.status as ImportSession['status'];
  return {
    id: j.id as string,
    filename: j.filename as string,
    importedBy: (j.createdBy as string) ?? '',
    importedAt: j.createdAt as string,
    totalRows: (j.totalRows as number) ?? 0,
    validRows: (j.validRows as number) ?? 0,
    warningRows: (j.warningRows as number) ?? 0,
    errorRows: (j.invalidRows as number) ?? 0,
    status,
    ...deriveDetail(j, status),
  };
}

export async function uploadExcel(file: File): Promise<{ id: string; [key: string]: unknown }> {
  return uploadFile('/import/upload', file);
}

export async function getJobs(): Promise<ImportSession[]> {
  const data = await api.get<Record<string, unknown>[]>('/import/jobs');
  return data.map(toSession);
}

export async function confirmJob(id: string, opts?: { committedBy?: string; acknowledgeWarnings?: boolean }): Promise<unknown> {
  return api.post(`/import/jobs/${id}/confirm`, { committed_by: opts?.committedBy, acknowledgeWarnings: opts?.acknowledgeWarnings });
}
