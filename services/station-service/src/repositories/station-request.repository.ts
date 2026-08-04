import { prisma } from '../config/prisma'

export interface StationRequestInput {
  stationCode: string
  stationName: string
  generatorName?: string | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  currentAdminUnitName?: string | null
  legacyAreaName?: string | null
  operationAreaName?: string | null
  brandId?: string | null
  modelId?: string | null
  powerKva?: number | null
  fuelType?: string
  consumptionRate: number
  maxCapacity: number
  initialFuel?: number
  notes?: string | null
  managedByEmployeeId?: string | null
  requestedBy: string
}

export async function create(data: StationRequestInput) {
  return prisma.stationRequest.create({ data })
}

export async function findById(id: string) {
  return prisma.stationRequest.findUnique({ where: { id } })
}

export async function findMany(status?: string) {
  return prisma.stationRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { requestedAt: 'desc' },
    take: 200,
  })
}

export async function findOpenByCode(stationCode: string) {
  return prisma.stationRequest.findFirst({
    where: { stationCode, status: { in: ['pending', 'approving'] } },
  })
}

/**
 * Atomically takes ownership of a pending request. Because the UPDATE filters on
 * `status = 'pending'`, Postgres serialises concurrent attempts on the row and only one of them
 * matches — the rest see count 0. This is what stops two reviewers approving the same request
 * simultaneously and creating the station twice.
 */
export async function claimForApproval(id: string, reviewedBy: string): Promise<boolean> {
  const result = await prisma.stationRequest.updateMany({
    where: { id, status: 'pending' },
    data: { status: 'approving', reviewedBy, reviewedAt: new Date() },
  })
  return result.count === 1
}

export async function markApproved(id: string, createdStationId: string) {
  return prisma.stationRequest.update({
    where: { id },
    data: { status: 'approved', createdStationId },
  })
}

export async function markRejected(id: string, reviewedBy: string, rejectionReason: string) {
  return prisma.stationRequest.update({
    where: { id },
    data: { status: 'rejected', reviewedBy, reviewedAt: new Date(), rejectionReason },
  })
}

/**
 * Conditional reject, for the same reason approval is claimed: an unconditional write could
 * land on a request another reviewer had already moved to 'approving' and silently erase that
 * in-flight approval. Returns false when the request was no longer pending.
 */
export async function rejectIfPending(
  id: string,
  reviewedBy: string,
  rejectionReason: string
): Promise<boolean> {
  const result = await prisma.stationRequest.updateMany({
    where: { id, status: 'pending' },
    data: { status: 'rejected', reviewedBy, reviewedAt: new Date(), rejectionReason },
  })
  return result.count === 1
}

/**
 * Puts a claimed request back so it can be retried. Used when approval fails for a transient
 * reason — leaving it stuck in 'approving' would make the request permanently unreviewable.
 */
export async function releaseClaim(id: string) {
  return prisma.stationRequest.update({
    where: { id },
    data: { status: 'pending', reviewedBy: null, reviewedAt: null },
  })
}
