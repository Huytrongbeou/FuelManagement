import { prisma } from '../lib/prisma'

const include = { brand: true, model: true }

export async function findAll(opts: { active?: 'true' | 'false' | 'all'; search?: string; brandId?: string; modelId?: string; currentAdminUnitName?: string; legacyAreaName?: string; operationAreaName?: string } = {}) {
  const where: Record<string, unknown> = {}

  if (opts.active !== 'all') {
    where.isActive = opts.active === 'false' ? false : true
  }
  if (opts.search) {
    where.OR = [
      { stationCode: { contains: opts.search, mode: 'insensitive' } },
      { stationName: { contains: opts.search, mode: 'insensitive' } },
    ]
  }
  if (opts.brandId) where.brandId = opts.brandId
  if (opts.modelId) where.modelId = opts.modelId
  if (opts.currentAdminUnitName) where.currentAdminUnitName = { contains: opts.currentAdminUnitName, mode: 'insensitive' }
  if (opts.legacyAreaName) where.legacyAreaName = { contains: opts.legacyAreaName, mode: 'insensitive' }
  if (opts.operationAreaName) where.operationAreaName = { contains: opts.operationAreaName, mode: 'insensitive' }

  return prisma.station.findMany({ where, include, orderBy: { stationCode: 'asc' } })
}

export async function findById(id: string) {
  return prisma.station.findUnique({ where: { id }, include })
}

export async function findByCode(stationCode: string) {
  return prisma.station.findUnique({ where: { stationCode }, include })
}

/**
 * Next auto station code in the `CL-NNN` series, one past the highest number currently used by a
 * real station OR reserved by an open proposal — so a pending proposal's code isn't handed out
 * again. Only `CL-<digits>` codes count; unrelated/test codes with other shapes are ignored.
 */
export async function nextStationCode(): Promise<string> {
  const [stations, requests] = await Promise.all([
    prisma.station.findMany({ where: { stationCode: { startsWith: 'CL-' } }, select: { stationCode: true } }),
    prisma.stationRequest.findMany({
      where: { stationCode: { startsWith: 'CL-' }, status: { in: ['pending', 'approving'] } },
      select: { stationCode: true },
    }),
  ])
  let max = 0
  for (const { stationCode } of [...stations, ...requests]) {
    const m = /^CL-(\d+)$/.exec(stationCode)
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return `CL-${String(max + 1).padStart(3, '0')}`
}

/** Active stations that have coordinates — the candidate set for proximity-duplicate checks. */
export async function findActiveWithCoords() {
  return prisma.station.findMany({
    where: { isActive: true, latitude: { not: null }, longitude: { not: null } },
    select: { id: true, stationCode: true, stationName: true, latitude: true, longitude: true },
  })
}

export async function create(data: {
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
  notes?: string | null
}) {
  return prisma.station.create({ data, include })
}

export async function update(id: string, data: Record<string, unknown>) {
  return prisma.station.update({ where: { id }, data, include })
}
