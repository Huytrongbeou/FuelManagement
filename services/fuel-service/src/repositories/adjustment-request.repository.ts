import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export async function findAdjustmentRequest(id: string) {
  return prisma.adjustmentRequest.findUnique({ where: { id } })
}

export async function findAdjustmentRequests(filters: { status?: string; stationId?: string; requestedById?: string }) {
  return prisma.adjustmentRequest.findMany({
    where: {
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.stationId ? { stationId: filters.stationId } : {}),
      ...(filters.requestedById ? { requestedById: filters.requestedById } : {}),
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function createAdjustmentRequest(data: {
  originalRecordId: string
  stationId: string
  reason: string
  newFuelAdded: number
  newHoursRun: number
  newNotes?: string | null
  requestedById: string
  requestedByName: string
}) {
  return prisma.adjustmentRequest.create({ data })
}

export async function updateAdjustmentRequestStatus(
  id: string,
  update: {
    status: string
    rejectionReason?: string | null
    approvedById?: string | null
    approvedByName?: string | null
    approvedAt?: Date | null
  }
) {
  return prisma.adjustmentRequest.update({ where: { id }, data: update })
}

export { prisma as adjustmentPrisma }
