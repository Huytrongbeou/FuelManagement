import type { Request, Response } from 'express'
import * as service from '../services/stationService'
import { bulkUpsert } from '../services/stationBulkUpsertService'

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
    const { stationCode, stationName, address, latitude, longitude, generatorTypeId, maxCapacity } = req.body
    if (!stationCode) { res.status(400).json({ error: 'stationCode is required' }); return }
    if (!stationName) { res.status(400).json({ error: 'stationName is required' }); return }
    if (!generatorTypeId) { res.status(400).json({ error: 'generatorTypeId is required' }); return }
    if (maxCapacity == null) { res.status(400).json({ error: 'maxCapacity is required' }); return }
    res.status(201).json(await service.create({
      stationCode,
      stationName,
      address,
      latitude: latitude != null ? Number(latitude) : null,
      longitude: longitude != null ? Number(longitude) : null,
      generatorTypeId,
      maxCapacity: Number(maxCapacity),
    }))
  } catch (err: unknown) {
    res.status((err as { status?: number }).status || 500).json({ error: (err as Error).message })
  }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const { stationName, address, latitude, longitude, generatorTypeId, maxCapacity } = req.body
    const data: Record<string, unknown> = {}
    if (stationName !== undefined) data.stationName = stationName
    if (address !== undefined) data.address = address
    if (latitude !== undefined) data.latitude = latitude != null ? Number(latitude) : null
    if (longitude !== undefined) data.longitude = longitude != null ? Number(longitude) : null
    if (generatorTypeId !== undefined) data.generatorTypeId = generatorTypeId
    if (maxCapacity !== undefined) data.maxCapacity = Number(maxCapacity)
    res.json(await service.update(req.params.id, data as Parameters<typeof service.update>[1]))
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

export async function bulkUpsertHandler(req: Request, res: Response): Promise<void> {
  try {
    const { stations } = req.body
    if (!Array.isArray(stations) || stations.length === 0) {
      res.status(400).json({ error: 'stations array is required and must not be empty' })
      return
    }
    const result = await bulkUpsert(stations)
    res.status(result.has_errors ? 422 : 200).json(result)
  } catch (err: unknown) {
    res.status((err as { status?: number }).status || 500).json({ error: (err as Error).message })
  }
}
