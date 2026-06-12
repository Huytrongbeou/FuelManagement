import type { Request, Response } from 'express'
import axios from 'axios'

const STATION_URL = process.env.STATION_SERVICE_URL || 'http://localhost:3002'
const FUEL_URL = process.env.FUEL_SERVICE_URL || 'http://localhost:3003'

export async function dashboardSummaryHandler(_req: Request, res: Response): Promise<void> {
  try {
    const [stationsRes, fuelRes] = await Promise.all([
      axios.get(`${STATION_URL}/stations`),
      axios.get(`${FUEL_URL}/fuel/current`),
    ])

    const stations = stationsRes.data as Array<{ id: string }>
    const fuelStates = fuelRes.data as Array<{
      stationId: string
      currentFuel: number
      fuelStatus: string
      lastUpdated: string
    }>

    const today = new Date().toISOString().slice(0, 10)
    const updatedToday = fuelStates.filter(f => f.lastUpdated.slice(0, 10) === today).length

    const statusCounts = { green: 0, yellow: 0, red: 0, unknown: 0 }
    const fuelMap = new Map(fuelStates.map(f => [f.stationId, f]))

    for (const s of stations) {
      const fuel = fuelMap.get(s.id)
      const status = fuel ? fuel.fuelStatus as keyof typeof statusCounts : 'unknown'
      statusCounts[status] = (statusCounts[status] || 0) + 1
    }

    res.json({
      total_stations: stations.length,
      updated_today: updatedToday,
      status_counts: statusCounts,
    })
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}
