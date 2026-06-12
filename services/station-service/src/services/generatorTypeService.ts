import * as repo from '../repositories/generatorTypeRepository'

export async function listAll() {
  return repo.findAll()
}

export async function getById(id: string) {
  const gt = await repo.findById(id)
  if (!gt) throw Object.assign(new Error('Generator type not found'), { status: 404 })
  return gt
}

export async function create(data: { typeName: string; consumptionRate: number; notes?: string }) {
  if (data.consumptionRate <= 0) {
    throw Object.assign(new Error('consumption_rate must be > 0'), { status: 400 })
  }
  const existing = await repo.findByName(data.typeName)
  if (existing) throw Object.assign(new Error('Generator type name already exists'), { status: 409 })
  return repo.create(data)
}

export async function update(id: string, data: { typeName?: string; consumptionRate?: number; notes?: string }) {
  const existing = await repo.findById(id)
  if (!existing) throw Object.assign(new Error('Generator type not found'), { status: 404 })
  if (!existing.isActive) throw Object.assign(new Error('Cannot update inactive generator type'), { status: 400 })
  if (data.consumptionRate !== undefined && data.consumptionRate <= 0) {
    throw Object.assign(new Error('consumption_rate must be > 0'), { status: 400 })
  }
  return repo.update(id, data)
}

export async function softDelete(id: string) {
  const existing = await repo.findById(id)
  if (!existing) throw Object.assign(new Error('Generator type not found'), { status: 404 })
  if (!existing.isActive) throw Object.assign(new Error('Already inactive'), { status: 400 })

  const activeCount = await repo.countActiveStations(id)
  if (activeCount > 0) {
    throw Object.assign(
      new Error(`Cannot deactivate: ${activeCount} active station(s) use this generator type`),
      { status: 409 }
    )
  }
  return repo.update(id, { isActive: false })
}
