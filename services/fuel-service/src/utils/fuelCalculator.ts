export type FuelStatus = 'green' | 'yellow' | 'red'
export type FuelStatusWithUnknown = FuelStatus | 'unknown'

export function determineFuelStatus(fuel: number | null | undefined): FuelStatusWithUnknown {
  if (fuel == null) return 'unknown'
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

