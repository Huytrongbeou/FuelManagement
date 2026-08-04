import { formatBusinessDateVN } from '../helpers/date-vn'
import { normalizeDecimal2 } from '../helpers/normalize'
import { prisma } from '../config/prisma'
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

/**
 * Nguồn được tính là "hoạt động nhập liệu" trong kỳ. Loại trừ `initial_state` (bản ghi khởi tạo
 * tồn đầu, không phải lần nhập nào) và `adjustment` (điều chỉnh sai sót, không phải đổ nhiên liệu).
 */
const ACTIVITY_SOURCES = ['direct', 'import', 'manual']

export interface ActivityStats {
  entryCount: number
  totalAdded: number
  totalHours: number
  totalConsumed: number
  stationsUpdated: number
}

export async function aggregateActivity(from: Date, toExclusive: Date): Promise<ActivityStats> {
  const where = {
    source: { in: ACTIVITY_SOURCES },
    recordedDate: { gte: from, lt: toExclusive },
  }
  const [agg, stations] = await Promise.all([
    prisma.fuelRecord.aggregate({
      where,
      _count: { _all: true },
      _sum: { fuelAdded: true, hoursRun: true, fuelConsumed: true },
    }),
    prisma.fuelRecord.findMany({ where, select: { stationId: true }, distinct: ['stationId'] }),
  ])
  return {
    entryCount: agg._count._all,
    // normalizeDecimal2 trả string — bọc Number() để cắt sai số float mà vẫn trả số cho JSON
    totalAdded: Number(normalizeDecimal2(Number(agg._sum.fuelAdded ?? 0))),
    totalHours: Number(normalizeDecimal2(Number(agg._sum.hoursRun ?? 0))),
    totalConsumed: Number(normalizeDecimal2(Number(agg._sum.fuelConsumed ?? 0))),
    stationsUpdated: stations.length,
  }
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
  // 'adjustment' và 'initial_state' (bản ghi genesis khi khởi tạo tồn ban đầu) không phải phát
  // sinh nhập liệu thực — không tính chúng khi dò trùng, nếu không trạm vừa tạo hôm nay sẽ báo
  // "cùng ngày" ngay ở lần nhập thật đầu tiên.
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
        AND source NOT IN ('adjustment', 'initial_state')
      LIMIT 1
    `

    const isDuplicate = exactRows.length > 0
    let hasSameDateDifferentValues = false

    if (!isDuplicate) {
      const sameDateRows = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM fuel_records
        WHERE station_id = ${item.stationId}::uuid
          AND recorded_date = ${dateStr}::date
          AND source NOT IN ('adjustment', 'initial_state')
        LIMIT 1
      `
      hasSameDateDifferentValues = sameDateRows.length > 0
    }

    return { stationId: item.stationId, isDuplicate, hasSameDateDifferentValues }
  }))
}
