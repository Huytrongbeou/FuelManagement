import { api } from '@/shared/api/client';

export interface MaintenanceLog {
  id: string;
  stationId: string;
  stationCode: string;
  performedAt: string;
  note: string | null;
  recordedBy: string | null;
  createdAt: string;
}

export interface MaintenanceSummary {
  logs: MaintenanceLog[];
  lastPerformedAt: string | null;
  countThisMonth: number;
  total: number;
}

export interface MachineChange {
  id: string;
  stationId: string;
  stationCode: string;
  oldBrandName: string | null;
  oldModelName: string | null;
  newBrandName: string | null;
  newModelName: string | null;
  changedBy: string | null;
  changedAt: string;
}

export function getMaintenance(stationId: string): Promise<MaintenanceSummary> {
  return api.get<MaintenanceSummary>(`/stations/${stationId}/maintenance`);
}

export function createMaintenance(stationId: string, data: { performedAt: string; note?: string | null }): Promise<MaintenanceLog> {
  return api.post<MaintenanceLog>(`/stations/${stationId}/maintenance`, data);
}

export function getMachineChanges(stationId: string): Promise<MachineChange[]> {
  return api.get<MachineChange[]>(`/stations/${stationId}/machine-changes`);
}
