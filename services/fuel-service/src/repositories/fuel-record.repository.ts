import { PrismaClient } from '@prisma/client'
import { formatBusinessDateVN } from '../utils/date-vn'
import { normalizeDecimal2 } from '../utils/normalize'

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

export interface PreviewValidateItem {
  stationId: string
  fuelAdded: number
  hoursRun: number
  consumptionRate: number
  maxCapacity: number
}

export interface PreviewValidateResult {
  stationId: string
  fuelBefore: number | null
  fuelConsumed: number
  fuelAfter: number | null
  maxCapacity: number
  valid: boolean
  errorCode: 'EXCEEDS_CAPACITY' | 'NEGATIVE_FUEL' | null
}

export async function previewValidate(items: PreviewValidateItem[]): Promise<PreviewValidateResult[]> {
  return Promise.all(items.map(async item => {
    const state = await prisma.currentFuelState.findUnique({ where: { stationId: item.stationId } })
    const fuelBefore = state ? Number(state.currentFuel) : null
    const fuelConsumed = Math.max(0, item.hoursRun * item.consumptionRate)
    const fuelAfter = fuelBefore != null ? fuelBefore + item.fuelAdded - fuelConsumed : null

    let valid = true
    let errorCode: PreviewValidateResult['errorCode'] = null

    if (fuelAfter != null) {
      if (fuelAfter < 0) { valid = false; errorCode = 'NEGATIVE_FUEL' }
      else if (fuelAfter > item.maxCapacity) { valid = false; errorCode = 'EXCEEDS_CAPACITY' }
    }

    return { stationId: item.stationId, fuelBefore, fuelConsumed, fuelAfter, maxCapacity: item.maxCapacity, valid, errorCode }
  }))
}

export async function checkExactDuplicates(
  items: Array<{ stationId: string; recordedDate: Date; fuelAdded: number; hoursRun: number }>
): Promise<Array<{ stationId: string; isDuplicate: boolean; hasSameDateDifferentValues: boolean }>> {
  return Promise.all(items.map(async item => {
    const dateStr = formatBusinessDateVN(item.recordedDate)
    const normFuelAdded = normalizeDecimal2(item.fuelAdded)
    const normHoursRun = normalizeDecimal2(item.hoursRun)

    const exactRows = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM fuel_records
      WHERE station_id = ${item.stationId}::uuid
        AND recorded_date = ${dateStr}::date
        AND fuel_added = ${normFuelAdded}::numeric
        AND hours_run = ${normHoursRun}::numeric
        AND source != 'adjustment'
      LIMIT 1
    `

    const isDuplicate = exactRows.length > 0
    let hasSameDateDifferentValues = false

    if (!isDuplicate) {
      const sameDateRows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM fuel_records
        WHERE station_id = ${item.stationId}::uuid
          AND recorded_date = ${dateStr}::date
          AND source != 'adjustment'
        LIMIT 1
      `
      hasSameDateDifferentValues = sameDateRows.length > 0
    }

    return { stationId: item.stationId, isDuplicate, hasSameDateDifferentValues }
  }))
}
