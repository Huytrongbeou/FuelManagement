import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
export { prisma }

export async function findCurrentState(stationId: string) {
  return prisma.currentFuelState.findUnique({ where: { stationId } })
}

export async function findAllCurrentStates() {
  return prisma.currentFuelState.findMany()
}

export async function findRecordsByStation(stationId: string, opts: {
  limit?: number
  offset?: number
  from?: string
  to?: string
}) {
  return prisma.fuelRecord.findMany({
    where: {
      stationId,
      recordedDate: {
        gte: opts.from ? new Date(opts.from) : undefined,
        lte: opts.to ? new Date(opts.to) : undefined,
      },
    },
    orderBy: { recordedDate: 'desc' },
    take: opts.limit ?? 50,
    skip: opts.offset ?? 0,
  })
}

export async function findImportCommit(idempotencyKey: string) {
  return prisma.fuelImportCommit.findUnique({ where: { idempotencyKey } })
}
