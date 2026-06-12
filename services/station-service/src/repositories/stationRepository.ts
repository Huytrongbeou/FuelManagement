import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function findAll(includeInactive = false) {
  return prisma.station.findMany({
    where: includeInactive ? undefined : { isActive: true },
    include: { generatorType: true },
    orderBy: { stationCode: 'asc' },
  })
}

export async function findById(id: string) {
  return prisma.station.findUnique({ where: { id }, include: { generatorType: true } })
}

export async function findByCode(stationCode: string) {
  return prisma.station.findUnique({ where: { stationCode }, include: { generatorType: true } })
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
  return prisma.station.create({ data, include: { generatorType: true } })
}

export async function update(id: string, data: {
  stationName?: string
  address?: string
  latitude?: number | null
  longitude?: number | null
  generatorTypeId?: string
  maxCapacity?: number
  isActive?: boolean
}) {
  return prisma.station.update({ where: { id }, data, include: { generatorType: true } })
}
