import * as stationRepo from '../repositories/stationRepository'
import * as genTypeRepo from '../repositories/generatorTypeRepository'

export async function listAll() {
  return stationRepo.findAll()
}

export async function getById(id: string) {
  const station = await stationRepo.findById(id)
  if (!station) throw Object.assign(new Error('Station not found'), { status: 404 })
  return station
}

export async function create(data: {
  stationCode: string
  stationName: string
  address?: string
  latitude?: number | null
  longitude?: number | null
  generatorTypeId: string
  maxCapacity: number
}) {
  if (!data.stationCode || data.stationCode.length > 50) {
    throw Object.assign(new Error('station_code must be 1-50 characters'), { status: 400 })
  }
  if (data.maxCapacity <= 0) {
    throw Object.assign(new Error('max_capacity must be > 0'), { status: 400 })
  }
  const genType = await genTypeRepo.findById(data.generatorTypeId)
  if (!genType || !genType.isActive) {
    throw Object.assign(new Error('Generator type not found or inactive'), { status: 400 })
  }
  const existing = await stationRepo.findByCode(data.stationCode)
  if (existing) throw Object.assign(new Error('Station code already exists'), { status: 409 })

  return stationRepo.create(data)
}

export async function update(id: string, data: {
  stationName?: string
  address?: string
  latitude?: number | null
  longitude?: number | null
  generatorTypeId?: string
  maxCapacity?: number
}) {
  const existing = await stationRepo.findById(id)
  if (!existing) throw Object.assign(new Error('Station not found'), { status: 404 })
  if (!existing.isActive) throw Object.assign(new Error('Cannot update inactive station'), { status: 400 })
  if (data.maxCapacity !== undefined && data.maxCapacity <= 0) {
    throw Object.assign(new Error('max_capacity must be > 0'), { status: 400 })
  }
  if (data.generatorTypeId) {
    const genType = await genTypeRepo.findById(data.generatorTypeId)
    if (!genType || !genType.isActive) {
      throw Object.assign(new Error('Generator type not found or inactive'), { status: 400 })
    }
  }
  return stationRepo.update(id, data)
}

export async function softDelete(id: string) {
  const existing = await stationRepo.findById(id)
  if (!existing) throw Object.assign(new Error('Station not found'), { status: 404 })
  if (!existing.isActive) throw Object.assign(new Error('Already inactive'), { status: 400 })
  return stationRepo.update(id, { isActive: false })
}
