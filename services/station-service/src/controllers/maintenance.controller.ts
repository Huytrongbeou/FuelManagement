import type { Request, Response } from 'express'
import * as service from '../services/maintenance.service'
import * as machineChangeService from '../services/machine-change.service'

function sendError(res: Response, err: unknown): void {
  res.status((err as { status?: number }).status || 500).json({ error: (err as Error).message })
}

function recordedBy(req: Request): string | undefined {
  return req.headers['x-user-name'] as string | undefined
}

export async function listForStation(req: Request, res: Response): Promise<void> {
  try {
    res.json(await service.listMaintenance(req.params.id))
  } catch (err) { sendError(res, err) }
}

export async function createForStation(req: Request, res: Response): Promise<void> {
  try {
    res.status(201).json(await service.createMaintenance(req.params.id, req.body, recordedBy(req)))
  } catch (err) { sendError(res, err) }
}

export async function listMachineChanges(req: Request, res: Response): Promise<void> {
  try {
    res.json(await machineChangeService.listForStation(req.params.id))
  } catch (err) { sendError(res, err) }
}
