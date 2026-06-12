import API from './client'

export async function postFuelRecord(data: {
  stationId: string
  stationCode: string
  recordedDate: string
  fuelAdded?: number
  hoursRun?: number
  actualFuel?: number | null
  notes?: string
}) {
  const res = await API.post('/api/fuel/records', data)
  return res.data
}

export async function getFuelHistory(stationId: string) {
  const { data } = await API.get(`/api/fuel/records/${stationId}`)
  return data as Array<{
    id: string
    recordedDate: string
    fuelBefore: string
    fuelAdded: string
    hoursRun: string
    consumptionRate: string
    fuelConsumed: string
    fuelCalculated: string
    actualFuel: string | null
    fuelAfter: string
    fuelDifference: string | null
    fuelStatus: string
    notes: string | null
    source: string
    createdAt: string
  }>
}
