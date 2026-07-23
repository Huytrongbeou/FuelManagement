import { api } from '@/shared/api/client';

export type StationRequestStatus = 'pending' | 'approving' | 'approved' | 'rejected';

export interface StationRequest {
  id: string;
  stationCode: string;
  stationName: string;
  generatorName: string | null;
  address: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  currentAdminUnitName: string | null;
  consumptionRate: string | number;
  maxCapacity: string | number;
  initialFuel: string | number;
  notes: string | null;
  status: StationRequestStatus;
  requestedBy: string;
  requestedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdStationId: string | null;
}

export interface NewStationRequest {
  stationCode: string;
  stationName: string;
  generatorName?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  currentAdminUnitName?: string | null;
  legacyAreaName?: string | null;
  operationAreaName?: string | null;
  brandId?: string | null;
  modelId?: string | null;
  powerKva?: number | null;
  fuelType?: string;
  consumptionRate: number;
  maxCapacity: number;
  initialFuel?: number;
  notes?: string | null;
}

export function getStationRequests(status?: StationRequestStatus): Promise<StationRequest[]> {
  return api.get<StationRequest[]>(`/station-requests${status ? `?status=${status}` : ''}`);
}

export function createStationRequest(data: NewStationRequest): Promise<StationRequest> {
  return api.post<StationRequest>('/station-requests', data);
}

/** Rejects with a 409 if another reviewer got there first — the caller should refresh the list. */
export function approveStationRequest(id: string): Promise<{ station: { id: string; stationCode: string } }> {
  return api.post(`/station-requests/${id}/approve`);
}

export function rejectStationRequest(id: string, reason: string): Promise<StationRequest> {
  return api.post<StationRequest>(`/station-requests/${id}/reject`, { reason });
}
