import type { Request, Response } from 'express'
import * as service from '../services/employee.service'

function sendError(res: Response, err: unknown): void {
  res.status((err as { status?: number }).status || 500).json({ error: (err as Error).message })
}

export async function list(req: Request, res: Response): Promise<void> {
  try {
    res.json(await service.listEmployees(req.query.all === 'true'))
  } catch (err) { sendError(res, err) }
}

export async function create(req: Request, res: Response): Promise<void> {
  try {
    res.status(201).json(await service.createEmployee(req.body))
  } catch (err) { sendError(res, err) }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    res.json(await service.updateEmployee(req.params.id, req.body))
  } catch (err) { sendError(res, err) }
}

export async function remove(req: Request, res: Response): Promise<void> {
  try {
    res.json(await service.deactivateEmployee(req.params.id))
  } catch (err) { sendError(res, err) }
}
