import * as requestRepo from '../repositories/station-request.repository'
import * as stationRepo from '../repositories/station.repository'
import * as stationService from './station.service'
import type { UserContext } from '../clients/fuel.client'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function fail(message: string, status = 400) {
  return Object.assign(new Error(message), { status })
}

/** Postgres unique-violation surfaced by Prisma. */
function isUniqueViolation(err: unknown): boolean {
  return (err as { code?: string }).code === 'P2002'
}

export async function listRequests(status?: string) {
  return requestRepo.findMany(status)
}

export async function getRequest(id: string) {
  if (!UUID_RE.test(id)) throw fail('Không tìm thấy đề xuất', 404)
  const request = await requestRepo.findById(id)
  if (!request) throw fail('Không tìm thấy đề xuất', 404)
  return request
}

export async function createRequest(data: Record<string, unknown>, requestedBy: string) {
  const stationCode = String(data.stationCode ?? '').trim().toUpperCase()
  const stationName = String(data.stationName ?? '').trim()
  const consumptionRate = Number(data.consumptionRate)
  const maxCapacity = Number(data.maxCapacity)
  const initialFuel = data.initialFuel == null ? 0 : Number(data.initialFuel)

  if (!stationCode || stationCode.length > 50) throw fail('Mã trạm phải từ 1 đến 50 ký tự')
  if (!stationName) throw fail('Tên trạm là bắt buộc')
  if (!Number.isFinite(consumptionRate) || consumptionRate <= 0) throw fail('Định mức tiêu hao phải lớn hơn 0')
  if (!Number.isFinite(maxCapacity) || maxCapacity <= 0) throw fail('Dung tích tối đa phải lớn hơn 0')
  if (!Number.isFinite(initialFuel) || initialFuel < 0 || initialFuel > maxCapacity) {
    throw fail('Tồn nhiên liệu ban đầu phải nằm trong khoảng 0 đến dung tích tối đa')
  }

  // Two ways a duplicate could sneak in: the code is already a real station, or someone else has
  // an open request for it. Both are checked here for a clear message; the partial unique index
  // on (station_code) where status in (pending, approving) is the race-proof backstop.
  if (await stationRepo.findByCode(stationCode)) {
    throw fail('Mã trạm này đã tồn tại trong hệ thống', 409)
  }
  if (await requestRepo.findOpenByCode(stationCode)) {
    throw fail('Đã có đề xuất đang chờ duyệt cho mã trạm này', 409)
  }

  try {
    return await requestRepo.create({
      stationCode,
      stationName,
      generatorName: (data.generatorName as string) ?? null,
      address: (data.address as string) ?? null,
      latitude: data.latitude == null ? null : Number(data.latitude),
      longitude: data.longitude == null ? null : Number(data.longitude),
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
    })
  } catch (err: unknown) {
    // Lost the race against a concurrent submission of the same code.
    if (isUniqueViolation(err)) throw fail('Đã có đề xuất đang chờ duyệt cho mã trạm này', 409)
    throw err
  }
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
export async function approveRequest(id: string, reviewer: { name: string; ctx: UserContext }) {
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
      reviewer.ctx
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
