import * as modelRepo from '../repositories/generator-model.repository'
import * as brandRepo from '../repositories/generator-brand.repository'

export async function listAll(brandId?: string) {
  return modelRepo.findAll({ brandId })
}

export async function getById(id: string) {
  const model = await modelRepo.findById(id)
  if (!model) throw Object.assign(new Error('Model not found'), { status: 404 })
  return model
}

function validateSuggestedRates(data: { suggestedConsumptionRate?: number | null; suggestedMaxCapacity?: number | null }) {
  if (data.suggestedConsumptionRate != null && (!Number.isFinite(data.suggestedConsumptionRate) || data.suggestedConsumptionRate <= 0)) {
    throw Object.assign(new Error('suggestedConsumptionRate must be > 0'), { status: 400 })
  }
  if (data.suggestedMaxCapacity != null && (!Number.isFinite(data.suggestedMaxCapacity) || data.suggestedMaxCapacity <= 0)) {
    throw Object.assign(new Error('suggestedMaxCapacity must be > 0'), { status: 400 })
  }
}

export async function create(data: {
  brandId: string
  modelName: string
  powerKva?: number | null
  fuelType?: string
  suggestedConsumptionRate?: number | null
  suggestedMaxCapacity?: number | null
  note?: string | null
}) {
  if (!data.modelName?.trim()) throw Object.assign(new Error('modelName is required'), { status: 400 })
  validateSuggestedRates(data)
  const brand = await brandRepo.findById(data.brandId)
  if (!brand) throw Object.assign(new Error('Brand not found'), { status: 404 })
  const existing = await modelRepo.findByBrandAndName(data.brandId, data.modelName)
  if (existing) throw Object.assign(new Error('Model already exists for this brand'), { status: 409 })
  return modelRepo.create(data)
}

export async function update(id: string, data: {
  modelName?: string
  powerKva?: number | null
  fuelType?: string
  suggestedConsumptionRate?: number | null
  suggestedMaxCapacity?: number | null
  note?: string | null
}) {
  const model = await modelRepo.findById(id)
  if (!model) throw Object.assign(new Error('Model not found'), { status: 404 })
  validateSuggestedRates(data)
  if (data.modelName !== undefined) {
    const existing = await modelRepo.findByBrandAndName(model.brandId, data.modelName)
    if (existing && existing.id !== id) throw Object.assign(new Error('Model name already exists for this brand'), { status: 409 })
  }
  return modelRepo.update(id, data)
}

export async function deactivate(id: string) {
  const model = await modelRepo.findById(id)
  if (!model) throw Object.assign(new Error('Model not found'), { status: 404 })
  if (!model.isActive) throw Object.assign(new Error('Model already inactive'), { status: 400 })
  return modelRepo.update(id, { isActive: false })
}

export async function reactivate(id: string) {
  const model = await modelRepo.findById(id)
  if (!model) throw Object.assign(new Error('Model not found'), { status: 404 })
  return modelRepo.update(id, { isActive: true })
}
