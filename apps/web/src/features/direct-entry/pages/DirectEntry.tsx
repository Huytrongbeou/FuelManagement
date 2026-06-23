import { useState, useRef, useReducer, useCallback } from 'react';
import { RefreshCw, CheckCircle, AlertTriangle, XCircle, Save, Download, RotateCcw, Trash2, Check } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { Station, getFuelStatus, fuelStatusColor, fuelStatusLabel } from '@/shared/types';
import { previewEntry, confirmEntry } from '../api/manualEntryApi';
import { downloadWithAuth } from '@/shared/api/client';

interface Props {
  stations: Station[];
  onNavigateToDashboard: () => void;
}

type RowStatus = 'unchanged' | 'valid' | 'warning' | 'error';

interface EntryRow {
  id: string;
  stationId: string | null;
  code: string;
  name: string;
  added: string;
  hoursRun: string;
  date: string;
  note: string;
  // computed
  prevFuel: number | null;
  consumed: number | null;
  systemCalc: number | null;
  finalFuel: number | null;
  status: RowStatus;
  errorMsg: string;
}

function calcRow(row: EntryRow, station: Station | undefined): Partial<EntryRow> {
  if (!station) {
    return { prevFuel: null, consumed: null, systemCalc: null, finalFuel: null, status: 'error', errorMsg: 'Mã trạm không tồn tại' };
  }
  const hasChange = row.added !== '' || row.hoursRun !== '';
  if (!hasChange) return { prevFuel: station.currentFuel, consumed: null, systemCalc: null, finalFuel: null, status: 'unchanged', errorMsg: '' };

  const prev = station.currentFuel ?? 0;
  const added = row.added !== '' ? parseFloat(row.added) : 0;
  const hours = row.hoursRun !== '' ? parseFloat(row.hoursRun) : 0;
  const consumed = hours * station.fuelRate;
  const sysCalc = prev + added - consumed;
  const finalFuel = sysCalc;

  let status: RowStatus = 'valid';
  let errorMsg = '';

  if (finalFuel < 0) { status = 'error'; errorMsg = 'Nhiên liệu tồn cuối âm'; }
  else if (finalFuel > station.maxCapacity) { status = 'error'; errorMsg = `Vượt dung tích tối đa (${station.maxCapacity}L)`; }

  return { prevFuel: prev, consumed, systemCalc: sysCalc, finalFuel, status, errorMsg };
}

function fmt(n: number | null, suffix = 'L') {
  return n !== null ? `${n.toFixed(1)} ${suffix}` : '—';
}

const TODAY = new Date().toISOString().slice(0, 10);

const RULES = [
  'Ô trống = không cập nhật',
  'Số 0 = giá trị hợp lệ',
  'NL bổ sung cộng trước',
  'Số giờ chạy → tính tiêu hao',
  'Không cho tồn cuối âm hoặc vượt tối đa',
];

const TABLE_COLS = [
  { label: 'Mã trạm',        sticky: true,  left: 0   as number | null, readonly: false },
  { label: 'Tên trạm',        sticky: true,  left: 110 as number | null, readonly: false },
  { label: 'NL bổ sung',      sticky: false, left: null,                 readonly: false },
  { label: 'Số giờ chạy',     sticky: false, left: null,                 readonly: false },
  { label: 'Ngày GN',         sticky: false, left: null,                 readonly: false },
  { label: 'Ghi chú',         sticky: false, left: null,                 readonly: false },
  { label: 'Tồn trước',       sticky: false, left: null,                 readonly: true  },
  { label: 'Tiêu hao',        sticky: false, left: null,                 readonly: true  },
  { label: 'Tự tính',         sticky: false, left: null,                 readonly: true  },
  { label: 'Tồn cuối',        sticky: false, left: null,                 readonly: true  },
  { label: 'Cảnh báo',        sticky: false, left: null,                 readonly: true  },
  { label: 'Lỗi / Cảnh báo', sticky: false, left: null,                 readonly: false },
  { label: 'Hành động',      sticky: false, left: null,                 readonly: false },
];

const TABLE_COL_TH_STYLES = TABLE_COLS.map(col => ({
  padding: '10px 8px',
  fontSize: '0.75rem',
  fontWeight: 600,
  textAlign: 'left' as const,
  whiteSpace: 'nowrap' as const,
  background: col.readonly ? '#162d4d' : '#0c2340',
  position: (col.sticky ? 'sticky' : 'relative') as 'sticky' | 'relative',
  left: col.sticky ? col.left! : undefined,
  zIndex: col.sticky ? 31 : 1,
  borderRight: '1px solid rgba(255,255,255,0.1)',
}));

type SaveState = { saving: boolean; successOpen: boolean; doubleSubmitOpen: boolean };
type SaveAction =
  | { type: 'save-start' }
  | { type: 'save-success' }
  | { type: 'save-error' }
  | { type: 'double-submit-open' }
  | { type: 'double-submit-close' }
  | { type: 'close-success' };

function saveReducer(state: SaveState, action: SaveAction): SaveState {
  switch (action.type) {
    case 'save-start':          return { ...state, saving: true };
    case 'save-success':        return { saving: false, successOpen: true, doubleSubmitOpen: false };
    case 'save-error':          return { ...state, saving: false };
    case 'double-submit-open':  return { ...state, doubleSubmitOpen: true };
    case 'double-submit-close': return { ...state, doubleSubmitOpen: false };
    case 'close-success':       return { ...state, successOpen: false };
    default:                    return state;
  }
}

function rowBg(status: RowStatus, i: number) {
  if (status === 'error')   return '#fff5f5';
  if (status === 'warning') return '#fffbeb';
  if (status === 'valid')   return '#f0fdf4';
  return i % 2 === 0 ? 'white' : '#fafafa';
}

const STATUS_BADGE_CFG = {
  unchanged: { bg: '#f1f5f9', text: '#64748b', icon: null,          label: 'Không thay đổi' },
  valid:     { bg: '#dcfce7', text: '#16a34a', icon: CheckCircle,   label: 'Hợp lệ' },
  warning:   { bg: '#fef9c3', text: '#ca8a04', icon: AlertTriangle, label: 'Cảnh báo' },
  error:     { bg: '#fee2e2', text: '#dc2626', icon: XCircle,       label: 'Lỗi' },
} as const;

function statusBadge(status: RowStatus) {
  const cfg = STATUS_BADGE_CFG[status];
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: cfg.bg, color: cfg.text, fontSize: '0.75rem', fontWeight: 600 }}>
      {Icon && <Icon size={10} />}{cfg.label}
    </span>
  );
}

function cellStyle(readonly = false) {
  return {
    padding: '5px 8px',
    fontSize: '0.8rem',
    borderColor: '#e2e8f0',
    background: readonly ? '#f8fafc' : 'white',
    color: readonly ? '#64748b' : '#1e293b',
    outline: 'none',
    width: '100%',
    border: '1px solid #e2e8f0',
    borderRadius: '6px',
    fontFamily: readonly ? 'monospace' : 'inherit',
  };
}

// ── Table sub-component ───────────────────────────────────────────────────────

interface DirectEntryTableProps {
  rows: EntryRow[];
  onUpdateRow: (id: string, field: string, value: string) => void;
  onRemoveRow: (id: string) => void;
  onRevertRow: (id: string) => void;
  onLoadCurrent: () => void;
}

function DirectEntryTable({ rows, onUpdateRow, onRemoveRow, onRevertRow, onLoadCurrent }: DirectEntryTableProps) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4" style={{ color: '#94a3b8' }}>
        <RefreshCw size={40} style={{ opacity: 0.3 }} />
        <div style={{ fontSize: '1rem', color: '#64748b' }}>Chưa có dữ liệu</div>
        <button type="button" onClick={onLoadCurrent} className="flex items-center gap-2 px-4 py-2.5 rounded-lg" style={{ background: '#2563eb', color: 'white', fontSize: '0.875rem', fontWeight: 600 }}>
          <RefreshCw size={15} /> Tải dữ liệu hiện tại
        </button>
      </div>
    );
  }

  return (
    <div style={{ minWidth: '1200px' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '110px' }} />
          <col style={{ width: '160px' }} />
          <col style={{ width: '90px' }} />
          <col style={{ width: '90px' }} />
          <col style={{ width: '100px' }} />
          <col style={{ width: '140px' }} />
          <col style={{ width: '90px' }} />
          <col style={{ width: '90px' }} />
          <col style={{ width: '100px' }} />
          <col style={{ width: '100px' }} />
          <col style={{ width: '110px' }} />
          <col style={{ width: '140px' }} />
          <col style={{ width: '70px' }} />
        </colgroup>
        <thead>
          <tr style={{ background: '#0c2340', color: 'white', position: 'sticky', top: 0, zIndex: 30 }}>
            {TABLE_COLS.map((col, i) => (
              <th key={col.label} style={TABLE_COL_TH_STYLES[i]}>
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const newFuelStatus = row.finalFuel !== null ? getFuelStatus(row.finalFuel) : null;
            const c = newFuelStatus ? fuelStatusColor(newFuelStatus) : null;
            const noFuelData = row.prevFuel === null;
            return (
              <tr key={row.id} style={{ background: rowBg(row.status, i) }}>
                <td style={{ position: 'sticky', left: 0, zIndex: 10, background: rowBg(row.status, i), borderRight: '2px solid #e2e8f0', padding: '4px 6px' }}>
                  <div style={{ ...cellStyle(true), display: 'flex', alignItems: 'center' }}>{row.code}</div>
                </td>
                <td style={{ position: 'sticky', left: 110, zIndex: 10, background: rowBg(row.status, i), borderRight: '2px solid #e2e8f0', padding: '4px 6px' }}>
                  <div style={{ ...cellStyle(true), display: 'flex', alignItems: 'center', fontFamily: 'inherit' }}>{row.name}</div>
                </td>
                <td style={{ padding: '4px 6px' }}>
                  <input
                    type="number" min={0}
                    value={row.added}
                    onChange={e => onUpdateRow(row.id, 'added', e.target.value)}
                    placeholder="0"
                    disabled={noFuelData}
                    aria-label={`NL bổ sung — ${row.name}`}
                    title={noFuelData ? 'Trạm chưa có tồn ban đầu. Vui lòng nhập tồn ban đầu trước khi tính tự động.' : undefined}
                    style={{ ...cellStyle(noFuelData), opacity: noFuelData ? 0.5 : 1, cursor: noFuelData ? 'not-allowed' : 'text' }}
                    onFocus={e => { if (!noFuelData) { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 2px rgba(37,99,235,0.2)'; } }}
                    onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
                  />
                </td>
                <td style={{ padding: '4px 6px' }}>
                  <input
                    type="number" min={0}
                    value={row.hoursRun}
                    onChange={e => onUpdateRow(row.id, 'hoursRun', e.target.value)}
                    placeholder="0"
                    disabled={noFuelData}
                    aria-label={`Số giờ chạy — ${row.name}`}
                    title={noFuelData ? 'Trạm chưa có tồn ban đầu. Vui lòng nhập tồn ban đầu trước khi tính tự động.' : undefined}
                    style={{ ...cellStyle(noFuelData), opacity: noFuelData ? 0.5 : 1, cursor: noFuelData ? 'not-allowed' : 'text' }}
                    onFocus={e => { if (!noFuelData) { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 2px rgba(37,99,235,0.2)'; } }}
                    onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
                  />
                </td>
                <td style={{ padding: '4px 6px' }}>
                  <input type="date" value={row.date} onChange={e => onUpdateRow(row.id, 'date', e.target.value)} aria-label={`Ngày giao nhận — ${row.name}`} style={cellStyle()} onFocus={e => { e.target.style.borderColor = '#2563eb'; }} onBlur={e => { e.target.style.borderColor = '#e2e8f0'; }} />
                </td>
                <td style={{ padding: '4px 6px' }}>
                  <input value={row.note} onChange={e => onUpdateRow(row.id, 'note', e.target.value)} placeholder="Ghi chú..." aria-label={`Ghi chú — ${row.name}`} style={cellStyle()} />
                </td>
                <td style={{ padding: '4px 6px', background: '#f8fafc' }}>
                  <div style={{ ...cellStyle(true), display: 'flex', alignItems: 'center' }}>{fmt(row.prevFuel)}</div>
                </td>
                <td style={{ padding: '4px 6px', background: '#f8fafc' }}>
                  <div style={{ ...cellStyle(true), display: 'flex', alignItems: 'center', color: row.consumed ? '#dc2626' : '#94a3b8' }}>{fmt(row.consumed)}</div>
                </td>
                <td style={{ padding: '4px 6px', background: '#f8fafc' }}>
                  <div style={{ ...cellStyle(true), display: 'flex', alignItems: 'center' }}>{fmt(row.systemCalc)}</div>
                </td>
                <td style={{ padding: '4px 6px', background: '#f8fafc' }}>
                  <div style={{ ...cellStyle(true), display: 'flex', alignItems: 'center', color: c ? c.text : '#94a3b8', fontWeight: row.finalFuel !== null ? 600 : 400 }}>
                    {fmt(row.finalFuel)}
                  </div>
                </td>
                <td style={{ padding: '4px 6px', background: '#f8fafc' }}>
                  {c ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full" style={{ background: c.bg, color: c.text, fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', border: `1px solid ${c.border}` }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
                      {fuelStatusLabel(newFuelStatus!)}
                    </span>
                  ) : '—'}
                </td>
                <td style={{ padding: '4px 6px', zIndex: 10 }}>
                  <div className="flex items-center gap-1.5">
                    {statusBadge(row.status)}
                    {row.errorMsg && <span style={{ fontSize: '0.75rem', color: row.status === 'error' ? '#dc2626' : '#ca8a04' }}>{row.errorMsg}</span>}
                  </div>
                </td>
                <td style={{ padding: '4px 6px' }}>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => onRevertRow(row.id)} title="Hoàn tác" className="p-1 rounded" style={{ color: '#94a3b8' }} onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f1f5f9'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                      <RotateCcw size={12} />
                    </button>
                    <button type="button" onClick={() => onRemoveRow(row.id)} title="Bỏ khỏi lần nhập" className="p-1 rounded" style={{ color: '#94a3b8' }} onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fee2e2'; (e.currentTarget as HTMLElement).style.color = '#dc2626'; }} onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DirectEntry({ stations, onNavigateToDashboard }: Props) {
  const [rows, setRows] = useState<EntryRow[]>([]);
  const [checked, setChecked] = useState(false);
  const [save, dispatchSave] = useReducer(saveReducer, { saving: false, successOpen: false, doubleSubmitOpen: false });
  const lastSubmitRef = useRef<{ signature: string; time: number } | null>(null);
  const pendingSubmitRef = useRef<(() => Promise<void>) | null>(null);
  const hasAutoLoadedRef = useRef(false);

  // Auto-load once when stations first become available.
  // Called during render (not effect) so rows are ready before the first paint.
  if (!hasAutoLoadedRef.current && stations.length > 0) {
    hasAutoLoadedRef.current = true;
    setRows(stations.map(s => ({
      id: s.id, stationId: s.id, code: s.code, name: s.name,
      added: '', hoursRun: '', date: TODAY, note: '',
      prevFuel: s.currentFuel, consumed: null, systemCalc: null, finalFuel: null,
      status: 'unchanged' as RowStatus, errorMsg: '',
    })));
  }

  const loadCurrent = useCallback((options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    const loaded = stations.map(s => ({
      id: s.id, stationId: s.id, code: s.code, name: s.name,
      added: '', hoursRun: '', date: TODAY, note: '',
      prevFuel: s.currentFuel, consumed: null, systemCalc: null, finalFuel: null,
      status: 'unchanged' as RowStatus, errorMsg: '',
    }));
    setRows(loaded);
    setChecked(false);
    if (!silent) toast.success('Đã tải dữ liệu hiện tại');
  }, [stations]);

  const updateRow = (id: string, field: string, value: string) => {
    setRows(prev => prev.map(r => r.id !== id ? r : { ...r, [field]: value }));
    setChecked(false);
  };

  const removeRow = (id: string) => setRows(r => r.filter(x => x.id !== id));
  const revertRow = (id: string) => setRows(r => r.map(x => x.id !== id ? x : { ...x, added: '', hoursRun: '', note: '', status: 'unchanged' as RowStatus, errorMsg: '' }));

  const checkData = () => {
    setRows(prev => prev.map(r => {
      const st = stations.find(s => s.id === r.stationId || s.code === r.code);
      return { ...r, ...calcRow(r, st) };
    }));
    setChecked(true);
  };

  const doSave = async (changedRows: typeof rows, signature: string) => {
    lastSubmitRef.current = { signature, time: Date.now() };
    dispatchSave({ type: 'save-start' });
    try {
      const payload = changedRows.map(r => ({
        stationCode: r.code,
        fuelAdded: r.added !== '' ? parseFloat(r.added) : null,
        hoursRun: r.hoursRun !== '' ? parseFloat(r.hoursRun) : null,
        recordedDate: r.date,
        notes: r.note || null,
      }));
      const preview = await previewEntry(payload);
      await confirmEntry(preview.jobId);
      dispatchSave({ type: 'save-success' });
    } catch (err) {
      toast.error((err as Error).message || 'Lỗi lưu dữ liệu');
      dispatchSave({ type: 'save-error' });
    }
  };

  const handleSave = async () => {
    const hasErrors = rows.some(r => r.status === 'error');
    if (hasErrors) { toast.error('Còn dòng lỗi, không thể lưu. Hãy sửa hoặc bỏ qua.'); return; }
    const changedRows = rows.filter(r => r.status !== 'unchanged');
    if (changedRows.length === 0) { toast.warning('Không có dòng nào thay đổi'); return; }

    const signature = changedRows.map(r => `${r.stationId}|${r.added}|${r.hoursRun}|${r.date}`).sort().join(',');
    const last = lastSubmitRef.current;
    if (last?.signature === signature && Date.now() - last.time < 60_000) {
      pendingSubmitRef.current = () => doSave(changedRows, signature);
      dispatchSave({ type: 'double-submit-open' });
      return;
    }

    await doSave(changedRows, signature);
  };

  const validRows   = rows.filter(r => r.status === 'valid').length;
  const warningRows = rows.filter(r => r.status === 'warning').length;
  const errorRows   = rows.filter(r => r.status === 'error').length;
  const unchangedRows = rows.filter(r => r.status === 'unchanged').length;
  const hasErrors = rows.some(r => r.status === 'error');

  return (
    <div className="flex flex-col h-full" style={{ height: 'calc(100vh - 60px)' }}>
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b" style={{ background: 'white', borderColor: '#e2e8f0' }}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 style={{ color: '#0f172a' }}>Nhập dữ liệu trực tiếp</h2>
            <p style={{ color: '#64748b', fontSize: '0.8rem' }}>Cập nhật thông tin và nhiên liệu nhiều trạm cùng lúc, giống nhập Excel.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => loadCurrent({ silent: false })} className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors" style={{ borderColor: '#e2e8f0', color: '#475569', fontSize: '0.82rem', background: 'white' }}>
              <RefreshCw size={14} /> Tải dữ liệu hiện tại
            </button>
            <button type="button" onClick={checkData} disabled={rows.length === 0} className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors" style={{ background: '#f0f9ff', color: '#0284c7', fontSize: '0.82rem', border: '1px solid #bae6fd', cursor: rows.length === 0 ? 'not-allowed' : 'pointer' }}>
              <CheckCircle size={14} /> Kiểm tra dữ liệu
            </button>
            <button type="button" onClick={handleSave} disabled={!checked || hasErrors || save.saving || rows.length === 0} className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all" style={{ background: !checked || hasErrors || rows.length === 0 ? '#e2e8f0' : '#16a34a', color: !checked || hasErrors || rows.length === 0 ? '#94a3b8' : 'white', fontSize: '0.82rem', cursor: !checked || hasErrors || rows.length === 0 ? 'not-allowed' : 'pointer' }}>
              <Save size={14} />{save.saving ? 'Đang lưu...' : 'Xác nhận lưu'}
            </button>
            <button
              type="button"
              onClick={() => downloadWithAuth('export/snapshot', 'fuel-snapshot.xlsx').catch(e => toast.error((e as Error).message))}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border"
              style={{ borderColor: '#e2e8f0', color: '#475569', fontSize: '0.82rem', background: 'white' }}
            >
              <Download size={14} /> Export
            </button>
          </div>
        </div>

        {checked && rows.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t" style={{ borderColor: '#f1f5f9' }}>
            {[
              { label: 'Tổng dòng',     value: rows.length,    bg: '#f1f5f9', text: '#475569' },
              { label: 'Hợp lệ',        value: validRows,      bg: '#dcfce7', text: '#16a34a' },
              { label: 'Cảnh báo',      value: warningRows,    bg: '#fef9c3', text: '#ca8a04' },
              { label: 'Lỗi',           value: errorRows,      bg: '#fee2e2', text: '#dc2626' },
              { label: 'Không thay đổi', value: unchangedRows,  bg: '#f8fafc', text: '#64748b' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: s.bg }}>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: s.text }}>{s.value}</span>
                <span style={{ fontSize: '0.75rem', color: s.text }}>{s.label}</span>
              </div>
            ))}
            {hasErrors && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: '#fee2e2', border: '1px solid #fca5a5' }}>
                <AlertTriangle size={13} style={{ color: '#dc2626' }} />
                <span style={{ fontSize: '0.75rem', color: '#b91c1c', fontWeight: 600 }}>Còn lỗi — không thể lưu</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Rules */}
      <div className="flex-shrink-0 px-6 py-2 flex flex-wrap gap-4" style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
        {RULES.map(rule => (
          <span key={rule} className="flex items-center gap-1" style={{ fontSize: '0.75rem', color: '#92400e' }}>
            <span style={{ color: '#ca8a04' }}>•</span> {rule}
          </span>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto" style={{ background: '#f1f5f9' }}>
        <DirectEntryTable
          rows={rows}
          onUpdateRow={updateRow}
          onRemoveRow={removeRow}
          onRevertRow={revertRow}
          onLoadCurrent={() => loadCurrent({ silent: false })}
        />
      </div>

      {/* Double-submit confirm dialog */}
      <Dialog.Root open={save.doubleSubmitOpen} onOpenChange={open => !open && dispatchSave({ type: 'double-submit-close' })}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.5)' }} />
          <Dialog.Content aria-describedby={undefined} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 rounded-2xl p-6 w-full max-w-sm" style={{ background: 'white', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <Dialog.Title style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a', marginBottom: '8px' }}>Xác nhận gửi lại?</Dialog.Title>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '20px' }}>
              Dữ liệu này vừa được gửi trong vòng 60 giây qua. Bạn có chắc muốn tạo thêm một phát sinh mới?
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => dispatchSave({ type: 'double-submit-close' })} className="flex-1 py-2.5 rounded-lg border" style={{ borderColor: '#e2e8f0', color: '#475569', fontSize: '0.875rem' }}>
                Hủy
              </button>
              <button type="button" onClick={() => { dispatchSave({ type: 'double-submit-close' }); pendingSubmitRef.current?.(); }} className="flex-1 py-2.5 rounded-lg" style={{ background: '#dc2626', color: 'white', fontSize: '0.875rem', fontWeight: 600 }}>
                Vẫn gửi
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Success Modal */}
      <Dialog.Root open={save.successOpen} onOpenChange={open => !open && dispatchSave({ type: 'close-success' })}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.5)' }} />
          <Dialog.Content aria-describedby={undefined} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 rounded-2xl p-8 w-full max-w-sm text-center" style={{ background: 'white', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <Dialog.Title className="sr-only">Lưu thành công</Dialog.Title>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#dcfce7' }}>
              <Check size={28} style={{ color: '#16a34a' }} />
            </div>
            <h3 className="mb-2" style={{ color: '#0f172a' }}>Lưu thành công!</h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '20px' }}>Dữ liệu đã được ghi nhận vào hệ thống.</p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              {[
                { label: 'Trạm cập nhật', value: validRows + warningRows, color: '#16a34a' },
                { label: 'Dòng NL',       value: rows.filter(r => r.added || r.hoursRun).length, color: '#7c3aed' },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-3" style={{ background: '#f8fafc' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => { dispatchSave({ type: 'close-success' }); setRows([]); setChecked(false); }} className="flex-1 py-2.5 rounded-lg border" style={{ borderColor: '#e2e8f0', color: '#475569', fontSize: '0.875rem' }}>
                Tiếp tục nhập
              </button>
              <button type="button" onClick={() => { dispatchSave({ type: 'close-success' }); onNavigateToDashboard(); }} className="flex-1 py-2.5 rounded-lg" style={{ background: '#2563eb', color: 'white', fontSize: '0.875rem', fontWeight: 600 }}>
                Về Dashboard
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
