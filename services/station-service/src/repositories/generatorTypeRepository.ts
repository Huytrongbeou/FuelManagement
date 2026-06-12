import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function findAll(includeInactive = false) {
  return prisma.generatorType.findMany({
    where: includeInactive ? undefined : { isActive: true },
    orderBy: { typeName: 'asc' },
  })
}

export async function findById(id: string) {
  return prisma.generatorType.findUnique({ where: { id } })
}

export async function findByName(typeName: string) {
  return prisma.generatorType.findUnique({ where: { typeName } })
}

export async function create(data: { typeName: string; consumptionRate: number; notes?: string }) {
  return prisma.generatorType.create({ data })
}

export async function update(id: string, data: { typeName?: string; consumptionRate?: number; notes?: string; isActive?: boolean }) {
  return prisma.generatorType.update({ where: { id }, data })
}

export async function countActiveStations(generatorTypeId: string) {
  return prisma.station.count({ where: { generatorTypeId, isActive: true } })
}
