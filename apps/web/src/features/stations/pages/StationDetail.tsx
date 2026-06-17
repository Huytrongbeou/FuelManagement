import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Zap, Droplets, Calendar, Clock, Edit, Save, X, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { toast } from 'sonner';
import { Station, FuelRecord, getFuelStatus, fuelStatusColor, fuelStatusLabel } from '@/shared/types';
import { getFuelHistory, postFuelRecord } from '@/features/fuel/api/fuelApi';

interface StationDetailProps {
  station: Station;
  records: FuelRecord[];
  onBack: () => void;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b" style={{ borderColor: '#f1f5f9' }}>
      <span style={{ fontSize: '0.82rem', color: '#64748b', flex: '0 0 140px' }}>{label}</span>
      <span style={{ fontSize: '0.875rem', color: '#1e293b', fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

export function StationDetail({ station, records, onBack }: StationDetailProps) {
  const [form, setForm] = useState({
    added: '',
    hoursRun: '',
    date: new Date().toISOString().slice(0, 10),
    note: '',
  });
  const [saving, setSaving] = useState(false);
  const [localRecords, setLocalRecords] = useState<FuelRecord[]>(records.filter(r => r.stationId === station.id));

  useEffect(() => {
    getFuelHistory(station.id).then(setLocalRecords).catch(() => {});
  }, [station.id]);

  const status = getFuelStatus(station.currentFuel);
  const c = fuelStatusColor(status);
  const pct = station.currentFuel !== null ? Math.round((station.currentFuel / station.maxCapacity) * 100) : 0;

  const stationRecords = localRecords;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await postFuelRecord({
        stationId: station.id,
        stationCode: station.code,
        recordedDate: form.date,
        fuelAdded: form.added !== '' ? parseFloat(form.added) : 0,
        hoursRun: form.hoursRun !== '' ? parseFloat(form.hoursRun) : 0,
        notes: form.note || undefined,
      });
      toast.success('Đã cập nhật nhiên liệu thành công!', {
        description: `Trạm ${station.code} — ${station.name}`,
      });
      setForm({ added: '', hoursRun: '', date: new Date().toISOString().slice(0, 10), note: '' });
      const updated = await getFuelHistory(station.id);
      setLocalRecords(updated);
    } catch (err) {
      toast.error((err as Error).message || 'Lỗi lưu dữ liệu');
    } finally {
      setSaving(false);
    }
  };

  const estimatedConsumed = form.hoursRun ? parseFloat(form.hoursRun) * station.fuelRate : 0;
  const estimatedEnd = station.currentFuel !== null && form.added
    ? station.currentFuel + parseFloat(form.added || '0') - estimatedConsumed
    : null;

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors"
          style={{ borderColor: '#e2e8f0', color: '#64748b', fontSize: '0.875rem', background: 'white' }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}
        >
          <ArrowLeft size={16} /> Quay lại
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span style={{ fontFamily: 'monospace', fontSize: '0.85rem', color: '#64748b', background: '#f1f5f9', padding: '3px 10px', borderRadius: '6px' }}>
              {station.code}
            </span>
            <h2 style={{ color: '#0f172a' }}>{station.name}</h2>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full"
              style={{ background: c.bg, color: c.text, fontSize: '0.8rem', fontWeight: 600, border: `1px solid ${c.border}` }}>
              <span className="w-2 h-2 rounded-full" style={{ background: c.dot }} />
              {fuelStatusLabel(status)}
            </span>
          </div>
          <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px' }}>{station.address}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Info cards */}
        <div className="space-y-4">
          {/* Station info */}
          <div className="rounded-xl border p-5" style={{ background: 'white', borderColor: '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center gap-2 mb-4">
              <MapPin size={16} style={{ color: '#2563eb' }} />
              <h4 style={{ color: '#0f172a' }}>Thông tin trạm</h4>
            </div>
            <div className="space-y-0">
              <InfoRow label="Địa chỉ" value={station.address} />
              <InfoRow label="Vĩ độ (Lat)" value={station.lat !== null ? station.lat.toFixed(4) : '—'} />
              <InfoRow label="Kinh độ (Lng)" value={station.lng !== null ? station.lng.toFixed(4) : '—'} />
              <InfoRow label="Hãng / Model" value={`${station.brandName} · ${station.modelName}`} />
              <InfoRow label="Công suất" value={`${station.powerKva} kVA`} />
              <InfoRow label="Định mức tiêu hao" value={`${station.fuelRate} L/giờ`} />
              <InfoRow label="Dung tích tối đa" value={`${station.maxCapacity} L`} />
              <InfoRow label="Khu vực quản lý" value={station.managementZone} />
            </div>
          </div>

          {/* Fuel level card */}
          <div className="rounded-xl border p-5" style={{ background: 'white', borderColor: '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Droplets size={16} style={{ color: c.dot }} />
              <h4 style={{ color: '#0f172a' }}>Nhiên liệu hiện tại</h4>
            </div>
            <div className="text-center py-3">
              <div style={{ fontSize: '2.5rem', fontWeight: 800, color: c.text, lineHeight: 1 }}>
                {station.currentFuel !== null ? station.currentFuel : '—'}
                <span style={{ fontSize: '1.2rem', fontWeight: 400, color: '#94a3b8' }}> L</span>
              </div>
              <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '6px' }}>
                / {station.maxCapacity} L ({pct}%)
              </div>
              {station.currentFuel !== null && (
                <div className="mt-4">
                  <div className="h-3 rounded-full" style={{ background: '#f1f5f9' }}>
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: c.dot }}
                    />
                  </div>
                </div>
              )}
              <div className="mt-3" style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                Cập nhật: {station.lastUpdated ?? 'Chưa có dữ liệu'}
              </div>
            </div>
          </div>
        </div>

        {/* Middle: Quick update form */}
        <div className="rounded-xl border p-5" style={{ background: 'white', borderColor: '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center gap-2 mb-5">
            <Edit size={16} style={{ color: '#2563eb' }} />
            <h4 style={{ color: '#0f172a' }}>Cập nhật nhiên liệu</h4>
          </div>
          <form onSubmit={handleSave} className="space-y-4">
            {[
              { label: 'Ngày ghi nhận', type: 'date', key: 'date' },
              { label: 'Nhiên liệu bổ sung (L)', type: 'number', key: 'added', placeholder: '0' },
              { label: 'Số giờ chạy máy', type: 'number', key: 'hoursRun', placeholder: '0' },
            ].map(field => (
              <div key={field.key}>
                <label className="block mb-1.5" style={{ fontSize: '0.8rem', color: '#475569' }}>{field.label}</label>
                <input
                  type={field.type}
                  value={form[field.key as keyof typeof form]}
                  onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                  placeholder={field.placeholder}
                  min={field.type === 'number' ? 0 : undefined}
                  className="w-full px-3 py-2.5 rounded-lg border outline-none transition-all"
                  style={{ fontSize: '0.875rem', borderColor: '#e2e8f0', background: '#f8fafc' }}
                  onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            ))}
            <div>
              <label className="block mb-1.5" style={{ fontSize: '0.8rem', color: '#475569' }}>Ghi chú</label>
              <textarea
                value={form.note}
                onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                placeholder="Ghi chú thêm (tùy chọn)..."
                rows={2}
                className="w-full px-3 py-2.5 rounded-lg border outline-none transition-all resize-none"
                style={{ fontSize: '0.875rem', borderColor: '#e2e8f0', background: '#f8fafc' }}
                onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            {/* Auto-calculation preview */}
            {(form.hoursRun || form.added) && (
              <div className="rounded-lg p-3 space-y-1.5" style={{ background: '#f0f7ff', border: '1px solid #dbeafe' }}>
                <div style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600, marginBottom: '4px' }}>Dự tính tự động</div>
                <div className="flex justify-between" style={{ fontSize: '0.78rem', color: '#475569' }}>
                  <span>Tiêu hao ước tính</span>
                  <span style={{ fontWeight: 600, color: '#dc2626' }}>{estimatedConsumed.toFixed(1)} L</span>
                </div>
                {estimatedEnd !== null && (
                  <div className="flex justify-between" style={{ fontSize: '0.78rem', color: '#475569' }}>
                    <span>Tồn cuối ước tính</span>
                    <span style={{ fontWeight: 600, color: estimatedEnd > 20 ? '#16a34a' : estimatedEnd >= 10 ? '#ca8a04' : '#dc2626' }}>
                      {estimatedEnd.toFixed(1)} L
                    </span>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 rounded-lg flex items-center justify-center gap-2 transition-all"
              style={{ background: saving ? '#93c5fd' : '#2563eb', color: 'white', fontSize: '0.875rem', fontWeight: 600 }}
            >
              <Save size={15} />
              {saving ? 'Đang lưu...' : 'Cập nhật'}
            </button>
          </form>
        </div>

        {/* Right: History table */}
        <div className="lg:col-span-1 rounded-xl border overflow-hidden" style={{ background: 'white', borderColor: '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: '#f1f5f9' }}>
            <Clock size={16} style={{ color: '#2563eb' }} />
            <h4 style={{ color: '#0f172a' }}>Lịch sử nhiên liệu</h4>
          </div>
          <div className="overflow-x-auto">
            {stationRecords.length === 0 ? (
              <div className="py-10 text-center" style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
                Chưa có lịch sử
              </div>
            ) : (
              <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: '600px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    {['Ngày', 'Tồn trước', 'Bổ sung', 'Giờ chạy', 'Tiêu hao', 'Tồn cuối', 'Nguồn'].map(h => (
                      <th key={h} className="px-3 py-2.5 text-left border-b" style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, borderColor: '#e2e8f0' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stationRecords.map(r => (
                    <tr key={r.id} className="border-b" style={{ borderColor: '#f8fafc' }}>
                      <td className="px-3 py-2.5" style={{ fontSize: '0.8rem', color: '#374151', whiteSpace: 'nowrap' }}>{r.date}</td>
                      <td className="px-3 py-2.5" style={{ fontSize: '0.8rem', color: '#64748b' }}>{r.previousFuel} L</td>
                      <td className="px-3 py-2.5" style={{ fontSize: '0.8rem', color: r.added > 0 ? '#16a34a' : '#94a3b8', fontWeight: r.added > 0 ? 600 : 400 }}>
                        {r.added > 0 ? `+${r.added} L` : '—'}
                      </td>
                      <td className="px-3 py-2.5" style={{ fontSize: '0.8rem', color: '#64748b' }}>{r.hoursRun}h</td>
                      <td className="px-3 py-2.5" style={{ fontSize: '0.8rem', color: '#dc2626' }}>{r.consumed} L</td>
                      <td className="px-3 py-2.5" style={{ fontSize: '0.8rem', fontWeight: 600, color: r.endFuel > 20 ? '#16a34a' : r.endFuel >= 10 ? '#ca8a04' : '#dc2626' }}>
                        {r.endFuel} L
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="px-2 py-0.5 rounded" style={{
                          fontSize: '0.7rem', fontWeight: 500,
                          background: r.source === 'import' ? '#eff6ff' : '#f0fdf4',
                          color: r.source === 'import' ? '#2563eb' : '#16a34a',
                        }}>
                          {r.source === 'import' ? 'Import' : 'Nhập tay'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
