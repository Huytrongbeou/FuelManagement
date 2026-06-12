import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useCallback } from 'react'
import { getStation } from '../api/stations'
import { getFuelHistory, postFuelRecord } from '../api/fuel'
import FuelStatusBadge from '../components/FuelStatusBadge'
import { useSocket } from '../hooks/useSocket'

export default function StationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ recordedDate: new Date().toISOString().slice(0, 10), fuelAdded: '', hoursRun: '', actualFuel: '', notes: '' })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const { data: station } = useQuery({
    queryKey: ['station', id],
    queryFn: () => getStation(id!),
    enabled: !!id,
  })

  const { data: history = [] } = useQuery({
    queryKey: ['fuelHistory', id],
    queryFn: () => getFuelHistory(id!),
    enabled: !!id,
  })

  const onSocketEvent = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['station', id] })
    qc.invalidateQueries({ queryKey: ['fuelHistory', id] })
  }, [qc, id])

  useSocket(onSocketEvent)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitError('')
    setSubmitting(true)
    try {
      await postFuelRecord({
        stationId: id!,
        stationCode: station!.stationCode,
        recordedDate: form.recordedDate,
        fuelAdded: form.fuelAdded ? Number(form.fuelAdded) : undefined,
        hoursRun: form.hoursRun ? Number(form.hoursRun) : undefined,
        actualFuel: form.actualFuel ? Number(form.actualFuel) : null,
        notes: form.notes,
      })
      setShowForm(false)
      setForm({ recordedDate: new Date().toISOString().slice(0, 10), fuelAdded: '', hoursRun: '', actualFuel: '', notes: '' })
      qc.invalidateQueries({ queryKey: ['fuelHistory', id] })
      qc.invalidateQueries({ queryKey: ['station', id] })
    } catch (err: unknown) {
      setSubmitError((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Lỗi khi lưu')
    } finally {
      setSubmitting(false)
    }
  }

  if (!station) return <div className="p-6 text-gray-500">Đang tải...</div>

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-xl shadow border border-gray-100 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500 font-mono">{station.stationCode}</p>
            <h1 className="text-xl font-bold text-gray-800 mt-1">{station.stationName}</h1>
            {station.address && <p className="text-gray-500 text-sm mt-1">{station.address}</p>}
          </div>
          <div className="text-right">
            <FuelStatusBadge status={station.fuelStatus ?? 'unknown'} />
            {station.currentFuel != null && (
              <p className="text-3xl font-bold text-gray-800 mt-1">{Number(station.currentFuel).toFixed(1)} L</p>
            )}
            <p className="text-xs text-gray-400">/ {Number(station.maxCapacity)} L tối đa</p>
          </div>
        </div>
        <div className="mt-4 flex gap-4 text-sm text-gray-500">
          <span>Loại: <b className="text-gray-700">{station.generatorType?.typeName}</b></span>
          <span>Định mức: <b className="text-gray-700">{Number(station.generatorType?.consumptionRate)} L/giờ</b></span>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
        >
          + Nhập dữ liệu nhiên liệu
        </button>
      </div>

      {/* Manual entry form */}
      {showForm && (
        <div className="bg-white rounded-xl shadow border border-gray-100 p-6 mb-6">
          <h2 className="font-semibold text-gray-800 mb-4">Nhập dữ liệu nhiên liệu</h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
            {[
              { label: 'Ngày ghi nhận', key: 'recordedDate', type: 'date', required: true },
              { label: 'Nhiên liệu bổ sung (L)', key: 'fuelAdded', type: 'number', placeholder: '0' },
              { label: 'Số giờ chạy', key: 'hoursRun', type: 'number', placeholder: '0' },
              { label: 'Nhiên liệu tồn thực tế (L)', key: 'actualFuel', type: 'number', placeholder: 'Để trống = tự tính' },
            ].map((f) => (
              <div key={f.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
                <input
                  type={f.type}
                  step="0.01"
                  placeholder={f.placeholder}
                  required={f.required}
                  value={form[f.key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>
            ))}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                rows={2}
              />
            </div>
            {submitError && <p className="col-span-2 text-red-500 text-sm">{submitError}</p>}
            <div className="col-span-2 flex gap-2">
              <button type="submit" disabled={submitting} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
                {submitting ? 'Đang lưu...' : 'Lưu'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">
                Hủy
              </button>
            </div>
          </form>
        </div>
      )}

      {/* History */}
      <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold text-gray-800">Lịch sử nhiên liệu</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              {['Ngày', 'Tồn trước', 'Bổ sung', 'Giờ chạy', 'Tiêu hao', 'Tồn sau', 'Chênh lệch', 'Trạng thái'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {history.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-4 py-2">{r.recordedDate.slice(0, 10)}</td>
                <td className="px-4 py-2">{Number(r.fuelBefore).toFixed(1)}</td>
                <td className="px-4 py-2">{Number(r.fuelAdded).toFixed(1)}</td>
                <td className="px-4 py-2">{Number(r.hoursRun).toFixed(1)}</td>
                <td className="px-4 py-2">{Number(r.fuelConsumed).toFixed(1)}</td>
                <td className="px-4 py-2 font-medium">{Number(r.fuelAfter).toFixed(1)}</td>
                <td className="px-4 py-2 text-gray-500">{r.fuelDifference != null ? Number(r.fuelDifference).toFixed(1) : '—'}</td>
                <td className="px-4 py-2"><FuelStatusBadge status={r.fuelStatus} /></td>
              </tr>
            ))}
            {history.length === 0 && (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400">Chưa có lịch sử</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
