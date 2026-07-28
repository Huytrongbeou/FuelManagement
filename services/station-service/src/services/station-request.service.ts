import * as requestRepo from '../repositories/station-request.repository'
import * as stationRepo from '../repositories/station.repository'
import * as stationService from './station.service'
import type { UserContext } from '../clients/fuel.client'
import { findNearbyActiveStations, DUPLICATE_RADIUS_M } from '../utils/geo'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function fail(message: string, status = 400) {
  return Object.assign(new Error(message), { status })
}

/** Postgres unique-violation surfaced by Prisma. */
function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string }).code === 'P2002'
}

function nearbyError(nearby: Awaited<ReturnType<typeof findNearbyActiveStations>>) {
  return Object.assign(
    new Error(`Có ${nearby.length} trạm đang hoạt động trong vòng ${DUPLICATE_RADIUS_M} m. Vui lòng kiểm tra để tránh tạo trùng.`),
    { status: 409, code: 'NEARBY_DUPLICATE', nearbyStations: nearby }
  )
}

export async function listRequests(status?: string) {
  const requests = await requestRepo.findMany(status)
  // Attach nearby active stations to each still-open request, so a reviewer sees a possible
  // duplicate before approving instead of discovering it only when approval is blocked.
  const openWithCoords = requests.filter(
    r => (r.status === 'pending' || r.status === 'approving') && r.latitude != null && r.longitude != null
  )
  if (openWithCoords.length === 0) return requests.map(r => ({ ...r, nearbyStations: [] }))

  return Promise.all(
    requests.map(async r => {
      if (r.latitude == null || r.longitude == null || (r.status !== 'pending' && r.status !== 'approving')) {
        return { ...r, nearbyStations: [] }
      }
      return { ...r, nearbyStations: await findNearbyActiveStations(Number(r.latitude), Number(r.longitude)) }
    })
  )
}

export async function getRequest(id: string) {
  if (!UUID_RE.test(id)) throw fail('Không tìm thấy đề xuất', 404)
  const request = await requestRepo.findById(id)
  if (!request) throw fail('Không tìm thấy đề xuất', 404)
  return request
}

export async function createRequest(data: Record<string, unknown>, requestedBy: string) {
  const suppliedCode = String(data.stationCode ?? '').trim().toUpperCase()
  const autoCode = !suppliedCode
  const stationName = String(data.stationName ?? '').trim()
  const consumptionRate = Number(data.consumptionRate)
  const maxCapacity = Number(data.maxCapacity)
  const initialFuel = data.initialFuel == null ? 0 : Number(data.initialFuel)

  if (!autoCode && suppliedCode.length > 50) throw fail('Mã trạm phải từ 1 đến 50 ký tự')
  if (!stationName) throw fail('Tên trạm là bắt buộc')
  if (!Number.isFinite(consumptionRate) || consumptionRate <= 0) throw fail('Định mức tiêu hao phải lớn hơn 0')
  if (!Number.isFinite(maxCapacity) || maxCapacity <= 0) throw fail('Dung tích tối đa phải lớn hơn 0')
  if (!Number.isFinite(initialFuel) || initialFuel < 0 || initialFuel > maxCapacity) {
    throw fail('Tồn nhiên liệu ban đầu phải nằm trong khoảng 0 đến dung tích tối đa')
  }

  // Only meaningful for a supplied code. Two ways a duplicate could sneak in: the code is already
  // a real station, or someone else has an open request for it. The partial unique index on
  // (station_code) where status in (pending, approving) is the race-proof backstop.
  if (!autoCode) {
    if (await stationRepo.findByCode(suppliedCode)) {
      throw fail('Mã trạm này đã tồn tại trong hệ thống', 409)
    }
    if (await requestRepo.findOpenByCode(suppliedCode)) {
      throw fail('Đã có đề xuất đang chờ duyệt cho mã trạm này', 409)
    }
  }

  // Warn about a station already at (roughly) this spot, unless the submitter has reviewed the
  // list and chosen to proceed. Only checks against real stations, not other open proposals.
  const lat = data.latitude == null ? null : Number(data.latitude)
  const lng = data.longitude == null ? null : Number(data.longitude)
  if (lat != null && lng != null && data.confirmNearby !== true) {
    const nearby = await findNearbyActiveStations(lat, lng)
    if (nearby.length > 0) throw nearbyError(nearby)
  }

  const base = {
    stationName,
    generatorName: (data.generatorName as string) ?? null,
    address: (data.address as string) ?? null,
    latitude: lat,
    longitude: lng,
    currentAdminUnitName: (data.currentAdminUnitName as string) ?? null,
    legacyAreaName: (data.legacyAreaName as string) ?? null,
    operationAreaName: (data.operationAreaName as string) ?? null,
    brandId: (data.brandId as string) || null,
    modelId: (data.modelId as string) || null,
    powerKva: data.powerKva == null ? null : Number(data.powerKva),
    fuelType: (data.fuelType as string) ?? 'diesel',
    consumptionRate,
    maxCapacity,
    initialFuel,
    notes: (data.notes as string) ?? null,
    requestedBy,
  }

  // Auto codes retry on the partial-unique collision (another open proposal grabbed CL-NNN first).
  for (let attempt = 0; attempt < 6; attempt++) {
    const stationCode = autoCode ? await stationRepo.nextStationCode() : suppliedCode
    try {
      return await requestRepo.create({ ...base, stationCode })
    } catch (err: unknown) {
      if (isUniqueViolation(err)) {
        if (autoCode && attempt < 5) continue
        throw fail('Đã có đề xuất đang chờ duyệt cho mã trạm này', 409)
      }
      throw err
    }
  }
  throw fail('Không tạo được mã trạm mới, vui lòng thử lại', 409)
}

/**
 * Approving creates the real station. Guarded against producing two stations when a manager and
 * an admin approve the same request at the same moment:
 *
 *  1. `claimForApproval` flips pending → approving in a single conditional UPDATE, so exactly one
 *     caller proceeds and the other gets 409.
 *  2. If the request already carries `createdStationId`, the station is returned as-is rather than
 *     created again — approving twice is idempotent.
 *  3. `stations.station_code` is UNIQUE, so even a guard failure cannot yield two station rows.
 *
 * On failure the claim is released (transient) or the request is rejected (deterministic), never
 * left stuck in 'approving'.
 */
export async function approveRequest(
  id: string,
  reviewer: { name: string; ctx: UserContext },
  opts?: { confirmNearby?: boolean }
) {
  const request = await getRequest(id)

  if (request.status === 'approved' && request.createdStationId) {
    const existing = await stationRepo.findById(request.createdStationId)
    if (existing) return { station: existing, request, alreadyApproved: true }
  }
  if (request.status !== 'pending') {
    throw fail('Đề xuất này đã được xử lý bởi người khác', 409)
  }

  if (!(await requestRepo.claimForApproval(id, reviewer.name))) {
    throw fail('Đề xuất này đã được xử lý bởi người khác', 409)
  }

  // Re-check proximity here, not inside create(): a station near this spot may have appeared
  // between proposal and approval. Done before the try (and outside create) so create()'s only
  // remaining 409 is "code exists", which the catch can safely treat as a hard reject. If nearby
  // and unconfirmed, release the claim so the reviewer can confirm and retry.
  const lat = request.latitude == null ? null : Number(request.latitude)
  const lng = request.longitude == null ? null : Number(request.longitude)
  if (lat != null && lng != null && !opts?.confirmNearby) {
    const nearby = await findNearbyActiveStations(lat, lng)
    if (nearby.length > 0) {
      await requestRepo.releaseClaim(id)
      throw nearbyError(nearby)
    }
  }

  try {
    const result = await stationService.create(
      {
        stationCode: request.stationCode,
        stationName: request.stationName,
        generatorName: request.generatorName,
        address: request.address,
        latitude: request.latitude == null ? null : Number(request.latitude),
        longitude: request.longitude == null ? null : Number(request.longitude),
        currentAdminUnitName: request.currentAdminUnitName,
        legacyAreaName: request.legacyAreaName,
        operationAreaName: request.operationAreaName,
        brandId: request.brandId,
        modelId: request.modelId,
        powerKva: request.powerKva == null ? null : Number(request.powerKva),
        fuelType: request.fuelType,
        consumptionRate: Number(request.consumptionRate),
        maxCapacity: Number(request.maxCapacity),
        notes: request.notes,
        initialFuel: Number(request.initialFuel),
      },
      reviewer.ctx,
      { confirmNearby: true }
    )

    const updated = await requestRepo.markApproved(id, result.station.id)
    return {
      station: result.station,
      request: updated,
      currentFuelStateInitialized: result.currentFuelStateInitialized,
      warning: 'warning' in result ? result.warning : undefined,
    }
  } catch (err: unknown) {
    const status = (err as { status?: number }).status
    if (status === 409 || isUniqueViolation(err)) {
      // The code was taken in the meantime — retrying will never succeed, so close the request.
      await requestRepo.markRejected(id, reviewer.name, 'Mã trạm đã tồn tại trong hệ thống')
      throw fail('Mã trạm đã tồn tại trong hệ thống', 409)
    }
    await requestRepo.releaseClaim(id)
    throw err
  }
}

export async function rejectRequest(id: string, reviewerName: string, reason: string) {
  await getRequest(id) // 404 for unknown / malformed ids
  const trimmed = String(reason ?? '').trim()
  if (!trimmed) throw fail('Vui lòng nhập lý do từ chối')

  if (!(await requestRepo.rejectIfPending(id, reviewerName, trimmed))) {
    throw fail('Đề xuất này đã được xử lý bởi người khác', 409)
  }
  return requestRepo.findById(id)
}
