import { api } from './client';
import type { GeneratorBrand } from '../types';

export async function getBrands(): Promise<GeneratorBrand[]> {
  const data = await api.get<Record<string, unknown>[]>('/brands');
  return data.map(b => ({
    id: b.id as string,
    name: b.name as string,
    country: (b.country as string) ?? '',
    active: b.isActive as boolean,
    note: (b.note as string) ?? undefined,
  }));
}

export async function createBrand(dto: { name: string; country?: string; note?: string }): Promise<GeneratorBrand> {
  const b = await api.post<Record<string, unknown>>('/brands', dto);
  return { id: b.id as string, name: b.name as string, country: (b.country as string) ?? '', active: b.isActive as boolean };
}

export async function updateBrand(id: string, dto: { name?: string; country?: string; note?: string }): Promise<GeneratorBrand> {
  const b = await api.put<Record<string, unknown>>(`/brands/${id}`, dto);
  return { id: b.id as string, name: b.name as string, country: (b.country as string) ?? '', active: b.isActive as boolean };
}

export async function deactivateBrand(id: string): Promise<void> {
  await api.patch(`/brands/${id}/deactivate`);
}

export async function reactivateBrand(id: string): Promise<void> {
  await api.patch(`/brands/${id}/reactivate`);
}
