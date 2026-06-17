import { useState, useEffect } from 'react';
import { ArrowLeft, MapPin, Zap, Droplets, Calendar, Clock, Edit, Save, X, TrendingDown, TrendingUp, Minus } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { Station, FuelRecord, getFuelStatus, fuelStatusColor, fuelStatusLabel } from '@/shared/types';
import { getFuelHistory, postFuelRecord } from '@/features/fuel/api/fuelApi';
import { createAdjustmentRequest } from '../api/adjustmentApi';

interface StationDetailProps {
  station: Station;
  records: FuelRecord[];
  userRole?: string;
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

export function StationDetail({ station, records, userRole, onBack }: StationDetailProps) {
  const [form, setForm] = useState({
    added: '',
    hoursRun: '',
    date: new Date().toISOString().slice(0, 10),
    note: '',
  });
  const [saving, setSaving] = useState(false);
  const [localRecords, setLocalRecords] = useState<FuelRecord[]>(records.filter(r => r.stationId === station.id));
  const [adjOpen, setAdjOpen] = useState(false);
  const [adjTarget, setAdjTarget] = useState<FuelRecord | null>(null);
  const [adjForm, setAdjForm] = useState({ newFuelAdded: '', newHoursRun: '', newNotes: '', reason: '' });
  const [adjSaving, setAdjSaving] = useState(false);

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

  // Build set of original record IDs that have been adjusted
  const adjustedIds = new Set(
    localRecords.filter(r => r.source === 'adjustment' && r.adjustmentForId).map(r => r.adjustmentForId!)
  );

  const canRequestAdjustment = userRole === 'admin' || userRole === 'manager';

  const openAdjModal = (r: FuelRecord) => {
    setAdjTarget(r);
    setAdjForm({ newFuelAdded: String(r.added), newHoursRun: String(r.hoursRun), newNotes: r.note ?? '', reason: '' });
    setAdjOpen(true);
  };

  const handleAdjSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjTarget) return;
    if (!adjForm.reason.trim()) { toast.error('Lý do điều chỉnh là bắt buộc.'); return; }
    setAdjSaving(true);
    try {
      await createAdjustmentRequest({
        originalRecordId: adjTarget.id,
        reason: adjForm.reason.trim(),
        newFuelAdded: parseFloat(adjForm.newFuelAdded) || 0,
        newHoursRun: parseFloat(adjForm.newHoursRun) || 0,
        newNotes: adjForm.newNotes || null,
      });
      toast.success('Yêu cầu điều chỉnh đã được gửi đến Admin.');
      setAdjOpen(false);
    } catch (err) {
      toast.error((err as Error).message || 'Lỗi gửi yêu cầu điều chỉnh');
    } finally {
      setAdjSaving(false);
    }
  };

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
                    {['Ngày', 'Tồn trước', 'Bổ sung', 'Giờ chạy', 'Tiêu hao', 'Tồn cuối', 'Nguồn', ''].map((h, i) => (
                      <th key={i} className="px-3 py-2.5 text-left border-b" style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, borderColor: '#e2e8f0' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stationRecords.map(r => {
                    const isAdjustment = r.source === 'adjustment';
                    const hasBeenAdjusted = adjustedIds.has(r.id);
                    const rowBgColor = isAdjustment ? '#f0f9ff' : undefined;
                    return (
                    <tr key={r.id} className="border-b" style={{ borderColor: '#f8fafc', background: rowBgColor }}>
                      <td className="px-3 py-2.5" style={{ fontSize: '0.8rem', color: '#374151', whiteSpace: 'nowrap' }}>
                        <div>{r.date}</div>
                        {hasBeenAdjusted && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium" style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.65rem' }}>
                            Đã điều chỉnh
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5" style={{ fontSize: '0.8rem', color: '#64748b' }}>{r.previousFuel} L</td>
                      <td className="px-3 py-2.5" style={{ fontSize: '0.8rem', color: r.added > 0 ? '#16a34a' : '#94a3b8', fontWeight: r.added > 0 ? 600 : 400 }}>
                        {isAdjustment && r.adjustmentAmount != null
                          ? <span style={{ color: (r.adjustmentAmount ?? 0) >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                              {(r.adjustmentAmount ?? 0) >= 0 ? '+' : ''}{r.adjustmentAmount?.toFixed(1)} L
                            </span>
                          : r.added > 0 ? `+${r.added} L` : '—'}
                      </td>
                      <td className="px-3 py-2.5" style={{ fontSize: '0.8rem', color: '#64748b' }}>{isAdjustment ? '—' : `${r.hoursRun}h`}</td>
                      <td className="px-3 py-2.5" style={{ fontSize: '0.8rem', color: '#dc2626' }}>{isAdjustment ? '—' : `${r.consumed} L`}</td>
                      <td className="px-3 py-2.5" style={{ fontSize: '0.8rem', fontWeight: 600, color: r.endFuel > 20 ? '#16a34a' : r.endFuel >= 10 ? '#ca8a04' : '#dc2626' }}>
                        {r.endFuel} L
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="px-2 py-0.5 rounded" style={{
                          fontSize: '0.7rem', fontWeight: 500,
                          background: isAdjustment ? '#ede9fe' : r.source === 'import' ? '#eff6ff' : '#f0fdf4',
                          color: isAdjustment ? '#7c3aed' : r.source === 'import' ? '#2563eb' : '#16a34a',
                        }}>
                          {isAdjustment ? 'Điều chỉnh' : r.source === 'import' ? 'Import' : 'Nhập tay'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {canRequestAdjustment && !isAdjustment && !hasBeenAdjusted && (
                          <button
                            onClick={() => openAdjModal(r)}
                            className="px-2 py-1 rounded text-xs border transition-colors"
                            style={{ fontSize: '0.7rem', color: '#7c3aed', borderColor: '#ede9fe', background: 'white', whiteSpace: 'nowrap' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#ede9fe'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'white'; }}
                          >
                            Yêu cầu điều chỉnh
                          </button>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Adjustment Request Modal */}
      <Dialog.Root open={adjOpen} onOpenChange={setAdjOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.5)' }} />
          <Dialog.Content aria-describedby={undefined} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 rounded-2xl p-6 w-full max-w-md" style={{ background: 'white', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div className="flex items-center justify-between mb-4">
              <Dialog.Title style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Yêu cầu điều chỉnh</Dialog.Title>
              <button onClick={() => setAdjOpen(false)} style={{ color: '#94a3b8' }}><X size={18} /></button>
            </div>
            {adjTarget && (
              <div className="mb-4 p-3 rounded-lg" style={{ background: '#f8fafc', fontSize: '0.82rem', color: '#475569' }}>
                <div>Bản ghi ngày: <span style={{ fontWeight: 600 }}>{adjTarget.date}</span></div>
                <div>NL bổ sung gốc: <span style={{ fontWeight: 600 }}>{adjTarget.added} L</span> | Giờ chạy gốc: <span style={{ fontWeight: 600 }}>{adjTarget.hoursRun}h</span></div>
              </div>
            )}
            <form onSubmit={handleAdjSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={{ fontSize: '0.78rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>NL bổ sung mới (L)</label>
                  <input type="number" step="0.01" min="0" value={adjForm.newFuelAdded}
                    onChange={e => setAdjForm(f => ({ ...f, newFuelAdded: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border" style={{ fontSize: '0.875rem', borderColor: '#e2e8f0' }} />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Số giờ chạy mới (h)</label>
                  <input type="number" step="0.1" min="0" value={adjForm.newHoursRun}
                    onChange={e => setAdjForm(f => ({ ...f, newHoursRun: e.target.value }))}
                    className="w-full px-3 py-2 rounded-lg border" style={{ fontSize: '0.875rem', borderColor: '#e2e8f0' }} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Ghi chú mới</label>
                <input type="text" value={adjForm.newNotes}
                  onChange={e => setAdjForm(f => ({ ...f, newNotes: e.target.value }))}
                  placeholder="Ghi chú (tùy chọn)" className="w-full px-3 py-2 rounded-lg border" style={{ fontSize: '0.875rem', borderColor: '#e2e8f0' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Lý do điều chỉnh <span style={{ color: '#dc2626' }}>*</span></label>
                <textarea required value={adjForm.reason}
                  onChange={e => setAdjForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="Mô tả lý do cần điều chỉnh..." rows={3}
                  className="w-full px-3 py-2 rounded-lg border resize-none" style={{ fontSize: '0.875rem', borderColor: '#e2e8f0' }} />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setAdjOpen(false)}
                  className="flex-1 py-2.5 rounded-lg border" style={{ borderColor: '#e2e8f0', color: '#475569', fontSize: '0.875rem' }}>
                  Hủy
                </button>
                <button type="submit" disabled={adjSaving}
                  className="flex-1 py-2.5 rounded-lg" style={{ background: adjSaving ? '#c4b5fd' : '#7c3aed', color: 'white', fontSize: '0.875rem', fontWeight: 600 }}>
                  {adjSaving ? 'Đang gửi...' : 'Gửi yêu cầu'}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
