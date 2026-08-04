import { prisma } from '../config/prisma'

export async function create(data: {
  stationId: string
  stationCode: string
  performedAt: Date
  note?: string | null
  recordedBy?: string | null
}) {
  return prisma.maintenanceLog.create({ data })
}

export async function findByStation(stationId: string) {
  return prisma.maintenanceLog.findMany({
    where: { stationId },
    orderBy: { performedAt: 'desc' },
    take: 200,
  })
}
