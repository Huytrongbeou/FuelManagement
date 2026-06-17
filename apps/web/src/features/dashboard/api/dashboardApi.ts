import { api } from '@/shared/api/client';

export interface DashboardSummary {
  totalStations: number;
  totalFuel: number;
  greenCount: number;
  yellowCount: number;
  redCount: number;
  unknownCount: number;
  updatedToday: number;
  withoutCoordinates: number;
  lowFuelStations: unknown[];
  recentlyUpdatedStations: unknown[];
  stationsWithoutCoordinates: unknown[];
}

export async function getSummary(): Promise<DashboardSummary> {
  return api.get<DashboardSummary>('/dashboard/summary');
}
