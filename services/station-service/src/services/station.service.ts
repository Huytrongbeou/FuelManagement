import * as stationRepo from '../repositories/station.repository'
import * as fuelClient from '../clients/fuel.client'
import type { UserContext } from '../clients/fuel.client'
import { findNearbyActiveStations, DUPLICATE_RADIUS_M } from '../utils/geo'

type ListOpts = {
  active?: 'true' | 'false' | 'all'
  search?: string
  brandId?: string
  modelId?: string
  currentAdminUnitName?: string
  legacyAreaName?: string
  operationAreaName?: string
}

export async function listAll(opts: ListOpts = {}) {
  return stationRepo.findAll(opts)
}

export async function getById(id: string) {
  const station = await stationRepo.findById(id)
  if (!station) throw Object.assign(new Error('Station not found'), { status: 404 })
  return station
}

function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string }).code === 'P2002'
}

/**
 * Inserts a station, filling in a fresh CL-NNN code first when `autoCode` is set. If a concurrent
 * insert took that code, the unique constraint throws P2002 — regenerate and retry. A supplied
 * code is inserted as-is (its duplicate handling is the caller's concern).
 */
type StationCreateInput = Parameters<typeof stationRepo.create>[0]

async function createWithCodeRetry(
  stationData: Omit<StationCreateInput, 'stationCode'> & { stationCode?: string },
  autoCode: boolean
): Promise<Awaited<ReturnType<typeof stationRepo.create>>> {
  if (!autoCode) return stationRepo.create(stationData as StationCreateInput)
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await stationRepo.create({ ...stationData, stationCode: await stationRepo.nextStationCode() })
    } catch (err) {
      if (isUniqueViolation(err) && attempt < 5) continue
      throw err
    }
  }
  throw Object.assign(new Error('Không tạo được mã trạm mới, vui lòng thử lại'), { status: 409 })
}

export async function create(data: {
  stationCode?: string
  stationName: string
  generatorName?: string | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  currentAdminUnitName?: string | null
  legacyAreaName?: string | null
  operationAreaName?: string | null
  brandId?: string | null
  modelId?: string | null
  powerKva?: number | null
  fuelType?: string
  consumptionRate: number
  maxCapacity: number
  notes?: string | null
  initialFuel?: number
}, userCtx?: UserContext, opts?: { confirmNearby?: boolean }) {
  // Station code is auto-generated (CL-NNN) when the caller doesn't supply one — the add-station
  // form no longer asks for it. An explicit code (e.g. bulk import) is still honoured.
  const autoCode = !data.stationCode
  if (data.stationCode && data.stationCode.length > 50) {
    throw Object.assign(new Error('stationCode must be 1-50 characters'), { status: 400 })
  }
  if (!data.stationName) {
    throw Object.assign(new Error('stationName is required'), { status: 400 })
  }
  if (data.consumptionRate <= 0) {
    throw Object.assign(new Error('consumptionRate must be > 0'), { status: 400 })
  }
  if (data.maxCapacity <= 0) {
    throw Object.assign(new Error('maxCapacity must be > 0'), { status: 400 })
  }
  if (data.initialFuel != null && (!Number.isFinite(data.initialFuel) || data.initialFuel < 0 || data.initialFuel > data.maxCapacity)) {
    throw Object.assign(new Error('initialFuel must be between 0 and maxCapacity'), { status: 400 })
  }
  if (!autoCode) {
    const existing = await stationRepo.findByCode(data.stationCode!)
    if (existing) throw Object.assign(new Error('Station code already exists'), { status: 409 })
  }

  // Proximity-duplicate guard: two stations within 200 m are very likely the same site entered
  // twice under different names/codes. It's only a warning (a compound really can hold two
  // generators), so the caller may proceed by passing confirmNearby once they've reviewed the list.
  if (data.latitude != null && data.longitude != null && !opts?.confirmNearby) {
    const nearby = await findNearbyActiveStations(Number(data.latitude), Number(data.longitude))
    if (nearby.length > 0) {
      throw Object.assign(
        new Error(`Có ${nearby.length} trạm đang hoạt động trong vòng ${DUPLICATE_RADIUS_M} m. Vui lòng kiểm tra để tránh tạo trùng.`),
        { status: 409, code: 'NEARBY_DUPLICATE', nearbyStations: nearby }
      )
    }
  }

  const { initialFuel, ...stationData } = data
  // On an auto-generated code, a concurrent create could grab the same CL-NNN first; the unique
  // constraint rejects the loser, so regenerate and retry a few times before giving up.
  const station = await createWithCodeRetry(stationData, autoCode)

  // Station is already created at this point — init failure must never look like station
  // creation failed (no rollback here; the station row is the source of truth). Surface the
  // outcome so the caller can warn the user instead of silently leaving fuel state uninitialized.
  const initResult = await fuelClient.initCurrentState({
    stationId: station.id,
    stationCode: station.stationCode,
    consumptionRate: data.consumptionRate,
    maxCapacity: data.maxCapacity,
    initialFuel: initialFuel ?? 0,
  }, userCtx)

  if (!initResult.ok) {
    return {
      station,
      currentFuelStateInitialized: false,
      warning: 'Trạm đã tạo nhưng chưa khởi tạo tồn nhiên liệu ban đầu — vui lòng thử lại hoặc liên hệ Admin.',
    }
  }
  return { station, currentFuelStateInitialized: true }
}

export async function update(id: string, data: {
  stationName?: string
  generatorName?: string | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  currentAdminUnitName?: string | null
  legacyAreaName?: string | null
  operationAreaName?: string | null
  brandId?: string | null
  modelId?: string | null
  powerKva?: number | null
  fuelType?: string
  consumptionRate?: number
  maxCapacity?: number
  notes?: string | null
}, userCtx?: UserContext) {
  const existing = await stationRepo.findById(id)
  if (!existing) throw Object.assign(new Error('Station not found'), { status: 404 })
  if (!existing.isActive) throw Object.assign(new Error('Cannot update inactive station'), { status: 400 })
  if (data.consumptionRate !== undefined && data.consumptionRate <= 0) {
    throw Object.assign(new Error('consumptionRate must be > 0'), { status: 400 })
  }
  if (data.maxCapacity !== undefined && data.maxCapacity <= 0) {
    throw Object.assign(new Error('maxCapacity must be > 0'), { status: 400 })
  }
  if (data.maxCapacity !== undefined) {
    const state = await fuelClient.getCurrentState(id, userCtx)
    if (state && data.maxCapacity < Number(state.currentFuel)) {
      throw Object.assign(
        new Error(`maxCapacity không thể nhỏ hơn tồn nhiên liệu hiện tại (${state.currentFuel} lít)`),
        { status: 422 }
      )
    }
  }
  return stationRepo.update(id, data)
}

export async function deactivate(id: string, reason?: string) {
  const existing = await stationRepo.findById(id)
  if (!existing) throw Object.assign(new Error('Station not found'), { status: 404 })
  if (!existing.isActive) throw Object.assign(new Error('Station already inactive'), { status: 400 })
  return stationRepo.update(id, {
    isActive: false,
    deactivatedAt: new Date(),
    deactivationReason: reason ?? null,
  })
}

export async function reactivate(id: string) {
  const existing = await stationRepo.findById(id)
  if (!existing) throw Object.assign(new Error('Station not found'), { status: 404 })
  return stationRepo.update(id, { isActive: true, deactivatedAt: null, deactivationReason: null })
}
