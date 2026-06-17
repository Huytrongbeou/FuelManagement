import type { Request, Response } from 'express'
import * as service from '../services/generator-model.service'

function handleError(res: Response, err: unknown) {
  res.status((err as { status?: number }).status || 500).json({ error: (err as Error).message })
}

export async function list(req: Request, res: Response): Promise<void> {
  try {
    const { brandId } = req.query
    res.json(await service.listAll(brandId as string | undefined))
  } catch (err) { handleError(res, err) }
}

export async function getOne(req: Request, res: Response): Promise<void> {
  try {
    res.json(await service.getById(req.params.id))
  } catch (err) { handleError(res, err) }
}

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const { brandId, modelName, powerKva, fuelType, suggestedConsumptionRate, suggestedMaxCapacity, note } = req.body
    if (!brandId) { res.status(400).json({ error: 'brandId is required' }); return }
    if (!modelName) { res.status(400).json({ error: 'modelName is required' }); return }
    res.status(201).json(await service.create({
      brandId,
      modelName,
      powerKva: powerKva != null ? Number(powerKva) : null,
      fuelType,
      suggestedConsumptionRate: suggestedConsumptionRate != null ? Number(suggestedConsumptionRate) : null,
      suggestedMaxCapacity: suggestedMaxCapacity != null ? Number(suggestedMaxCapacity) : null,
      note,
    }))
  } catch (err) { handleError(res, err) }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const { modelName, powerKva, fuelType, suggestedConsumptionRate, suggestedMaxCapacity, note } = req.body
    const data: Parameters<typeof service.update>[1] = {}
    if (modelName !== undefined) data.modelName = modelName
    if (powerKva !== undefined) data.powerKva = powerKva != null ? Number(powerKva) : null
    if (fuelType !== undefined) data.fuelType = fuelType
    if (suggestedConsumptionRate !== undefined) data.suggestedConsumptionRate = suggestedConsumptionRate != null ? Number(suggestedConsumptionRate) : null
    if (suggestedMaxCapacity !== undefined) data.suggestedMaxCapacity = suggestedMaxCapacity != null ? Number(suggestedMaxCapacity) : null
    if (note !== undefined) data.note = note
    res.json(await service.update(req.params.id, data))
  } catch (err) { handleError(res, err) }
}

export async function deactivate(req: Request, res: Response): Promise<void> {
  try {
    res.json(await service.deactivate(req.params.id))
  } catch (err) { handleError(res, err) }
}

export async function reactivate(req: Request, res: Response): Promise<void> {
  try {
    res.json(await service.reactivate(req.params.id))
  } catch (err) { handleError(res, err) }
}
