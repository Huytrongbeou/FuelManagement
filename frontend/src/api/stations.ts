import API from './client'

export interface GeneratorType {
  id: string
  typeName: string
  consumptionRate: string
  notes?: string | null
  isActive: boolean
}

export interface Station {
  id: string
  stationCode: string
  stationName: string
  address?: string | null
  latitude?: string | null
  longitude?: string | null
  generatorTypeId: string
  generatorType: GeneratorType
  maxCapacity: string
  isActive: boolean
  // from aggregate
  currentFuel?: string | null
  fuelStatus?: 'green' | 'yellow' | 'red' | 'unknown'
  snapshotVersion?: number | null
}

export async function getMapStations(): Promise<Station[]> {
  const { data } = await API.get('/api/map/stations')
  return data
}

export async function getStations(): Promise<Station[]> {
  const { data } = await API.get('/api/stations')
  return data
}

export async function getStation(id: string): Promise<Station> {
  const { data } = await API.get(`/api/stations/${id}/full`)
  return data
}

export async function getDashboardSummary() {
  const { data } = await API.get('/api/dashboard/summary')
  return data as { total_stations: number; updated_today: number; status_counts: Record<string, number> }
}
