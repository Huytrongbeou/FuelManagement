import type { Request, Response } from 'express'
import * as service from '../services/generator-brand.service'

function handleError(res: Response, err: unknown) {
  res.status((err as { status?: number }).status || 500).json({ error: (err as Error).message })
}

export async function list(_req: Request, res: Response): Promise<void> {
  try {
    res.json(await service.listAll())
  } catch (err) { handleError(res, err) }
}

export async function getOne(req: Request, res: Response): Promise<void> {
  try {
    res.json(await service.getById(req.params.id))
  } catch (err) { handleError(res, err) }
}

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const { name, country, note } = req.body
    if (!name) { res.status(400).json({ error: 'name is required' }); return }
    res.status(201).json(await service.create({ name, country, note }))
  } catch (err) { handleError(res, err) }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const { name, country, note } = req.body
    res.json(await service.update(req.params.id, { name, country, note }))
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
