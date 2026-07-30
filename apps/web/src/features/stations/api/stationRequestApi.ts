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
  managedByEmployeeId: string | null;
  /** Active stations within 200 m — surfaced so a reviewer spots a likely duplicate before approving. */
  nearbyStations?: NearbyStation[];
}

export interface NearbyStation {
  id: string;
  stationCode: string;
  stationName: string;
  /** Metres from the point being added. */
  distanceM: number;
}

export interface NewStationRequest {
  stationCode: string;
  stationName: string;
  /** Set true to proceed past the "a station already exists within 200 m" warning. */
  confirmNearby?: boolean;
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
  managedByEmployeeId?: string | null;
}

export function getStationRequests(status?: StationRequestStatus): Promise<StationRequest[]> {
  return api.get<StationRequest[]>(`/station-requests${status ? `?status=${status}` : ''}`);
}

export function createStationRequest(data: NewStationRequest): Promise<StationRequest> {
  return api.post<StationRequest>('/station-requests', data);
}

/**
 * Rejects with a 409 if another reviewer got there first, or if a station now sits within 200 m
 * (error `code: 'NEARBY_DUPLICATE'` with `nearbyStations`). Pass confirmNearby to proceed anyway.
 */
export function approveStationRequest(
  id: string,
  opts: { confirmNearby?: boolean; managedByEmployeeId?: string | null } = {}
): Promise<{ station: { id: string; stationCode: string } }> {
  const body: Record<string, unknown> = {};
  if (opts.confirmNearby) body.confirmNearby = true;
  if (opts.managedByEmployeeId !== undefined) body.managedByEmployeeId = opts.managedByEmployeeId;
  return api.post(`/station-requests/${id}/approve`, Object.keys(body).length ? body : undefined);
}

export function rejectStationRequest(id: string, reason: string): Promise<StationRequest> {
  return api.post<StationRequest>(`/station-requests/${id}/reject`, { reason });
}
