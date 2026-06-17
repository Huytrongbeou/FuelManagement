import * as stationRepo from './station.repository'

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
}) {
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
  const existing = await stationRepo.findByCode(data.stationCode)
  if (existing) throw Object.assign(new Error('Station code already exists'), { status: 409 })
  return stationRepo.create(data)
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
