import { api } from '@/shared/api/client';
import type { Station } from '@/shared/types';

function toStation(s: Record<string, unknown>): Station {
  return {
    id: s.id as string,
    code: s.code as string,
    name: s.name as string,
    generatorName: (s.generatorName as string) ?? '',
    address: (s.address as string) ?? '',
    adminUnit: (s.adminUnit as string) ?? '',
    oldTerritory: (s.oldTerritory as string) ?? '',
    managementZone: (s.managementZone as string) ?? '',
    lat: s.lat != null ? Number(s.lat) : null,
    lng: s.lng != null ? Number(s.lng) : null,
    brandId: (s.brandId as string) ?? '',
    brandName: (s.brandName as string) ?? '',
    modelId: (s.modelId as string) ?? '',
    modelName: (s.modelName as string) ?? '',
    powerKva: s.powerKva != null ? Number(s.powerKva) : 0,
    fuelType: (s.fuelType as 'diesel' | 'gasoline' | 'other') ?? 'diesel',
    fuelRate: s.fuelRate != null ? Number(s.fuelRate) : 0,
    maxCapacity: s.maxCapacity != null ? Number(s.maxCapacity) : 0,
    currentFuel: s.currentFuel != null ? Number(s.currentFuel) : null,
    lastUpdated: (s.lastUpdated as string) ?? null,
    updatedToday: (s.updatedToday as boolean) ?? false,
    active: s.active as boolean,
  };
}

export async function getStations(opts?: { active?: string }): Promise<Station[]> {
  const qs = opts?.active ? `?active=${opts.active}` : '';
  const data = await api.get<Record<string, unknown>[]>(`/stations${qs}`);
  return data.map(toStation);
}

export async function getStation(id: string): Promise<Station> {
  const s = await api.get<Record<string, unknown>>(`/stations/${id}/full`);
  return toStation(s);
}

export async function createStation(dto: Record<string, unknown>): Promise<Station> {
  const s = await api.post<Record<string, unknown>>('/stations', dto);
  return toStation(s);
}

