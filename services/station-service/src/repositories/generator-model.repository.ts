import { prisma } from '../lib/prisma'

function normalize(s: string) {
  return s.trim().toLowerCase()
}

export async function findAll(opts: { brandId?: string; includeInactive?: boolean } = {}) {
  return prisma.generatorModel.findMany({
    where: {
      ...(opts.brandId ? { brandId: opts.brandId } : {}),
      ...(opts.includeInactive ? {} : { isActive: true }),
    },
    include: { brand: true },
    orderBy: [{ brand: { name: 'asc' } }, { modelName: 'asc' }],
  })
}

export async function findById(id: string) {
  return prisma.generatorModel.findUnique({ where: { id }, include: { brand: true } })
}

export async function findByBrandAndName(brandId: string, modelName: string) {
  return prisma.generatorModel.findUnique({
    where: { brandId_normalizedModelName: { brandId, normalizedModelName: normalize(modelName) } },
    include: { brand: true },
  })
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
  return prisma.generatorModel.create({
    data: {
      ...data,
      modelName: data.modelName.trim(),
      normalizedModelName: normalize(data.modelName),
    },
    include: { brand: true },
  })
}

export async function update(id: string, data: {
  modelName?: string
  powerKva?: number | null
  fuelType?: string
  suggestedConsumptionRate?: number | null
  suggestedMaxCapacity?: number | null
  note?: string | null
  isActive?: boolean
}) {
  const updateData: Record<string, unknown> = { ...data }
  if (data.modelName !== undefined) {
    updateData.modelName = data.modelName.trim()
    updateData.normalizedModelName = normalize(data.modelName)
  }
  return prisma.generatorModel.update({ where: { id }, data: updateData, include: { brand: true } })
}

export async function countActiveStations(modelId: string) {
  return prisma.station.count({ where: { modelId, isActive: true } })
}
