import { useState, useEffect, useMemo, useReducer, useCallback } from 'react';
import { ArrowLeft, MapPin, Zap, Droplets, Calendar, Clock, X, TrendingDown, TrendingUp, Minus, Wrench, Plus, Settings as SettingsIcon, Loader2 } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { Station, FuelRecord, getFuelStatus, fuelStatusColor, fuelStatusLabel } from '@/shared/types';
import { getFuelHistory } from '@/features/fuel/api/fuelApi';
import {
  getMaintenance, createMaintenance, getMachineChanges,
  type MaintenanceSummary, type MachineChange,
} from '../api/stationHistoryApi';
import { createAdjustmentRequest } from '../api/adjustmentApi';
import { canEnterFuel } from '@/shared/auth/permissions';
import { todayLocalISO } from '@/shared/utils/date';

interface StationDetailProps {
  station: Station;
  records: FuelRecord[];
  userRole?: string;
  onBack: () => void;
  onGoToDirectEntry: () => void;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b" style={{ borderColor: '#f1f5f9' }}>
      <span style={{ fontSize: '0.82rem', color: '#64748b', flexBasis: 'clamp(100px, 35%, 140px)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '0.875rem', color: '#1e293b', fontWeight: 500, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

type HistoryPeriod = 'all' | 'week' | 'month' | 'year';

const HISTORY_PERIODS: { key: HistoryPeriod; label: string }[] = [
  { key: 'week',  label: 'Tuần' },
  { key: 'month', label: 'Tháng' },
  { key: 'year',  label: 'Năm' },
  { key: 'all',   label: 'Tất cả' },
];

/** Start-of-period date (YYYY-MM-DD) by VN calendar, or null for "all". */
function periodCutoff(period: HistoryPeriod): string | null {
  if (period === 'all') return null;
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === 'week') d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // back to Monday
  else if (period === 'month') d.setDate(1);
  else if (period === 'year') d.setMonth(0, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** ISO or YYYY-MM-DD → dd/mm/yyyy for display. */
export function formatRecordDate(date: string): string {
  const ymd = date.slice(0, 10);
  const [y, m, d] = ymd.split('-');
  return d && m && y ? `${d}/${m}/${y}` : date;
}

const HISTORY_TABLE_HEADERS = [
  { label: 'Ngày' },
  { label: 'Tồn trước', hide: 'hidden sm:table-cell' },
  { label: 'Bổ sung' },
  { label: 'Giờ chạy', hide: 'hidden sm:table-cell' },
  { label: 'Tiêu hao', hide: 'hidden md:table-cell' },
  { label: 'Tồn cuối' },
  { label: 'Nguồn', hide: 'hidden sm:table-cell' },
  { label: '' },
] as Array<{ label: string; hide?: string }>;

// Adjustment modal reducer
const ADJ_EMPTY_FORM = { newFuelAdded: '', newHoursRun: '', newNotes: '', reason: '' };
type AdjState = { open: boolean; target: FuelRecord | null; form: typeof ADJ_EMPTY_FORM; saving: boolean };
type AdjAction =
  | { type: 'open'; target: FuelRecord }
  | { type: 'close' }
  | { type: 'field'; key: string; value: string }
  | { type: 'saving-start' }
  | { type: 'saving-done' };

function adjModalReducer(state: AdjState, action: AdjAction): AdjState {
  switch (action.type) {
    case 'open':         return { open: true, saving: false, target: action.target, form: { newFuelAdded: String(action.target.added), newHoursRun: String(action.target.hoursRun), newNotes: action.target.note ?? '', reason: '' } };
    case 'close':        return { ...state, open: false };
    case 'field':        return { ...state, form: { ...state.form, [action.key]: action.value } };
    case 'saving-start': return { ...state, saving: true };
    case 'saving-done':  return { ...state, saving: false };
    default:             return state;
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface FuelHistoryTableProps {
  records: FuelRecord[];
  adjustedIds: Set<string>;
  canRequestAdjustment: boolean;
  onRequestAdjustment: (r: FuelRecord) => void;
  period: HistoryPeriod;
  onPeriodChange: (p: HistoryPeriod) => void;
}

function FuelHistoryTable({ records, adjustedIds, canRequestAdjustment, onRequestAdjustment, period, onPeriodChange }: FuelHistoryTableProps) {
  return (
    <div className="lg:col-span-1 rounded-xl border overflow-hidden" style={{ background: 'white', borderColor: '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b" style={{ borderColor: '#f1f5f9' }}>
        <div className="flex items-center gap-2">
          <Clock size={16} style={{ color: '#2563eb' }} />
          <h4 style={{ color: '#0f172a' }}>Lịch sử nhiên liệu</h4>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg self-start" style={{ background: '#f1f5f9' }}>
          {HISTORY_PERIODS.map(p => (
            <button
              type="button"
              key={p.key}
              onClick={() => onPeriodChange(p.key)}
              className="px-2.5 py-1 rounded-md transition"
              style={{
                fontSize: '0.75rem',
                fontWeight: period === p.key ? 600 : 400,
                background: period === p.key ? 'white' : 'transparent',
                color: period === p.key ? '#0f172a' : '#64748b',
                boxShadow: period === p.key ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        {records.length === 0 ? (
          <div className="py-10 text-center" style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
            {period === 'all' ? 'Chưa có lịch sử' : 'Không có bản ghi trong kỳ này'}
          </div>
        ) : (
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {HISTORY_TABLE_HEADERS.map((col) => (
                  <th key={col.label} className={`px-3 py-2.5 text-left border-b ${col.hide ?? ''}`} style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, borderColor: '#e2e8f0' }}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map(r => {
                const isAdjustment = r.source === 'adjustment';
                const hasBeenAdjusted = adjustedIds.has(r.id);
                return (
                  <tr key={r.id} className="border-b" style={{ borderColor: '#f8fafc', background: isAdjustment ? '#f0f9ff' : undefined }}>
                    <td className="px-3 py-2.5" style={{ fontSize: '0.8rem', color: '#374151', whiteSpace: 'nowrap' }}>
                      <div>{formatRecordDate(r.date)}</div>
                      {hasBeenAdjusted && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium" style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.75rem' }}>
                          Đã điều chỉnh
                        </span>
                      )}
                    </td>
                    <td className="hidden sm:table-cell px-3 py-2.5" style={{ fontSize: '0.8rem', color: '#64748b' }}>{r.previousFuel} L</td>
                    <td className="px-3 py-2.5" style={{ fontSize: '0.8rem', color: r.added > 0 ? '#16a34a' : '#94a3b8', fontWeight: r.added > 0 ? 600 : 400 }}>
                      {isAdjustment && r.adjustmentAmount != null
                        ? <span style={{ color: (r.adjustmentAmount ?? 0) >= 0 ? '#16a34a' : '#dc2626', fontWeight: 600 }}>
                            {(r.adjustmentAmount ?? 0) >= 0 ? '+' : ''}{r.adjustmentAmount?.toFixed(1)} L
                          </span>
                        : r.added > 0 ? `+${r.added} L` : '—'}
                    </td>
                    <td className="hidden sm:table-cell px-3 py-2.5" style={{ fontSize: '0.8rem', color: '#64748b' }}>{isAdjustment ? '—' : `${r.hoursRun}h`}</td>
                    <td className="hidden md:table-cell px-3 py-2.5" style={{ fontSize: '0.8rem', color: '#dc2626' }}>{isAdjustment ? '—' : `${r.consumed} L`}</td>
                    <td className="px-3 py-2.5" style={{ fontSize: '0.8rem', fontWeight: 600, color: r.endFuel > 20 ? '#16a34a' : r.endFuel >= 10 ? '#ca8a04' : '#dc2626' }}>
                      {r.endFuel} L
                    </td>
                    <td className="hidden sm:table-cell px-3 py-2.5">
                      <span className="px-2 py-0.5 rounded" style={{
                        fontSize: '0.75rem', fontWeight: 500,
                        background: isAdjustment ? '#ede9fe' : r.source === 'import' ? '#eff6ff' : '#f0fdf4',
                        color: isAdjustment ? '#7c3aed' : r.source === 'import' ? '#2563eb' : '#16a34a',
                      }}>
                        {isAdjustment ? 'Điều chỉnh' : r.source === 'import' ? 'Import' : 'Nhập tay'}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      {canRequestAdjustment && !isAdjustment && !hasBeenAdjusted && (
                        <button
                          type="button"
                          onClick={() => onRequestAdjustment(r)}
                          className="px-2 py-1.5 rounded text-xs border transition-colors"
                          style={{ fontSize: '0.75rem', color: '#7c3aed', borderColor: '#ede9fe', background: 'white', whiteSpace: 'nowrap' }}
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
  );
}

interface AdjustmentModalProps {
  adj: AdjState;
  dispatchAdj: React.Dispatch<AdjAction>;
  onSubmit: (e: React.FormEvent) => void;
}

function AdjustmentModal({ adj, dispatchAdj, onSubmit }: AdjustmentModalProps) {
  return (
    <Dialog.Root open={adj.open} onOpenChange={open => !open && dispatchAdj({ type: 'close' })}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.5)' }} />
        <Dialog.Content aria-describedby={undefined} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 rounded-2xl p-6 w-full max-w-md" style={{ background: 'white', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>Yêu cầu điều chỉnh</Dialog.Title>
            <button type="button" onClick={() => dispatchAdj({ type: 'close' })} style={{ color: '#94a3b8' }}><X size={18} /></button>
          </div>
          {adj.target && (
            <div className="mb-4 p-3 rounded-lg" style={{ background: '#f8fafc', fontSize: '0.82rem', color: '#475569' }}>
              <div>Bản ghi ngày: <span style={{ fontWeight: 600 }}>{adj.target.date}</span></div>
              <div>NL bổ sung gốc: <span style={{ fontWeight: 600 }}>{adj.target.added} L</span> | Giờ chạy gốc: <span style={{ fontWeight: 600 }}>{adj.target.hoursRun}h</span></div>
            </div>
          )}
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="adj-fuel-added" style={{ fontSize: '0.78rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>NL bổ sung mới (L)</label>
                <input id="adj-fuel-added" type="number" step="0.01" min="0" value={adj.form.newFuelAdded}
                  onChange={e => dispatchAdj({ type: 'field', key: 'newFuelAdded', value: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border" style={{ fontSize: '0.875rem', borderColor: '#e2e8f0' }} />
              </div>
              <div>
                <label htmlFor="adj-hours-run" style={{ fontSize: '0.78rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Số giờ chạy mới (h)</label>
                <input id="adj-hours-run" type="number" step="0.1" min="0" value={adj.form.newHoursRun}
                  onChange={e => dispatchAdj({ type: 'field', key: 'newHoursRun', value: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border" style={{ fontSize: '0.875rem', borderColor: '#e2e8f0' }} />
              </div>
            </div>
            <div>
              <label htmlFor="adj-notes" style={{ fontSize: '0.78rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Ghi chú mới</label>
              <input id="adj-notes" type="text" value={adj.form.newNotes}
                onChange={e => dispatchAdj({ type: 'field', key: 'newNotes', value: e.target.value })}
                placeholder="Ghi chú (tùy chọn)" className="w-full px-3 py-2 rounded-lg border" style={{ fontSize: '0.875rem', borderColor: '#e2e8f0' }} />
            </div>
            <div>
              <label htmlFor="adj-reason" style={{ fontSize: '0.78rem', color: '#64748b', display: 'block', marginBottom: '4px' }}>Lý do điều chỉnh <span style={{ color: '#dc2626' }}>*</span></label>
              <textarea id="adj-reason" required value={adj.form.reason}
                onChange={e => dispatchAdj({ type: 'field', key: 'reason', value: e.target.value })}
                placeholder="Mô tả lý do cần điều chỉnh..." rows={3}
                className="w-full px-3 py-2 rounded-lg border resize-none" style={{ fontSize: '0.875rem', borderColor: '#e2e8f0' }} />
            </div>
            <div className="flex gap-3 pt-1">
              <button type="button" onClick={() => dispatchAdj({ type: 'close' })}
                className="flex-1 py-2.5 rounded-lg border" style={{ borderColor: '#e2e8f0', color: '#475569', fontSize: '0.875rem' }}>
                Hủy
              </button>
              <button type="submit" disabled={adj.saving}
                className="flex-1 py-2.5 rounded-lg" style={{ background: adj.saving ? '#c4b5fd' : '#7c3aed', color: 'white', fontSize: '0.875rem', fontWeight: 600 }}>
                {adj.saving ? 'Đang gửi...' : 'Gửi yêu cầu'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function StationDetail({ station, records, userRole, onBack, onGoToDirectEntry }: StationDetailProps) {
  const [localRecords, setLocalRecords] = useState<FuelRecord[]>([]);
  const [historyPeriod, setHistoryPeriod] = useState<HistoryPeriod>('all');
  const [adj, dispatchAdj] = useReducer(adjModalReducer, { open: false, target: null, form: ADJ_EMPTY_FORM, saving: false });

  useEffect(() => {
    // Pull a wide window so the period filter (below) has the full history to work with.
    getFuelHistory(station.id, { limit: 500 }).then(setLocalRecords).catch(() => {});
  }, [station.id]);

  const visibleRecords = useMemo(() => {
    const cutoff = periodCutoff(historyPeriod);
    return cutoff ? localRecords.filter(r => r.date.slice(0, 10) >= cutoff) : localRecords;
  }, [localRecords, historyPeriod]);

  // Maintenance (#3) + generator-change audit (#4)
  const [maint, setMaint] = useState<MaintenanceSummary | null>(null);
  const [machineChanges, setMachineChanges] = useState<MachineChange[]>([]);
  const [maintOpen, setMaintOpen] = useState(false);
  const [maintDate, setMaintDate] = useState(todayLocalISO);
  const [maintNote, setMaintNote] = useState('');
  const [maintSaving, setMaintSaving] = useState(false);

  const loadMaint = useCallback(() => {
    getMaintenance(station.id).then(setMaint).catch(() => {});
    getMachineChanges(station.id).then(setMachineChanges).catch(() => {});
  }, [station.id]);

  useEffect(() => { loadMaint(); }, [loadMaint]);

  const handleSaveMaintenance = async () => {
    if (!maintDate) { toast.error('Vui lòng chọn ngày bảo dưỡng'); return; }
    setMaintSaving(true);
    try {
      await createMaintenance(station.id, { performedAt: maintDate, note: maintNote.trim() || null });
      toast.success('Đã ghi nhận bảo dưỡng');
      setMaintOpen(false);
      setMaintNote('');
      setMaintDate(todayLocalISO());
      loadMaint();
    } catch (err) {
      toast.error((err as Error).message || 'Lỗi ghi bảo dưỡng');
    } finally {
      setMaintSaving(false);
    }
  };

  const status = getFuelStatus(station.currentFuel, station.fuelRate);
  const c = fuelStatusColor(status);
  const pct = station.currentFuel !== null ? Math.round((station.currentFuel / station.maxCapacity) * 100) : 0;

  const adjustedIds = useMemo(
    () => new Set(localRecords.flatMap(r => (r.source === 'adjustment' && r.adjustmentForId) ? [r.adjustmentForId!] : [])),
    [localRecords]
  );

  const canRequestAdjustment = userRole === 'admin' || userRole === 'manager';

  const handleAdjSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { target, form: adjForm } = adj;
    if (!target) return;
    if (!adjForm.reason.trim()) { toast.error('Lý do điều chỉnh là bắt buộc.'); return; }
    dispatchAdj({ type: 'saving-start' });
    try {
      await createAdjustmentRequest({
        originalRecordId: target.id,
        reason: adjForm.reason.trim(),
        newFuelAdded: parseFloat(adjForm.newFuelAdded) || 0,
        newHoursRun: parseFloat(adjForm.newHoursRun) || 0,
        newNotes: adjForm.newNotes || null,
      });
      toast.success('Yêu cầu điều chỉnh đã được gửi đến Admin.');
      dispatchAdj({ type: 'close' });
    } catch (err) {
      toast.error((err as Error).message || 'Lỗi gửi yêu cầu điều chỉnh');
    } finally {
      dispatchAdj({ type: 'saving-done' });
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          type="button"
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
              <InfoRow label="Nhân viên quản lý" value={station.managerName || '— Chưa gán —'} />
            </div>
          </div>

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
                    <div className="h-full rounded-full transition" style={{ width: `${pct}%`, background: c.dot }} />
                  </div>
                </div>
              )}
              <div className="mt-3" style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
                Cập nhật: {station.lastUpdated ?? 'Chưa có dữ liệu'}
              </div>
            </div>
          </div>
        </div>

        {/* Middle: entry point to DirectEntry — no direct-write bypass of preview/confirm */}
        {canEnterFuel(userRole) && (
          <div className="rounded-xl border p-5 flex flex-col items-center justify-center text-center" style={{ background: 'white', borderColor: '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
            <Droplets size={28} style={{ color: '#2563eb', marginBottom: '12px' }} />
            <h4 style={{ color: '#0f172a', marginBottom: '6px' }}>Cập nhật nhiên liệu</h4>
            <p style={{ color: '#64748b', fontSize: '0.82rem', marginBottom: '16px' }}>
              Nhập nhiên liệu cho trạm này qua màn hình Nhập dữ liệu trực tiếp (có kiểm tra và xác nhận trước khi lưu).
            </p>
            <button type="button" onClick={onGoToDirectEntry} className="flex items-center gap-2 px-5 py-2.5 rounded-lg transition" style={{ background: '#2563eb', color: 'white', fontSize: '0.875rem', fontWeight: 600 }}>
              <Droplets size={15} /> Nhập nhiên liệu
            </button>
          </div>
        )}

        {/* Right: History table */}
        <FuelHistoryTable
          records={visibleRecords}
          adjustedIds={adjustedIds}
          canRequestAdjustment={canRequestAdjustment}
          onRequestAdjustment={r => dispatchAdj({ type: 'open', target: r })}
          period={historyPeriod}
          onPeriodChange={setHistoryPeriod}
        />
      </div>

      {/* Maintenance (#3) + generator-change history (#4) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border overflow-hidden" style={{ background: 'white', borderColor: '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#f1f5f9' }}>
            <div className="flex items-center gap-2">
              <Wrench size={16} style={{ color: '#0891b2' }} />
              <h4 style={{ color: '#0f172a' }}>Bảo dưỡng</h4>
            </div>
            {canEnterFuel(userRole) && (
              <button type="button" onClick={() => setMaintOpen(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg" style={{ background: '#0891b2', color: 'white', fontSize: '0.8rem', fontWeight: 600 }}>
                <Plus size={14} /> Ghi bảo dưỡng
              </button>
            )}
          </div>
          <div className="px-5 py-3 flex gap-6 border-b" style={{ borderColor: '#f1f5f9' }}>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Gần nhất</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>
                {maint?.lastPerformedAt ? formatRecordDate(maint.lastPerformedAt) : '— Chưa có —'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Trong tháng này</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>{maint?.countThisMonth ?? 0} lần</div>
            </div>
            <div>
              <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Tổng</div>
              <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>{maint?.total ?? 0} lần</div>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto divide-y" style={{ borderColor: '#f8fafc' }}>
            {(maint?.logs.length ?? 0) === 0 ? (
              <div className="py-8 text-center" style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Chưa có lần bảo dưỡng nào</div>
            ) : (
              maint!.logs.map(l => (
                <div key={l.id} className="px-5 py-2.5">
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>{formatRecordDate(l.performedAt)}</span>
                    {l.recordedBy && <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{l.recordedBy}</span>}
                  </div>
                  {l.note && <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>{l.note}</div>}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border overflow-hidden" style={{ background: 'white', borderColor: '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: '#f1f5f9' }}>
            <SettingsIcon size={16} style={{ color: '#7c3aed' }} />
            <h4 style={{ color: '#0f172a' }}>Lịch sử thay máy (hãng/model)</h4>
          </div>
          <div className="max-h-72 overflow-y-auto divide-y" style={{ borderColor: '#f8fafc' }}>
            {machineChanges.length === 0 ? (
              <div className="py-8 text-center" style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Chưa có thay đổi máy nào</div>
            ) : (
              machineChanges.map(mc => (
                <div key={mc.id} className="px-5 py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
                      {new Date(mc.changedAt).toLocaleString('vi-VN')}
                    </span>
                    {mc.changedBy && <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>bởi {mc.changedBy}</span>}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#374151' }}>
                    <span style={{ color: '#94a3b8' }}>{mc.oldBrandName || '—'} · {mc.oldModelName || '—'}</span>
                    {' → '}
                    <span style={{ fontWeight: 600 }}>{mc.newBrandName || '—'} · {mc.newModelName || '—'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <Dialog.Root open={maintOpen} onOpenChange={v => { if (!v) setMaintOpen(false); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0" style={{ background: 'rgba(0,0,0,0.4)', zIndex: 50 }} />
          <Dialog.Content className="fixed rounded-2xl" style={{ top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 51, background: 'white', width: '420px', maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#f1f5f9' }}>
              <Dialog.Title style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>Ghi bảo dưỡng</Dialog.Title>
              <Dialog.Close asChild><button type="button" style={{ color: '#94a3b8' }}><X size={18} /></button></Dialog.Close>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label htmlFor="maint-date" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Ngày bảo dưỡng *</label>
                <input id="maint-date" type="date" value={maintDate} onChange={e => setMaintDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border outline-none" style={{ borderColor: '#e2e8f0', fontSize: '0.9rem' }} />
              </div>
              <div>
                <label htmlFor="maint-note" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Nội dung / ghi chú</label>
                <textarea id="maint-note" value={maintNote} onChange={e => setMaintNote(e.target.value)} placeholder="VD: Thay nhớt, kiểm tra lọc gió..." className="w-full px-3 py-2 rounded-lg border outline-none" style={{ borderColor: '#e2e8f0', fontSize: '0.9rem', minHeight: '70px', resize: 'vertical' }} />
              </div>
            </div>
            <div className="flex justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: '#f1f5f9' }}>
              <button type="button" onClick={() => setMaintOpen(false)} className="px-4 py-2 rounded-lg border" style={{ fontSize: '0.875rem', borderColor: '#e2e8f0', color: '#64748b' }}>Hủy</button>
              <button type="button" onClick={handleSaveMaintenance} disabled={maintSaving} className="flex items-center gap-2 px-5 py-2 rounded-lg" style={{ background: maintSaving ? '#67e8f9' : '#0891b2', color: 'white', fontSize: '0.875rem', fontWeight: 600 }}>
                {maintSaving && <Loader2 size={15} className="animate-spin" />}
                {maintSaving ? 'Đang lưu...' : 'Lưu'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <AdjustmentModal adj={adj} dispatchAdj={dispatchAdj} onSubmit={handleAdjSubmit} />
    </div>
  );
}
