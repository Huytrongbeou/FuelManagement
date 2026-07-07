import * as stationRepo from '../repositories/station.repository'
import * as fuelClient from '../clients/fuel.client'
import type { UserContext } from '../clients/fuel.client'

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

export async function create(data: {
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
  modelId?: string | null
  powerKva?: number | null
  fuelType?: string
  consumptionRate: number
  maxCapacity: number
  notes?: string | null
  initialFuel?: number
}, userCtx?: UserContext) {
  if (!data.stationCode || data.stationCode.length > 50) {
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
  const existing = await stationRepo.findByCode(data.stationCode)
  if (existing) throw Object.assign(new Error('Station code already exists'), { status: 409 })

  const { initialFuel, ...stationData } = data
  const station = await stationRepo.create(stationData)

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
}) {
  const existing = await stationRepo.findById(id)
  if (!existing) throw Object.assign(new Error('Station not found'), { status: 404 })
  if (!existing.isActive) throw Object.assign(new Error('Cannot update inactive station'), { status: 400 })
  if (data.consumptionRate !== undefined && data.consumptionRate <= 0) {
    throw Object.assign(new Error('consumptionRate must be > 0'), { status: 400 })
  }
  if (data.maxCapacity !== undefined && data.maxCapacity <= 0) {
    throw Object.assign(new Error('maxCapacity must be > 0'), { status: 400 })
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
