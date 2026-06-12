import type { Request, Response } from 'express'
import axios from 'axios'
import { isToday } from './stations'

const STATION_URL = process.env.STATION_SERVICE_URL || 'http://localhost:3002'
const FUEL_URL = process.env.FUEL_SERVICE_URL || 'http://localhost:3003'

export async function dashboardSummaryHandler(_req: Request, res: Response): Promise<void> {
  try {
    const [stationsRes, fuelRes] = await Promise.all([
      axios.get(`${STATION_URL}/stations`),
      axios.get(`${FUEL_URL}/fuel/current`),
    ])

    const stations = stationsRes.data as Array<{
      id: string
      stationCode: string
      stationName: string
      latitude: number | null
      longitude: number | null
    }>
    const fuelStates = fuelRes.data as Array<{
      stationId: string
      currentFuel: number | null
      fuelStatus: string
      lastUpdated: string
    }>

    const fuelMap = new Map(fuelStates.map(f => [f.stationId, f]))

    let totalFuel = 0
    let greenCount = 0, yellowCount = 0, redCount = 0, grayCount = 0
    let updatedTodayCount = 0
    const withoutCoordinates: unknown[] = []
    const lowFuelStations: unknown[] = []
    const recentlyUpdatedStations: unknown[] = []

    for (const s of stations) {
      const fuel = fuelMap.get(s.id)
      const fuelStatus = fuel ? fuel.fuelStatus : 'gray'
      const currentFuel = fuel ? Number(fuel.currentFuel) : null

      if (fuelStatus === 'green') { greenCount++; if (currentFuel != null) totalFuel += currentFuel }
      else if (fuelStatus === 'yellow') { yellowCount++; if (currentFuel != null) totalFuel += currentFuel }
      else if (fuelStatus === 'red') { redCount++; if (currentFuel != null) totalFuel += currentFuel }
      else { grayCount++ }

      if (fuel && isToday(fuel.lastUpdated)) updatedTodayCount++

      if (s.latitude == null || s.longitude == null) {
        withoutCoordinates.push({ id: s.id, code: s.stationCode, name: s.stationName })
      }

      if (fuelStatus === 'red' || fuelStatus === 'yellow') {
        lowFuelStations.push({ id: s.id, code: s.stationCode, name: s.stationName, currentFuel, fuelStatus })
      }

      if (fuel && isToday(fuel.lastUpdated)) {
        recentlyUpdatedStations.push({ id: s.id, code: s.stationCode, name: s.stationName, currentFuel, fuelStatus, lastUpdated: fuel.lastUpdated })
      }
    }

    res.json({
      totalStations: stations.length,
      totalFuel: Math.round(totalFuel * 100) / 100,
      greenCount,
      yellowCount,
      redCount,
      unknownCount: grayCount,
      updatedToday: updatedTodayCount,
      withoutCoordinates: withoutCoordinates.length,
      lowFuelStations,
      recentlyUpdatedStations,
      stationsWithoutCoordinates: withoutCoordinates,
    })
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}
