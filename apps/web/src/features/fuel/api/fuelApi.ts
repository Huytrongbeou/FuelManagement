import { api } from '@/shared/api/client';
import type { FuelRecord } from '@/shared/types';

function toRecord(r: Record<string, unknown>): FuelRecord {
  return {
    id: r.id as string,
    stationId: r.stationId as string,
    date: r.date as string,
    previousFuel: r.previousFuel != null ? Number(r.previousFuel) : 0,
    added: r.added != null ? Number(r.added) : 0,
    hoursRun: r.hoursRun != null ? Number(r.hoursRun) : 0,
    consumed: r.consumed != null ? Number(r.consumed) : 0,
    endFuel: r.endFuel != null ? Number(r.endFuel) : 0,
    adjustmentAmount: r.adjustmentAmount != null ? Number(r.adjustmentAmount) : null,
    adjustmentForId: (r.adjustmentForId as string | null) ?? null,
    source: (r.source as 'manual' | 'import' | 'direct' | 'adjustment') ?? 'manual',
    note: (r.note as string) ?? undefined,
  };
}

export async function getFuelHistory(stationId: string, opts?: { limit?: number; offset?: number }): Promise<FuelRecord[]> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.offset) params.set('offset', String(opts.offset));
  const qs = params.toString() ? `?${params}` : '';
  const data = await api.get<Record<string, unknown>[]>(`/fuel/records/${stationId}${qs}`);
  return data.map(toRecord);
}

export async function postFuelRecord(dto: {
  stationId: string;
  stationCode: string;
  recordedDate: string;
  fuelAdded?: number;
  hoursRun?: number;
  notes?: string;
  recordedBy?: string;
}): Promise<FuelRecord> {
  const r = await api.post<Record<string, unknown>>('/fuel/records', dto);
  return toRecord(r);
}
