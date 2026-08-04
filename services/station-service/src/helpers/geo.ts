import * as stationRepo from '../repositories/station.repository'

/** Two stations closer than this are treated as a possible duplicate needing confirmation. */
export const DUPLICATE_RADIUS_M = 200

/** Great-circle distance in metres. Accurate to well under a metre at these short ranges. */
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

export interface NearbyStation {
  id: string
  stationCode: string
  stationName: string
  distanceM: number
}

/**
 * Active stations within DUPLICATE_RADIUS_M of a point, nearest first. `excludeStationId` skips a
 * station comparing against itself (e.g. when re-checking an already-approved proposal).
 *
 * A bounding-box prefilter avoids a haversine call for every one of the ~300 stations; the exact
 * distance is only computed for the handful inside the box.
 */
export async function findNearbyActiveStations(
  lat: number,
  lng: number,
  excludeStationId?: string
): Promise<NearbyStation[]> {
  const latDelta = DUPLICATE_RADIUS_M / 111_320 // metres per degree latitude
  const cos = Math.cos((lat * Math.PI) / 180)
  const lngDelta = DUPLICATE_RADIUS_M / (111_320 * Math.max(cos, 1e-6))

  const candidates = await stationRepo.findActiveWithCoords()
  const near: NearbyStation[] = []
  for (const s of candidates) {
    if (excludeStationId && s.id === excludeStationId) continue
    const sLat = Number(s.latitude)
    const sLng = Number(s.longitude)
    if (Math.abs(sLat - lat) > latDelta || Math.abs(sLng - lng) > lngDelta) continue
    const distanceM = haversineMeters(lat, lng, sLat, sLng)
    if (distanceM <= DUPLICATE_RADIUS_M) {
      near.push({ id: s.id, stationCode: s.stationCode, stationName: s.stationName, distanceM: Math.round(distanceM) })
    }
  }
  return near.sort((a, b) => a.distanceM - b.distanceM)
}
