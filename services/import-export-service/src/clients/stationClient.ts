import axios from 'axios'

const STATION_URL = process.env.STATION_SERVICE_URL || 'http://localhost:3002'

interface GeneratorType {
  id: string
  typeName: string
  consumptionRate: number
  isActive: boolean
}

interface Station {
  id: string
  stationCode: string
  stationName: string
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  generatorTypeId: string
  generatorType: GeneratorType
  maxCapacity: number
  isActive: boolean
}

export async function getAllStations(): Promise<Station[]> {
  const { data } = await axios.get<Station[]>(`${STATION_URL}/stations`)
  return data
}

export async function getAllGeneratorTypes(): Promise<GeneratorType[]> {
  const { data } = await axios.get<GeneratorType[]>(`${STATION_URL}/generator-types`)
  return data
}

export async function bulkUpsert(stations: unknown[]): Promise<{
  success: boolean
  results: { station_code: string; station_id: string; action: string; warning: string | null }[]
  has_errors: boolean
  errors?: string[]
}> {
  const { data } = await axios.post(`${STATION_URL}/stations/bulk-upsert`, { stations })
  return data
}
