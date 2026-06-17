import { prisma } from '../repositories/fuel-record.repository'
import {
  findAdjustmentRequests,
  createAdjustmentRequest,
} from '../repositories/adjustment-request.repository'

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

  // Check for existing pending or approved adjustment
  const existing = await prisma.adjustmentRequest.findFirst({
    where: {
      originalRecordId: body.originalRecordId,
      status: { in: ['pending', 'approved'] },
    },
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
