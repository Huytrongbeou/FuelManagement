import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

export type RowStatus = 'unchanged' | 'valid' | 'warning' | 'error';

export interface EntryRow {
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

export function fmt(n: number | null, suffix = 'L') {
  return n !== null ? `${n.toFixed(1)} ${suffix}` : '—';
}

export function rowBg(status: RowStatus, i: number) {
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

export function statusBadge(status: RowStatus) {
  const cfg = STATUS_BADGE_CFG[status];
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: cfg.bg, color: cfg.text, fontSize: '0.75rem', fontWeight: 600 }}>
      {Icon && <Icon size={10} />}{cfg.label}
    </span>
  );
}
