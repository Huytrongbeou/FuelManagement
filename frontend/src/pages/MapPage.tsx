import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import { getMapStations, type Station } from '../api/stations'
import { useSocket } from '../hooks/useSocket'
import FuelStatusBadge from '../components/FuelStatusBadge'
import 'leaflet/dist/leaflet.css'

const STATUS_COLOR: Record<string, string> = {
  green: '#22c55e',
  yellow: '#eab308',
  red: '#ef4444',
  unknown: '#9ca3af',
}

export default function MapPage() {
  const qc = useQueryClient()
  const { data: stations = [] } = useQuery({
    queryKey: ['mapStations'],
    queryFn: getMapStations,
    refetchInterval: 60_000,
  })

  const onSocketEvent = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['mapStations'] })
  }, [qc])

  useSocket(onSocketEvent)

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">Bản đồ trạm</h1>
      <div className="rounded-xl overflow-hidden border border-gray-200 shadow" style={{ height: 520 }}>
        <MapContainer
          center={[10.4574, 105.6379]}
          zoom={13}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; OpenStreetMap contributors'
          />
          {stations.map((s: Station) => {
            const lat = s.latitude ? Number(s.latitude) : null
            const lon = s.longitude ? Number(s.longitude) : null
            if (!lat || !lon) return null
            const color = STATUS_COLOR[s.fuelStatus ?? 'unknown']
            return (
              <CircleMarker
                key={s.id}
                center={[lat, lon]}
                radius={10}
                fillColor={color}
                color="#fff"
                weight={2}
                fillOpacity={0.9}
              >
                <Tooltip>
                  <div className="text-sm">
                    <p className="font-semibold">{s.stationName}</p>
                    <p className="text-gray-500">{s.stationCode}</p>
                    <p>
                      {s.currentFuel != null
                        ? `${Number(s.currentFuel).toFixed(1)} L`
                        : 'Chưa có dữ liệu'}
                    </p>
                    <FuelStatusBadge status={s.fuelStatus ?? 'unknown'} />
                  </div>
                </Tooltip>
              </CircleMarker>
            )
          })}
        </MapContainer>
      </div>
    </div>
  )
}
