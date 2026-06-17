import type { Request, Response } from 'express'
import { createRequest, listRequests } from '../services/adjustment-request.service'

export async function postAdjustmentRequest(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.headers['x-user-id'] as string | undefined
    const userName = req.headers['x-user-name'] as string | undefined
    if (!userId || !userName) { res.status(401).json({ error: 'Thiếu thông tin xác thực người dùng.' }); return }

    const { originalRecordId, reason, newFuelAdded, newHoursRun, newNotes } = req.body
    if (!originalRecordId) { res.status(400).json({ error: 'originalRecordId là bắt buộc.' }); return }

    const result = await createRequest({
      originalRecordId,
      reason,
      newFuelAdded: Number(newFuelAdded ?? 0),
      newHoursRun: Number(newHoursRun ?? 0),
      newNotes: newNotes ?? null,
      requestedById: userId,
      requestedByName: userName,
    })
    res.status(201).json(result)
  } catch (err: unknown) {
    res.status((err as { status?: number }).status || 500).json({ error: (err as Error).message })
  }
}

export async function getAdjustmentRequests(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.headers['x-user-id'] as string | undefined
    const userRole = req.headers['x-user-role'] as string | undefined
    if (!userId || !userRole) { res.status(401).json({ error: 'Thiếu thông tin xác thực người dùng.' }); return }

    const { status, stationId } = req.query
    // Manager chỉ thấy request của mình; Admin thấy tất cả
    const requestedById = userRole === 'manager' ? userId : undefined

    const results = await listRequests({
      status: status as string | undefined,
      stationId: stationId as string | undefined,
      requestedById,
    })
    res.json(results)
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}
