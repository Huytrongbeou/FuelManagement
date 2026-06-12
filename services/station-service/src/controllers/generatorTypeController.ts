import type { Request, Response } from 'express'
import * as service from '../services/generatorTypeService'

export async function list(_req: Request, res: Response): Promise<void> {
  try {
    res.json(await service.listAll())
  } catch (err: unknown) {
    res.status((err as { status?: number }).status || 500).json({ error: (err as Error).message })
  }
}

export async function getOne(req: Request, res: Response): Promise<void> {
  try {
    res.json(await service.getById(req.params.id))
  } catch (err: unknown) {
    res.status((err as { status?: number }).status || 500).json({ error: (err as Error).message })
  }
}

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const { typeName, consumptionRate, notes } = req.body
    if (!typeName) { res.status(400).json({ error: 'typeName is required' }); return }
    if (consumptionRate == null) { res.status(400).json({ error: 'consumptionRate is required' }); return }
    res.status(201).json(await service.create({ typeName, consumptionRate: Number(consumptionRate), notes }))
  } catch (err: unknown) {
    res.status((err as { status?: number }).status || 500).json({ error: (err as Error).message })
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const { typeName, consumptionRate, notes } = req.body
    const data: { typeName?: string; consumptionRate?: number; notes?: string } = {}
    if (typeName !== undefined) data.typeName = typeName
    if (consumptionRate !== undefined) data.consumptionRate = Number(consumptionRate)
    if (notes !== undefined) data.notes = notes
    res.json(await service.update(req.params.id, data))
  } catch (err: unknown) {
    res.status((err as { status?: number }).status || 500).json({ error: (err as Error).message })
  }
}

export async function remove(req: Request, res: Response): Promise<void> {
  try {
    await service.softDelete(req.params.id)
    res.json({ success: true })
  } catch (err: unknown) {
    res.status((err as { status?: number }).status || 500).json({ error: (err as Error).message })
  }
}
