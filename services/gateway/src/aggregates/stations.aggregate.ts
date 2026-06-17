import type { Request, Response } from 'express'
import axios from 'axios'

const STATION_URL = process.env.STATION_SERVICE_URL || 'http://localhost:3002'
const FUEL_URL = process.env.FUEL_SERVICE_URL || 'http://localhost:3003'

function isToday(dateStr: string | null | undefined): boolean {
  if (!dateStr) return false
  const today = new Date().toISOString().slice(0, 10)
  return dateStr.slice(0, 10) === today
}

function toStationDto(s: Record<string, unknown>, fuel?: { currentFuel: number | null; fuelStatus: string; lastUpdated: string | null } | null) {
  const brand = s.brand as { name?: string } | null
  const model = s.model as { modelName?: string } | null
  return {
    id: s.id,
    code: s.stationCode,
    name: s.stationName,
    generatorName: s.generatorName ?? null,
    address: s.address ?? null,
    adminUnit: s.currentAdminUnitName ?? null,
    oldTerritory: s.legacyAreaName ?? null,
    managementZone: s.operationAreaName ?? null,
    lat: s.latitude != null ? Number(s.latitude) : null,
    lng: s.longitude != null ? Number(s.longitude) : null,
    brandId: s.brandId ?? null,
    brandName: brand?.name ?? null,
    modelId: s.modelId ?? null,
    modelName: model?.modelName ?? null,
    powerKva: s.powerKva != null ? Number(s.powerKva) : null,
    fuelType: s.fuelType ?? 'diesel',
    fuelRate: s.consumptionRate != null ? Number(s.consumptionRate) : null,
    maxCapacity: s.maxCapacity != null ? Number(s.maxCapacity) : null,
    notes: s.notes ?? null,
    active: s.isActive,
    deactivatedAt: s.deactivatedAt ?? null,
    deactivationReason: s.deactivationReason ?? null,
    currentFuel: fuel ? fuel.currentFuel : null,
    fuelStatus: fuel ? fuel.fuelStatus : 'gray',
    lastUpdated: fuel ? fuel.lastUpdated : null,
    updatedToday: fuel ? isToday(fuel.lastUpdated) : false,
    createdAt: s.createdAt,
    updatedAt: s.updatedAt,
  }
}

export async function stationsListHandler(req: Request, res: Response): Promise<void> {
  try {
    const queryString = new URLSearchParams(req.query as Record<string, string>).toString()
    const stationsUrl = `${STATION_URL}/stations${queryString ? '?' + queryString : ''}`

    const [stationsRes, fuelRes] = await Promise.all([
      axios.get(stationsUrl),
      axios.get(`${FUEL_URL}/fuel/current`),
    ])

    const stations = stationsRes.data as Array<Record<string, unknown>>
    const fuelStates = fuelRes.data as Array<{ stationId: string; currentFuel: number | null; fuelStatus: string; lastUpdated: string }>

    const fuelMap = new Map(fuelStates.map(f => [f.stationId as string, f]))

    const merged = stations.map(s => {
      const fuel = fuelMap.get(s.id as string) ?? null
      return toStationDto(s, fuel ? { currentFuel: fuel.currentFuel, fuelStatus: fuel.fuelStatus, lastUpdated: fuel.lastUpdated } : null)
    })

    res.json(merged)
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

export { toStationDto, isToday }
