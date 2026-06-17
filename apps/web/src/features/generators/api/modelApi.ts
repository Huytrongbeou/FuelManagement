import { api } from '@/shared/api/client';
import type { GeneratorModel } from '@/shared/types';

function toModel(m: Record<string, unknown>): GeneratorModel {
  const brand = m.brand as { name?: string } | null;
  return {
    id: m.id as string,
    brandId: m.brandId as string,
    brandName: brand?.name ?? (m.brandName as string) ?? '',
    modelName: m.modelName as string,
    powerKva: m.powerKva != null ? Number(m.powerKva) : 0,
    fuelType: (m.fuelType as 'diesel' | 'gasoline' | 'other') ?? 'diesel',
    suggestedRate: m.suggestedConsumptionRate != null ? Number(m.suggestedConsumptionRate) : 0,
    suggestedCapacity: m.suggestedMaxCapacity != null ? Number(m.suggestedMaxCapacity) : 0,
    active: m.isActive as boolean,
    note: (m.note as string) ?? undefined,
  };
}

export async function getModels(brandId?: string): Promise<GeneratorModel[]> {
  const qs = brandId ? `?brandId=${brandId}` : '';
  const data = await api.get<Record<string, unknown>[]>(`/models${qs}`);
  return data.map(toModel);
}

export async function createModel(dto: {
  brandId: string;
  modelName: string;
  powerKva?: number;
  fuelType?: string;
  suggestedConsumptionRate?: number;
  suggestedMaxCapacity?: number;
  note?: string;
}): Promise<GeneratorModel> {
  const m = await api.post<Record<string, unknown>>('/models', dto);
  return toModel(m);
}

export async function updateModel(id: string, dto: {
  modelName?: string;
  powerKva?: number | null;
  fuelType?: string;
  suggestedConsumptionRate?: number | null;
  suggestedMaxCapacity?: number | null;
  note?: string | null;
}): Promise<GeneratorModel> {
  const m = await api.put<Record<string, unknown>>(`/models/${id}`, dto);
  return toModel(m);
}

export async function deactivateModel(id: string): Promise<void> {
  await api.patch(`/models/${id}/deactivate`);
}

export async function reactivateModel(id: string): Promise<void> {
  await api.patch(`/models/${id}/reactivate`);
}
