import axios from 'axios'
import type { UserContext } from './fuel.client'

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

function userHeaders(ctx?: UserContext): Record<string, string> {
  const h: Record<string, string> = {}
  if (ctx?.userId) h['x-user-id'] = ctx.userId
  if (ctx?.userRole) h['x-user-role'] = ctx.userRole
  if (ctx?.userName) h['x-user-name'] = ctx.userName
  return h
}

export async function getAllStations(opts: { active?: string } = {}): Promise<Station[]> {
  const qs = opts.active ? `?active=${opts.active}` : ''
  const { data } = await axios.get<Station[]>(`${STATION_URL}/stations${qs}`)
  return data
}

export async function bulkUpsert(stations: unknown[], ctx?: UserContext): Promise<{
  success: boolean
  results: { station_code: string; station_id: string; action: string; warning: string | null }[]
  has_errors: boolean
  errors?: string[]
}> {
  const { data } = await axios.post(`${STATION_URL}/stations/bulk-upsert`, { stations }, {
    headers: userHeaders(ctx),
  })
  return data
}
