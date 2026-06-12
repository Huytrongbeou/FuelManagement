import type { Request, Response } from 'express'
import axios from 'axios'

const STATION_URL = process.env.STATION_SERVICE_URL || 'http://localhost:3002'
const FUEL_URL = process.env.FUEL_SERVICE_URL || 'http://localhost:3003'

export async function stationFullHandler(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params
    const [stationRes, fuelRes] = await Promise.allSettled([
      axios.get(`${STATION_URL}/stations/${id}`),
      axios.get(`${FUEL_URL}/fuel/current/${id}`),
    ])

    if (stationRes.status === 'rejected') {
      const err = stationRes.reason as { response?: { status?: number } }
      res.status(err.response?.status || 404).json({ error: 'Station not found' })
      return
    }

    const station = stationRes.value.data as object
    const fuelState = fuelRes.status === 'fulfilled'
      ? fuelRes.value.data
      : { currentFuel: null, fuelStatus: 'unknown' }

    res.json({ ...station, ...fuelState })
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}
