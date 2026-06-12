export type FuelStatus = 'green' | 'yellow' | 'red' | 'gray';
export type Page = 'dashboard' | 'stations' | 'map' | 'directEntry' | 'import' | 'history' | 'brands' | 'models' | 'settings';

export interface GeneratorBrand {
  id: string;
  name: string;
  country: string;
  active: boolean;
  note?: string;
}

export interface GeneratorModel {
  id: string;
  brandId: string;
  brandName: string;
  modelName: string;
  powerKva: number;
  fuelType: 'diesel' | 'gasoline' | 'other';
  suggestedRate: number;
  suggestedCapacity: number;
  active: boolean;
  note?: string;
}

export interface Station {
  id: string;
  code: string;
  name: string;
  generatorName: string;
  address: string;
  adminUnit: string;
  oldTerritory: string;
  managementZone: string;
  lat: number | null;
  lng: number | null;
  brandId: string;
  brandName: string;
  modelId: string;
  modelName: string;
  powerKva: number;
  fuelType: 'diesel' | 'gasoline' | 'other';
  fuelRate: number;
  maxCapacity: number;
  currentFuel: number | null;
  lastUpdated: string | null;
  updatedToday: boolean;
  active: boolean;
}

export interface FuelRecord {
  id: string;
  stationId: string;
  date: string;
  previousFuel: number;
  added: number;
  hoursRun: number;
  consumed: number;
  endFuel: number;
  difference: number;
  source: 'manual' | 'import' | 'direct';
  note?: string;
}

export interface ImportSession {
  id: string;
  filename: string;
  importedBy: string;
  importedAt: string;
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  status: 'previewing' | 'committed' | 'failed' | 'cancelled';
}

export function getFuelStatus(fuel: number | null): FuelStatus {
  if (fuel === null) return 'gray';
  if (fuel > 20) return 'green';
  if (fuel >= 10) return 'yellow';
  return 'red';
}

export function fuelStatusLabel(status: FuelStatus): string {
  switch (status) {
    case 'green': return 'Đủ nhiên liệu';
    case 'yellow': return 'Sắp hết';
    case 'red': return 'Nguy hiểm';
    case 'gray': return 'Chưa có dữ liệu';
  }
}

export function fuelStatusColor(status: FuelStatus) {
  switch (status) {
    case 'green': return { bg: '#dcfce7', text: '#15803d', border: '#86efac', dot: '#16a34a' };
    case 'yellow': return { bg: '#fef9c3', text: '#a16207', border: '#fde047', dot: '#ca8a04' };
    case 'red': return { bg: '#fee2e2', text: '#b91c1c', border: '#fca5a5', dot: '#dc2626' };
    case 'gray': return { bg: '#f1f5f9', text: '#64748b', border: '#cbd5e1', dot: '#94a3b8' };
  }
}

export function fuelTypeLabel(type: 'diesel' | 'gasoline' | 'other'): string {
  switch (type) {
    case 'diesel': return 'Dầu Diesel';
    case 'gasoline': return 'Xăng';
    case 'other': return 'Khác';
  }
}
