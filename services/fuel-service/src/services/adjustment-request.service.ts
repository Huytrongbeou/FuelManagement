import { prisma } from '../repositories/fuel-record.repository'
import {
  findAdjustmentRequests,
  createAdjustmentRequest,
} from '../repositories/adjustment-request.repository'
import { getStation } from '../clients/station.client'
import { determineFuelStatus } from '../utils/fuel-calculator'
import { formatBusinessDateVN } from '../utils/date-vn'

export async function createRequest(body: {
  originalRecordId: string
  reason: string
  newFuelAdded: number
  newHoursRun: number
  newNotes?: string | null
  requestedById: string
  requestedByName: string
}) {
  if (!body.reason?.trim()) {
    throw Object.assign(new Error('Lý do điều chỉnh là bắt buộc.'), { status: 422 })
  }
  if (body.newFuelAdded < 0) {
    throw Object.assign(new Error('Nhiên liệu bổ sung mới không thể âm.'), { status: 422 })
  }
  if (body.newHoursRun < 0) {
    throw Object.assign(new Error('Số giờ chạy mới không thể âm.'), { status: 422 })
  }

  const original = await prisma.fuelRecord.findUnique({ where: { id: body.originalRecordId } })
  if (!original) throw Object.assign(new Error('Bản ghi gốc không tồn tại.'), { status: 404 })
  if (original.source === 'adjustment') {
    throw Object.assign(new Error('Không thể tạo yêu cầu điều chỉnh cho bản ghi điều chỉnh.'), { status: 422 })
  }

  const existing = await prisma.adjustmentRequest.findFirst({
    where: { originalRecordId: body.originalRecordId, status: { in: ['pending', 'approved'] } },
    select: { status: true },
  })
  if (existing?.status === 'pending') {
    throw Object.assign(new Error('Bản ghi này đã có yêu cầu điều chỉnh đang chờ duyệt.'), { status: 409 })
  }
  if (existing?.status === 'approved') {
    throw Object.assign(new Error('Bản ghi này đã được điều chỉnh trước đó.'), { status: 409 })
  }

  return createAdjustmentRequest({
    originalRecordId: body.originalRecordId,
    stationId: original.stationId,
    reason: body.reason.trim(),
    newFuelAdded: body.newFuelAdded,
    newHoursRun: body.newHoursRun,
    newNotes: body.newNotes ?? null,
    requestedById: body.requestedById,
    requestedByName: body.requestedByName,
  })
}

export async function listRequests(filters: { status?: string; stationId?: string; requestedById?: string }) {
  return findAdjustmentRequests(filters)
}

export async function approveRequest(requestId: string, approvedById: string, approvedByName: string) {
  // Pre-transaction: load request and original record
  const adjReq = await prisma.adjustmentRequest.findUnique({ where: { id: requestId } })
  if (!adjReq) throw Object.assign(new Error('Yêu cầu điều chỉnh không tồn tại.'), { status: 404 })
  if (adjReq.status !== 'pending') {
    throw Object.assign(new Error(`Yêu cầu không thể duyệt ở trạng thái "${adjReq.status}".`), { status: 409 })
  }

  const original = await prisma.fuelRecord.findUnique({ where: { id: adjReq.originalRecordId } })
  if (!original) throw Object.assign(new Error('Bản ghi gốc không tồn tại.'), { status: 404 })

  // Call station-service BEFORE transaction (no HTTP inside transaction)
  let station: { maxCapacity: number }
  try {
    station = await getStation(adjReq.stationId)
  } catch {
    throw Object.assign(new Error('Không thể lấy thông tin trạm từ station-service. Vui lòng thử lại.'), { status: 503 })
  }

  const origRate = Number(original.consumptionRate)
  const origEffect = Number(original.fuelAdded) - Number(original.hoursRun) * origRate
  const correctedEffect = Number(adjReq.newFuelAdded) - Number(adjReq.newHoursRun) * origRate
  const adjustmentEffect = correctedEffect - origEffect

  if (Math.abs(adjustmentEffect) < 0.001) {
    throw Object.assign(new Error('Không có thay đổi cần điều chỉnh.'), { status: 422 })
  }

  const origDateLabel = formatBusinessDateVN(original.recordedDate)
  const notes = `Điều chỉnh cho bản ghi ngày ${origDateLabel}: ${adjReq.reason}`

  // Transaction: claim + validate + create record + update state
  const now = new Date()
  return prisma.$transaction(async tx => {
    // 1. Claim — update only if still pending (race condition guard)
    const claimed = await tx.adjustmentRequest.updateMany({
      where: { id: requestId, status: 'pending' },
      data: { status: 'approved', approvedById, approvedByName, approvedAt: now },
    })
    if (claimed.count === 0) {
      throw Object.assign(new Error('Yêu cầu đã được xử lý bởi Admin khác.'), { status: 409 })
    }

    // 2. Load current fuel state
    const state = await tx.currentFuelState.findUnique({ where: { stationId: adjReq.stationId } })
    const fuelBefore = state ? Number(state.currentFuel) : 0
    const fuelAfter = fuelBefore + adjustmentEffect

    // 3. Validate
    if (fuelAfter < 0) {
      throw Object.assign(new Error(`Tồn sau điều chỉnh âm (${fuelAfter.toFixed(2)} lít). Không thể duyệt.`), { status: 422 })
    }
    if (fuelAfter > station.maxCapacity) {
      throw Object.assign(
        new Error(`Tồn sau điều chỉnh (${fuelAfter.toFixed(2)} lít) vượt dung tích tối đa (${station.maxCapacity} lít).`),
        { status: 422 }
      )
    }

    const fuelStatus = determineFuelStatus(fuelAfter)

    // 4. Create adjustment FuelRecord
    const adjRecord = await tx.fuelRecord.create({
      data: {
        stationId: original.stationId,
        stationCode: original.stationCode,
        recordedDate: now,
        fuelBefore: fuelBefore.toString(),
        fuelAdded: '0',
        hoursRun: '0',
        fuelConsumed: '0',
        consumptionRate: original.consumptionRate,
        maxCapacity: station.maxCapacity.toString(),
        fuelCalculated: fuelAfter.toString(),
        fuelAfter: fuelAfter.toString(),
        fuelStatus,
        adjustmentAmount: adjustmentEffect.toString(),
        adjustmentForId: adjReq.originalRecordId,
        source: 'adjustment',
        recordedBy: approvedByName,
        notes,
      },
    })

    // 5. Update CurrentFuelState
    if (state) {
      await tx.currentFuelState.update({
        where: { stationId: adjReq.stationId },
        data: {
          currentFuel: fuelAfter.toString(),
          fuelStatus,
          lastRecordId: adjRecord.id,
          lastUpdated: now,
          snapshotVersion: { increment: 1 },
        },
      })
    } else {
      await tx.currentFuelState.create({
        data: {
          stationId: adjReq.stationId,
          stationCode: original.stationCode,
          currentFuel: fuelAfter.toString(),
          fuelStatus,
          lastRecordId: adjRecord.id,
          lastUpdated: now,
          snapshotVersion: 1,
        },
      })
    }

    return { success: true, adjustmentRecord: adjRecord }
  })
}

export async function rejectRequest(requestId: string, rejectedById: string, rejectedByName: string, rejectionReason: string) {
  if (!rejectionReason?.trim()) {
    throw Object.assign(new Error('Lý do từ chối là bắt buộc.'), { status: 422 })
  }

  const claimed = await prisma.adjustmentRequest.updateMany({
    where: { id: requestId, status: 'pending' },
    data: {
      status: 'rejected',
      rejectionReason: rejectionReason.trim(),
      approvedById: rejectedById,
      approvedByName: rejectedByName,
      approvedAt: new Date(),
    },
  })
  if (claimed.count === 0) {
    const req = await prisma.adjustmentRequest.findUnique({ where: { id: requestId }, select: { status: true } })
    if (!req) throw Object.assign(new Error('Yêu cầu không tồn tại.'), { status: 404 })
    throw Object.assign(new Error(`Yêu cầu không thể từ chối ở trạng thái "${req.status}".`), { status: 409 })
  }
  return { success: true }
}
