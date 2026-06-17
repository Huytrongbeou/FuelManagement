import * as brandRepo from './generator-brand.repository'

export async function listAll() {
  return brandRepo.findAll()
}

export async function getById(id: string) {
  const brand = await brandRepo.findById(id)
  if (!brand) throw Object.assign(new Error('Brand not found'), { status: 404 })
  return brand
}

export async function create(data: { name: string; country?: string | null; note?: string | null }) {
  if (!data.name?.trim()) throw Object.assign(new Error('name is required'), { status: 400 })
  const existing = await brandRepo.findByNormalizedName(data.name)
  if (existing) throw Object.assign(new Error('Brand name already exists'), { status: 409 })
  return brandRepo.create(data)
}

export async function update(id: string, data: { name?: string; country?: string | null; note?: string | null }) {
  const brand = await brandRepo.findById(id)
  if (!brand) throw Object.assign(new Error('Brand not found'), { status: 404 })
  if (data.name !== undefined) {
    const existing = await brandRepo.findByNormalizedName(data.name)
    if (existing && existing.id !== id) throw Object.assign(new Error('Brand name already exists'), { status: 409 })
  }
  return brandRepo.update(id, data)
}

export async function deactivate(id: string) {
  const brand = await brandRepo.findById(id)
  if (!brand) throw Object.assign(new Error('Brand not found'), { status: 404 })
  if (!brand.isActive) throw Object.assign(new Error('Brand already inactive'), { status: 400 })
  return brandRepo.update(id, { isActive: false })
}

export async function reactivate(id: string) {
  const brand = await brandRepo.findById(id)
  if (!brand) throw Object.assign(new Error('Brand not found'), { status: 404 })
  return brandRepo.update(id, { isActive: true })
}
