import axios from 'axios'

const STATION_URL = process.env.STATION_SERVICE_URL || 'http://localhost:3002'

interface StationInfo {
  id: string
  stationCode: string
  consumptionRate: number
  maxCapacity: number
  isActive: boolean
}

export async function getStation(stationId: string): Promise<StationInfo> {
  const { data } = await axios.get<StationInfo>(`${STATION_URL}/stations/${stationId}`)
  return data
}
