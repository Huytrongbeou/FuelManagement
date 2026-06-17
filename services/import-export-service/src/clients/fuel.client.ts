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

export interface PreviewValidateItem {
  stationId: string
  fuelAdded: number
  hoursRun: number
  consumptionRate: number
  maxCapacity: number
}

export interface PreviewValidateResult {
  stationId: string
  fuelBefore: number | null
  fuelConsumed: number
  fuelAfter: number | null
  maxCapacity: number
  valid: boolean
  errorCode: 'EXCEEDS_CAPACITY' | 'NEGATIVE_FUEL' | null
}

export async function previewValidate(items: PreviewValidateItem[], ctx?: UserContext): Promise<PreviewValidateResult[]> {
  const { data } = await axios.post<PreviewValidateResult[]>(
    `${FUEL_URL}/fuel/records/preview-validate`,
    items,
    { headers: userHeaders(ctx) }
  )
  return data
}

export async function checkExactDuplicates(
  items: Array<{ stationId: string; recordedDate: Date; fuelAdded: number; hoursRun: number }>,
  ctx?: UserContext
): Promise<Array<{ stationId: string; isDuplicate: boolean }>> {
  const body = items.map(i => ({
    stationId: i.stationId,
    recordedDate: i.recordedDate.toISOString().split('T')[0],
    fuelAdded: i.fuelAdded,
    hoursRun: i.hoursRun,
  }))
  const { data } = await axios.post<Array<{ stationId: string; isDuplicate: boolean }>>(
    `${FUEL_URL}/fuel/records/check-exact-duplicates`,
    body,
    { headers: userHeaders(ctx) }
  )
  return data
}

export async function commitImport(body: unknown, ctx?: UserContext): Promise<unknown> {
  const { data } = await axios.post(`${FUEL_URL}/fuel/import-commit`, body, {
    headers: userHeaders(ctx),
  })
  return data
}
