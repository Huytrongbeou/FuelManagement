import type { APIRequestContext } from '@playwright/test';
import { api } from './auth';

export interface CreateAdjustmentPayload {
  originalRecordId: string;
  reason: string;
  newFuelAdded: number;
  newHoursRun: number;
  newNotes?: string | null;
}

export async function createAdjustmentApi(
  request: APIRequestContext,
  headers: Record<string, string>,
  payload: CreateAdjustmentPayload
) {
  return request.post(api('/fuel/adjustment-requests'), { headers, data: payload });
}

export async function approveAdjustmentApi(
  request: APIRequestContext,
  headers: Record<string, string>,
  adjustmentId: string
) {
  return request.patch(api(`/fuel/adjustment-requests/${adjustmentId}/approve`), { headers });
}

export async function rejectAdjustmentApi(
  request: APIRequestContext,
  headers: Record<string, string>,
  adjustmentId: string,
  rejectionReason: string
) {
  return request.patch(api(`/fuel/adjustment-requests/${adjustmentId}/reject`), {
    headers,
    data: { rejectionReason },
  });
}

export async function listAdjustmentRequestsApi(
  request: APIRequestContext,
  headers: Record<string, string>,
  filters: { status?: string; stationId?: string } = {}
) {
  const qs = new URLSearchParams(filters as Record<string, string>).toString();
  const res = await request.get(api(`/fuel/adjustment-requests${qs ? `?${qs}` : ''}`), { headers });
  if (!res.ok()) throw new Error(`listAdjustmentRequestsApi failed: ${res.status()}`);
  return res.json();
}

/** Single request by id — the API exposes list only, so filter client-side. */
export async function getAdjustmentRequestApi(
  request: APIRequestContext,
  headers: Record<string, string>,
  adjustmentId: string
) {
  const all = await listAdjustmentRequestsApi(request, headers);
  return all.find((r: { id: string }) => r.id === adjustmentId);
}
