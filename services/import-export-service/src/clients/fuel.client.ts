import axios from 'axios'

const FUEL_URL = process.env.FUEL_SERVICE_URL || 'http://localhost:3003'

interface CurrentFuelState {
  stationId: string
  currentFuel: number
  fuelStatus: string
  snapshotVersion: number
}

export async function getAllCurrentStates(): Promise<CurrentFuelState[]> {
  const { data } = await axios.get<CurrentFuelState[]>(`${FUEL_URL}/fuel/current`)
  return data
}

export async function commitImport(body: unknown): Promise<unknown> {
  const { data } = await axios.post(`${FUEL_URL}/fuel/import-commit`, body)
  return data
}
