import { useState } from 'react';
import { X, Save, Droplets, Zap, MapPin, AlertTriangle } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { Station, getFuelStatus, fuelStatusColor, fuelStatusLabel, fuelTypeLabel } from '@/shared/types';
import { postFuelRecord } from '../api/fuelApi';
import { InfoChip } from './InfoChip';

interface Props {
  station: Station | null;
  open: boolean;
  onClose: () => void;
}

const INPUT_STYLE = {
  fontSize: '0.875rem',
  borderColor: '#e2e8f0',
  background: '#f8fafc',
  borderRadius: '8px',
  padding: '10px 12px',
  outline: 'none',
  border: '1px solid #e2e8f0',
  width: '100%',
} as const;

export function FuelEntryModal({ station, open, onClose }: Props) {
  const [form, setForm] = useState({ added: '', hoursRun: '', date: new Date().toISOString().slice(0, 10), note: '' });
  const [saving, setSaving] = useState(false);

  if (!station) return null;

  const status = getFuelStatus(station.currentFuel);
  const c = fuelStatusColor(status);

  const added = form.added !== '' ? parseFloat(form.added) : 0;
  const hours = form.hoursRun !== '' ? parseFloat(form.hoursRun) : 0;
  const consumed = hours * station.fuelRate;
  const prev = station.currentFuel ?? 0;
  const sysCalc = prev + added - consumed;
  const finalFuel = (form.added || form.hoursRun) ? sysCalc : null;
  const hasChange = form.added || form.hoursRun;

  const newStatus = finalFuel !== null ? getFuelStatus(finalFuel) : null;
  const newC = newStatus ? fuelStatusColor(newStatus) : null;

  const isError = finalFuel !== null && (finalFuel < 0 || finalFuel > station.maxCapacity);
  const errorMsg = finalFuel !== null && finalFuel < 0 ? 'Nhiên liệu tồn cuối âm — không thể lưu'
    : finalFuel !== null && finalFuel > station.maxCapacity ? `Vượt dung tích tối đa ${station.maxCapacity}L — không thể lưu` : '';

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isError) return;
    if (!hasChange) { toast.warning('Chưa nhập thay đổi nào'); return; }
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
      toast.success(`Đã cập nhật nhiên liệu trạm ${station.code}`);
      setForm({ added: '', hoursRun: '', date: new Date().toISOString().slice(0, 10), note: '' });
      onClose();
    } catch (err) {
      toast.error((err as Error).message || 'Lỗi lưu dữ liệu');
    } finally {
      setSaving(false);
    }
  };


  return (
    <Dialog.Root open={open} onOpenChange={open => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.5)' }} />
        <Dialog.Content aria-describedby={undefined} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" style={{ background: 'white', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
          <Dialog.Title className="sr-only">Nhập nhiên liệu cho trạm {station.code}</Dialog.Title>

          {/* Header */}
          <div className="flex items-start justify-between px-6 py-4 border-b" style={{ borderColor: '#f1f5f9', background: c.bg }}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: c.text, background: 'white', padding: '2px 8px', borderRadius: '5px', border: `1px solid ${c.border}` }}>{station.code}</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'white', color: c.text, fontSize: '0.75rem', fontWeight: 600, border: `1px solid ${c.border}` }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />{fuelStatusLabel(status)}
                </span>
              </div>
              <h3 style={{ color: '#0f172a' }}>Nhập nhiên liệu — {station.name}</h3>
              <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '2px' }}>{station.generatorName} · {station.address}</p>
            </div>
            <button type="button" onClick={onClose} style={{ color: '#94a3b8', marginTop: '4px' }}><X size={20} /></button>
          </div>

          <div className="px-6 py-4 space-y-5">
            {/* Station info readonly */}
            <div className="rounded-xl p-4 grid grid-cols-2 sm:grid-cols-3 gap-4" style={{ background: '#f8fafc', border: '1px solid #f1f5f9' }}>
              <InfoChip label="Hãng máy" value={station.brandName} />
              <InfoChip label="Model" value={station.modelName} />
              <InfoChip label="Công suất" value={`${station.powerKva} kVA`} />
              <InfoChip label="Loại NL" value={fuelTypeLabel(station.fuelType)} />
              <InfoChip label="Định mức tiêu hao" value={`${station.fuelRate} L/giờ`} />
              <InfoChip label="Dung tích tối đa" value={`${station.maxCapacity} L`} />
              <InfoChip label="NL tồn hiện tại" value={
                <span style={{ color: c.text }}>{station.currentFuel !== null ? `${station.currentFuel} L` : 'Chưa có'}</span>
              } />
              <InfoChip label="Cập nhật gần nhất" value={station.lastUpdated ?? '—'} />
            </div>

            {/* Form */}
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="fuel-date" className="block mb-1.5" style={{ fontSize: '0.82rem', color: '#475569' }}>Ngày ghi nhận</label>
                  <input id="fuel-date" type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={INPUT_STYLE}
                    onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                    onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }} />
                </div>
                <div>
                  <label htmlFor="fuel-added" className="block mb-1.5" style={{ fontSize: '0.82rem', color: '#475569' }}>Nhiên liệu bổ sung (L)</label>
                  <input id="fuel-added" type="number" min={0} value={form.added} onChange={e => setForm(f => ({ ...f, added: e.target.value }))} placeholder="0 — ô trống = không bổ sung" style={INPUT_STYLE}
                    onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                    onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }} />
                </div>
                <div>
                  <label htmlFor="fuel-hours-run" className="block mb-1.5" style={{ fontSize: '0.82rem', color: '#475569' }}>Số giờ chạy máy</label>
                  <input id="fuel-hours-run" type="number" min={0} value={form.hoursRun} onChange={e => setForm(f => ({ ...f, hoursRun: e.target.value }))} placeholder="0 — để tính tiêu hao" style={INPUT_STYLE}
                    onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                    onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }} />
                </div>
              </div>
              <div>
                <label htmlFor="fuel-note" className="block mb-1.5" style={{ fontSize: '0.82rem', color: '#475569' }}>Ghi chú</label>
                <textarea id="fuel-note" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2} placeholder="Ghi chú (tùy chọn)..." style={{ ...INPUT_STYLE, resize: 'none' }}
                  onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }} />
              </div>

              {/* Preview calculation */}
              {hasChange && (
                <div className="rounded-xl p-4 border" style={{ background: isError ? '#fff5f5' : '#f0f9ff', borderColor: isError ? '#fca5a5' : '#bae6fd' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: isError ? '#dc2626' : '#0284c7', marginBottom: '10px' }}>Preview tính toán</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[
                      { label: 'Tồn trước',         value: `${prev} L`,           color: '#475569' },
                      { label: 'Bổ sung',            value: added ? `+${added} L` : '—', color: '#16a34a' },
                      { label: 'Tiêu hao định mức',  value: hours ? `-${consumed.toFixed(1)} L` : '—', color: '#dc2626' },
                      { label: 'Hệ thống tự tính',   value: `${sysCalc.toFixed(1)} L`, color: '#475569' },
                      { label: 'Tồn cuối cùng',      value: finalFuel !== null ? `${finalFuel.toFixed(1)} L` : '—', color: isError ? '#dc2626' : (newC ? newC.text : '#475569') },
                    ].map(item => (
                      <div key={item.label} className="flex flex-col gap-0.5">
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{item.label}</span>
                        <span style={{ fontSize: '0.875rem', fontWeight: 700, color: item.color }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                  {newC && !isError && (
                    <div className="mt-3 pt-3 border-t flex items-center gap-2" style={{ borderColor: '#bae6fd' }}>
                      <span style={{ fontSize: '0.78rem', color: '#64748b' }}>Trạng thái mới:</span>
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full" style={{ background: newC.bg, color: newC.text, fontSize: '0.78rem', fontWeight: 600, border: `1px solid ${newC.border}` }}>
                        <span className="w-2 h-2 rounded-full" style={{ background: newC.dot }} />{fuelStatusLabel(newStatus!)}
                      </span>
                    </div>
                  )}
                  {isError && (
                    <div className="mt-3 flex items-center gap-2">
                      <AlertTriangle size={14} style={{ color: '#dc2626' }} />
                      <span style={{ fontSize: '0.82rem', color: '#b91c1c', fontWeight: 600 }}>{errorMsg}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-lg border" style={{ borderColor: '#e2e8f0', color: '#475569', fontSize: '0.875rem' }}>Hủy</button>
                <button type="submit" disabled={saving || isError} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all"
                  style={{ background: isError ? '#e2e8f0' : saving ? '#93c5fd' : '#2563eb', color: isError ? '#94a3b8' : 'white', fontSize: '0.875rem', fontWeight: 600, cursor: isError ? 'not-allowed' : 'pointer' }}>
                  <Save size={15} />{saving ? 'Đang lưu...' : 'Lưu cập nhật'}
                </button>
              </div>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
