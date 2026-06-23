import { prisma } from '../lib/prisma'

function normalize(s: string) {
  return s.trim().toLowerCase()
}

export async function findAll(includeInactive = false) {
  return prisma.generatorBrand.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: { name: 'asc' },
  })
}

export async function findById(id: string) {
  return prisma.generatorBrand.findUnique({ where: { id } })
}

export async function findByNormalizedName(name: string) {
  return prisma.generatorBrand.findUnique({ where: { normalizedName: normalize(name) } })
}

export async function create(data: { name: string; country?: string | null; note?: string | null }) {
  return prisma.generatorBrand.create({
    data: { ...data, name: data.name.trim(), normalizedName: normalize(data.name) },
  })
}

export async function update(id: string, data: { name?: string; country?: string | null; note?: string | null; isActive?: boolean }) {
  const updateData: Record<string, unknown> = { ...data }
  if (data.name !== undefined) {
    updateData.name = data.name.trim()
    updateData.normalizedName = normalize(data.name)
  }
  return prisma.generatorBrand.update({ where: { id }, data: updateData })
}

export async function countActiveModels(brandId: string) {
  return prisma.generatorModel.count({ where: { brandId, isActive: true } })
}
