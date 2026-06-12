import type { Request, Response } from 'express'
import * as service from '../services/stationService'
import { bulkUpsert } from '../services/stationBulkUpsertService'

function handleError(res: Response, err: unknown) {
  res.status((err as { status?: number }).status || 500).json({ error: (err as Error).message })
}

export async function list(req: Request, res: Response): Promise<void> {
  try {
    const { active, search, brandId, modelId, currentAdminUnitName, legacyAreaName, operationAreaName } = req.query
    res.json(await service.listAll({
      active: active as 'true' | 'false' | 'all' | undefined,
      search: search as string | undefined,
      brandId: brandId as string | undefined,
      modelId: modelId as string | undefined,
      currentAdminUnitName: currentAdminUnitName as string | undefined,
      legacyAreaName: legacyAreaName as string | undefined,
      operationAreaName: operationAreaName as string | undefined,
    }))
  } catch (err) { handleError(res, err) }
}

export async function getOne(req: Request, res: Response): Promise<void> {
  try {
    res.json(await service.getById(req.params.id))
  } catch (err) { handleError(res, err) }
}

export async function create(req: Request, res: Response): Promise<void> {
  try {
    const {
      stationCode, stationName, generatorName, address, latitude, longitude,
      currentAdminUnitName, legacyAreaName, operationAreaName,
      brandId, modelId, powerKva, fuelType,
      consumptionRate, maxCapacity, notes,
    } = req.body
    if (!stationCode) { res.status(400).json({ error: 'stationCode is required' }); return }
    if (!stationName) { res.status(400).json({ error: 'stationName is required' }); return }
    if (consumptionRate == null) { res.status(400).json({ error: 'consumptionRate is required' }); return }
    if (maxCapacity == null) { res.status(400).json({ error: 'maxCapacity is required' }); return }
    res.status(201).json(await service.create({
      stationCode,
      stationName,
      generatorName: generatorName ?? null,
      address: address ?? null,
      latitude: latitude != null ? Number(latitude) : null,
      longitude: longitude != null ? Number(longitude) : null,
      currentAdminUnitName: currentAdminUnitName ?? null,
      legacyAreaName: legacyAreaName ?? null,
      operationAreaName: operationAreaName ?? null,
      brandId: brandId ?? null,
      modelId: modelId ?? null,
      powerKva: powerKva != null ? Number(powerKva) : null,
      fuelType,
      consumptionRate: Number(consumptionRate),
      maxCapacity: Number(maxCapacity),
      notes: notes ?? null,
    }))
  } catch (err) { handleError(res, err) }
}

export async function update(req: Request, res: Response): Promise<void> {
  try {
    const {
      stationName, generatorName, address, latitude, longitude,
      currentAdminUnitName, legacyAreaName, operationAreaName,
      brandId, modelId, powerKva, fuelType,
      consumptionRate, maxCapacity, notes,
    } = req.body
    const data: Parameters<typeof service.update>[1] = {}
    if (stationName !== undefined) data.stationName = stationName
    if (generatorName !== undefined) data.generatorName = generatorName
    if (address !== undefined) data.address = address
    if (latitude !== undefined) data.latitude = latitude != null ? Number(latitude) : null
    if (longitude !== undefined) data.longitude = longitude != null ? Number(longitude) : null
    if (currentAdminUnitName !== undefined) data.currentAdminUnitName = currentAdminUnitName
    if (legacyAreaName !== undefined) data.legacyAreaName = legacyAreaName
    if (operationAreaName !== undefined) data.operationAreaName = operationAreaName
    if (brandId !== undefined) data.brandId = brandId
    if (modelId !== undefined) data.modelId = modelId
    if (powerKva !== undefined) data.powerKva = powerKva != null ? Number(powerKva) : null
    if (fuelType !== undefined) data.fuelType = fuelType
    if (consumptionRate !== undefined) data.consumptionRate = Number(consumptionRate)
    if (maxCapacity !== undefined) data.maxCapacity = Number(maxCapacity)
    if (notes !== undefined) data.notes = notes
    res.json(await service.update(req.params.id, data))
  } catch (err) { handleError(res, err) }
}

export async function deactivate(req: Request, res: Response): Promise<void> {
  try {
    const { reason } = req.body
    res.json(await service.deactivate(req.params.id, reason))
  } catch (err) { handleError(res, err) }
}

export async function reactivate(req: Request, res: Response): Promise<void> {
  try {
    res.json(await service.reactivate(req.params.id))
  } catch (err) { handleError(res, err) }
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
  } catch (err) { handleError(res, err) }
}
