import axios from 'axios'

const STATION_URL = process.env.STATION_SERVICE_URL || 'http://localhost:3002'

export interface Station {
  id: string
  stationCode: string
  stationName: string
  generatorName?: string | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  currentAdminUnitName?: string | null
  legacyAreaName?: string | null
  operationAreaName?: string | null
  brandId?: string | null
  brand?: { name: string } | null
  modelId?: string | null
  model?: { modelName: string } | null
  powerKva?: number | null
  fuelType?: string | null
  consumptionRate: number
  maxCapacity: number
  isActive: boolean
}

export async function getAllStations(opts: { active?: string } = {}): Promise<Station[]> {
  const qs = opts.active ? `?active=${opts.active}` : ''
  const { data } = await axios.get<Station[]>(`${STATION_URL}/stations${qs}`)
  return data
}

export async function bulkUpsert(stations: unknown[]): Promise<{
  success: boolean
  results: { station_code: string; station_id: string; action: string; warning: string | null }[]
  has_errors: boolean
  errors?: string[]
}> {
  const { data } = await axios.post(`${STATION_URL}/stations/bulk-upsert`, { stations })
  return data
}
