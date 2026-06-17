import type { Request, Response } from 'express'
import axios from 'axios'
import { toStationDto } from './stations.aggregate'

const STATION_URL = process.env.STATION_SERVICE_URL || 'http://localhost:3002'
const FUEL_URL = process.env.FUEL_SERVICE_URL || 'http://localhost:3003'

export async function mapStationsHandler(_req: Request, res: Response): Promise<void> {
  try {
    const [stationsRes, fuelRes] = await Promise.all([
      axios.get(`${STATION_URL}/stations`),
      axios.get(`${FUEL_URL}/fuel/current`),
    ])

    const stations = stationsRes.data as Array<Record<string, unknown>>
    const fuelStates = fuelRes.data as Array<{ stationId: string; currentFuel: number | null; fuelStatus: string; lastUpdated: string }>

    const fuelMap = new Map(fuelStates.map(f => [f.stationId, f]))

    const merged = stations.map(s => {
      const fuel = fuelMap.get(s.id as string) ?? null
      return toStationDto(s, fuel ? { currentFuel: fuel.currentFuel, fuelStatus: fuel.fuelStatus, lastUpdated: fuel.lastUpdated } : null)
    })

    res.json(merged)
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}
