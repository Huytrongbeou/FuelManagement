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

export type ActivityPeriod = 'today' | 'week' | 'month' | 'year';

export interface ActivityStats {
  period: ActivityPeriod;
  /** YYYY-MM-DD, đầu kỳ theo lịch VN */
  from: string;
  /** YYYY-MM-DD, ngày cuối kỳ (bao gồm) — luôn là hôm nay */
  to: string;
  entryCount: number;
  totalAdded: number;
  totalHours: number;
  totalConsumed: number;
  stationsUpdated: number;
}

export async function getActivityStats(period: ActivityPeriod): Promise<ActivityStats> {
  return api.get<ActivityStats>(`/fuel/stats/activity?period=${period}`);
}

export async function getFuelHistory(stationId: string, opts?: { limit?: number; offset?: number }): Promise<FuelRecord[]> {
  const params = new URLSearchParams();
  if (opts?.limit) params.set('limit', String(opts.limit));
  if (opts?.offset) params.set('offset', String(opts.offset));
  const qs = params.toString() ? `?${params}` : '';
  const data = await api.get<Record<string, unknown>[]>(`/fuel/records/${stationId}${qs}`);
  return data.map(toRecord);
}
