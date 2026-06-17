import { api } from './client';

export interface DirectEntryRow {
  stationCode: string;
  stationName?: string;
  brandName?: string | null;
  modelName?: string | null;
  consumptionRate?: number | null;
  maxCapacity?: number | null;
  fuelAdded?: number | null;
  hoursRun?: number | null;
  recordedDate?: string | null;
  notes?: string | null;
}

export interface PreviewResult {
  jobId: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  warningRows: number;
  rows: Record<string, unknown>[];
}

export async function previewEntry(rows: DirectEntryRow[], createdBy?: string): Promise<PreviewResult> {
  return api.post<PreviewResult>('/manual-entry/preview', { rows, createdBy });
}

export async function confirmEntry(jobId: string, committedBy?: string): Promise<unknown> {
  return api.post('/manual-entry/confirm', { jobId, committedBy });
}
