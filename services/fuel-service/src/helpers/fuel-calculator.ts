export type FuelStatus = 'green' | 'yellow' | 'red'
export type FuelStatusOrGray = FuelStatus | 'gray'

// Ngưỡng cảnh báo theo GIỜ TỰ CHỦ (fuel ÷ định mức tiêu hao), KHÔNG theo lít tuyệt đối:
// một bình 300L còn 21L trông "xanh" theo lít nhưng chỉ chạy được ~1,4 giờ.
// ⚠️ PHẢI luôn khớp bản frontend: apps/web/src/@types/index.ts (FUEL_AUTONOMY_GREEN_H / _YELLOW_H).
export const FUEL_AUTONOMY_GREEN_H = 8   // > 8h  = đủ (green)
export const FUEL_AUTONOMY_YELLOW_H = 4  // >= 4h = sắp hết (yellow); < 4h = nguy hiểm (red)

/**
 * Phân loại tồn nhiên liệu theo số giờ máy còn chạy được = fuel / consumptionRate.
 * Không tính được (thiếu tồn, hoặc định mức <= 0 / thiếu) → 'gray'. TUYỆT ĐỐI không mặc định 'green':
 * trước đây fallback về ngưỡng lít khiến trạm thiếu định mức bị phân loại sai mà không ai biết.
 */
export function determineFuelStatus(
  fuel: number | null | undefined,
  consumptionRate?: number | null,
): FuelStatusOrGray {
  if (fuel == null) return 'gray'
  if (consumptionRate == null || consumptionRate <= 0) return 'gray'
  const hours = fuel / consumptionRate
  if (hours > FUEL_AUTONOMY_GREEN_H) return 'green'
  if (hours >= FUEL_AUTONOMY_YELLOW_H) return 'yellow'
  return 'red'
}

export function calculateFuelConsumed(hoursRun: number, consumptionRate: number): number {
  return Math.max(0, hoursRun * consumptionRate)
}

export function calculateFuelResult(fuelBefore: number, fuelAdded: number, fuelConsumed: number): number {
  return fuelBefore + fuelAdded - fuelConsumed
}

