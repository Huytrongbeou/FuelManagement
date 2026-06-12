import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { getDashboardSummary, getMapStations, type Station } from '../api/stations'
import { useSocket } from '../hooks/useSocket'
import FuelStatusBadge from '../components/FuelStatusBadge'
import { Link } from 'react-router-dom'

export default function DashboardPage() {
  const qc = useQueryClient()

  const { data: summary } = useQuery({
    queryKey: ['dashboard'],
    queryFn: getDashboardSummary,
    refetchInterval: 60_000,
  })

  const { data: stations = [] } = useQuery({
    queryKey: ['mapStations'],
    queryFn: getMapStations,
    refetchInterval: 60_000,
  })

  const onSocketEvent = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['dashboard'] })
    qc.invalidateQueries({ queryKey: ['mapStations'] })
  }, [qc])

  useSocket(onSocketEvent)

  const statusCounts = summary?.status_counts ?? {}

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Tổng quan</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Tổng trạm', value: summary?.total_stations ?? '—', color: 'blue' },
          { label: 'Cập nhật hôm nay', value: summary?.updated_today ?? '—', color: 'indigo' },
          { label: 'Tốt', value: statusCounts.green ?? 0, color: 'green' },
          { label: 'Cảnh báo', value: (statusCounts.yellow ?? 0) + (statusCounts.red ?? 0), color: 'red' },
        ].map((c) => (
          <div key={c.label} className="bg-white rounded-xl shadow p-4 border border-gray-100">
            <p className="text-sm text-gray-500">{c.label}</p>
            <p className={`text-3xl font-bold text-${c.color}-600 mt-1`}>{c.value}</p>
          </div>
        ))}
      </div>

      {/* Station table */}
      <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Mã trạm', 'Tên trạm', 'Loại máy phát', 'Tồn hiện tại (L)', 'Trạng thái', ''].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {stations.map((s: Station) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs">{s.stationCode}</td>
                <td className="px-4 py-3 font-medium text-gray-800">{s.stationName}</td>
                <td className="px-4 py-3 text-gray-500">{s.generatorType?.typeName}</td>
                <td className="px-4 py-3">
                  {s.currentFuel != null ? `${Number(s.currentFuel).toFixed(1)} L` : '—'}
                </td>
                <td className="px-4 py-3">
                  <FuelStatusBadge status={s.fuelStatus ?? 'unknown'} />
                </td>
                <td className="px-4 py-3">
                  <Link to={`/stations/${s.id}`} className="text-blue-600 hover:underline text-xs">
                    Chi tiết
                  </Link>
                </td>
              </tr>
            ))}
            {stations.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  Chưa có dữ liệu trạm
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
