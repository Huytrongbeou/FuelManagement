import { api } from '@/shared/api/client';
import type { AdjustmentRequest } from '@/shared/types';

export async function createAdjustmentRequest(dto: {
  originalRecordId: string;
  reason: string;
  newFuelAdded: number;
  newHoursRun: number;
  newNotes?: string | null;
}): Promise<AdjustmentRequest> {
  return api.post<AdjustmentRequest>('/fuel/adjustment-requests', dto);
}

export async function listAdjustmentRequests(params?: { status?: string; stationId?: string }): Promise<AdjustmentRequest[]> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.stationId) qs.set('stationId', params.stationId);
  const q = qs.toString() ? `?${qs}` : '';
  return api.get<AdjustmentRequest[]>(`/fuel/adjustment-requests${q}`);
}

export async function approveAdjustmentRequest(id: string): Promise<{ success: boolean }> {
  return api.patch<{ success: boolean }>(`/fuel/adjustment-requests/${id}/approve`, {});
}

export async function rejectAdjustmentRequest(id: string, rejectionReason: string): Promise<{ success: boolean }> {
  return api.patch<{ success: boolean }>(`/fuel/adjustment-requests/${id}/reject`, { rejectionReason });
}
