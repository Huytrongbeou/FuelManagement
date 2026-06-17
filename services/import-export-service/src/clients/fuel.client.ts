import axios from 'axios'

const FUEL_URL = process.env.FUEL_SERVICE_URL || 'http://localhost:3003'

interface CurrentFuelState {
  stationId: string
  currentFuel: number
  fuelStatus: string
  snapshotVersion: number
}

export interface UserContext {
  userId?: string
  userRole?: string
  userName?: string
}

function userHeaders(ctx?: UserContext): Record<string, string> {
  const h: Record<string, string> = {}
  if (ctx?.userId) h['x-user-id'] = ctx.userId
  if (ctx?.userRole) h['x-user-role'] = ctx.userRole
  if (ctx?.userName) h['x-user-name'] = ctx.userName
  return h
}

export async function getAllCurrentStates(): Promise<CurrentFuelState[]> {
  const { data } = await axios.get<CurrentFuelState[]>(`${FUEL_URL}/fuel/current`)
  return data
}

export async function commitImport(body: unknown, ctx?: UserContext): Promise<unknown> {
  const { data } = await axios.post(`${FUEL_URL}/fuel/import-commit`, body, {
    headers: userHeaders(ctx),
  })
  return data
}
