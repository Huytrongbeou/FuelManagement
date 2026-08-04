export type FuelStatus = 'green' | 'yellow' | 'red'
export type FuelStatusWithUnknown = FuelStatus | 'unknown'

// Ngưỡng cảnh báo theo GIỜ TỰ CHỦ (fuel ÷ định mức tiêu hao), không theo lít tuyệt đối:
// một bình 300L còn 21L trông "xanh" theo lít nhưng chỉ chạy được ~1,4 giờ. Khớp với frontend.
export const AUTONOMY_GREEN_HOURS = 8
export const AUTONOMY_YELLOW_HOURS = 3

export function determineFuelStatus(
  fuel: number | null | undefined,
  consumptionRate?: number | null,
): FuelStatusWithUnknown {
  if (fuel == null) return 'unknown'
  if (consumptionRate != null && consumptionRate > 0) {
    const hours = fuel / consumptionRate
    if (hours >= AUTONOMY_GREEN_HOURS) return 'green'
    if (hours >= AUTONOMY_YELLOW_HOURS) return 'yellow'
    return 'red'
  }
  if (fuel > 20) return 'green'
  if (fuel >= 10) return 'yellow'
  return 'red'
}

export function calculateFuelConsumed(hoursRun: number, consumptionRate: number): number {
  return Math.max(0, hoursRun * consumptionRate)
}

export function calculateFuelResult(fuelBefore: number, fuelAdded: number, fuelConsumed: number): number {
  return fuelBefore + fuelAdded - fuelConsumed
}

