export type FuelStatus = 'green' | 'yellow' | 'red' | 'gray';
export type Page = 'dashboard' | 'stations' | 'map' | 'directEntry' | 'import' | 'history' | 'brands' | 'models' | 'stationRequests' | 'employees' | 'users' | 'settings';

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
  managedByEmployeeId?: string | null;
  managerName?: string | null;
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
  adjustmentAmount?: number | null;
  adjustmentForId?: string | null;
  source: 'manual' | 'import' | 'direct' | 'adjustment';
  note?: string;
}

export interface AdjustmentRequest {
  id: string;
  originalRecordId: string;
  stationId: string;
  reason: string;
  newFuelAdded: number;
  newHoursRun: number;
  newNotes?: string | null;
  requestedById: string;
  requestedByName: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string | null;
  approvedById?: string | null;
  approvedByName?: string | null;
  approvedAt?: string | null;
  createdAt: string;
}

export interface ImportRowIssue {
  row: number;
  code: string;
  message: string;
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
  errors: ImportRowIssue[];
  warnings: ImportRowIssue[];
  affectedStations: string[];
}

// Ngưỡng cảnh báo theo GIỜ TỰ CHỦ (currentFuel ÷ định mức tiêu hao), không theo lít tuyệt đối:
// một bình 300L còn 21L trông "xanh" theo lít nhưng chỉ chạy được ~1,4 giờ. Hai số này chỉnh được.
export const AUTONOMY_GREEN_HOURS = 8;
export const AUTONOMY_YELLOW_HOURS = 3;

/** Số giờ máy còn chạy được với tồn hiện tại; null nếu thiếu dữ liệu để tính. */
export function autonomyHours(fuel: number | null, consumptionRate?: number | null): number | null {
  if (fuel === null || !consumptionRate || consumptionRate <= 0) return null;
  return fuel / consumptionRate;
}

/**
 * Tình trạng theo giờ tự chủ. Khi có định mức tiêu hao thì xét theo giờ; nếu thiếu định mức thì
 * lùi về ngưỡng lít tuyệt đối cũ (để không vỡ những chỗ chưa truyền định mức).
 */
export function getFuelStatus(fuel: number | null, consumptionRate?: number | null): FuelStatus {
  if (fuel === null) return 'gray';
  const hours = autonomyHours(fuel, consumptionRate);
  if (hours !== null) {
    if (hours >= AUTONOMY_GREEN_HOURS) return 'green';
    if (hours >= AUTONOMY_YELLOW_HOURS) return 'yellow';
    return 'red';
  }
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
