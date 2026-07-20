import { RotateCcw, Trash2 } from 'lucide-react';
import type { EntryRow } from '../lib/entryRow';
import { rowBg, statusBadge, fmt } from '../lib/entryRow';

interface MobileEntryCardProps {
  row: EntryRow;
  onUpdateRow: (id: string, field: string, value: string) => void;
  onRemoveRow: (id: string) => void;
  onRevertRow: (id: string) => void;
}

export function MobileEntryCard({ row, onUpdateRow, onRemoveRow, onRevertRow }: MobileEntryCardProps) {
  const noFuelData = row.prevFuel === null;

  return (
    <div data-testid={`direct-entry-card-${row.code}`} className="rounded-xl border p-4 space-y-3" style={{ background: rowBg(row.status, 0), borderColor: '#e2e8f0' }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-sm" style={{ color: '#1e293b' }}>{row.code}</p>
          <p className="text-xs mt-0.5" style={{ color: '#64748b' }}>{row.name}</p>
        </div>
        {statusBadge(row.status)}
      </div>

      {/* Inputs */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`entry-added-${row.id}`} className="block mb-1 text-xs" style={{ color: '#64748b' }}>NL bổ sung (L)</label>
          <input
            id={`entry-added-${row.id}`}
            data-testid={`fuel-added-input-mobile-${row.code}`}
            aria-label={`NL bổ sung — ${row.name}`}
            type="number" min={0}
            value={row.added}
            onChange={e => onUpdateRow(row.id, 'added', e.target.value)}
            placeholder="0"
            disabled={noFuelData}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: '#e2e8f0', background: noFuelData ? '#f8fafc' : 'white', opacity: noFuelData ? 0.5 : 1 }}
          />
        </div>
        <div>
          <label htmlFor={`entry-hours-${row.id}`} className="block mb-1 text-xs" style={{ color: '#64748b' }}>Số giờ chạy</label>
          <input
            id={`entry-hours-${row.id}`}
            data-testid={`hours-run-input-mobile-${row.code}`}
            aria-label={`Số giờ chạy — ${row.name}`}
            type="number" min={0}
            value={row.hoursRun}
            onChange={e => onUpdateRow(row.id, 'hoursRun', e.target.value)}
            placeholder="0"
            disabled={noFuelData}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: '#e2e8f0', background: noFuelData ? '#f8fafc' : 'white', opacity: noFuelData ? 0.5 : 1 }}
          />
        </div>
        <div>
          <label htmlFor={`entry-date-${row.id}`} className="block mb-1 text-xs" style={{ color: '#64748b' }}>Ngày ghi nhận</label>
          <input
            id={`entry-date-${row.id}`}
            aria-label={`Ngày ghi nhận — ${row.name}`}
            type="date"
            value={row.date}
            onChange={e => onUpdateRow(row.id, 'date', e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: '#e2e8f0', background: 'white' }}
          />
        </div>
        <div>
          <label htmlFor={`entry-note-${row.id}`} className="block mb-1 text-xs" style={{ color: '#64748b' }}>Ghi chú</label>
          <input
            id={`entry-note-${row.id}`}
            aria-label={`Ghi chú — ${row.name}`}
            type="text"
            value={row.note}
            onChange={e => onUpdateRow(row.id, 'note', e.target.value)}
            placeholder="Tùy chọn"
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: '#e2e8f0', background: 'white' }}
          />
        </div>
      </div>

      {/* Calculated values */}
      <div className="grid grid-cols-3 gap-2 rounded-lg p-2" style={{ background: '#f8fafc' }}>
        <div className="text-center">
          <p className="text-xs" style={{ color: '#94a3b8' }}>Tồn trước</p>
          <p className="text-sm font-medium font-mono" style={{ color: '#475569' }}>{fmt(row.prevFuel)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs" style={{ color: '#94a3b8' }}>Tiêu hao</p>
          <p className="text-sm font-medium font-mono" style={{ color: '#475569' }}>{fmt(row.consumed)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs" style={{ color: '#94a3b8' }}>Tồn cuối</p>
          <p className="text-sm font-semibold font-mono" style={{ color: row.finalFuel !== null && row.finalFuel < 0 ? '#dc2626' : '#1e293b' }}>{fmt(row.finalFuel)}</p>
        </div>
      </div>

      {/* Error message */}
      {row.errorMsg && (
        <p className="text-xs" style={{ color: row.status === 'error' ? '#dc2626' : '#ca8a04' }}>
          {row.errorMsg}
        </p>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => onRevertRow(row.id)}
          title="Hoàn tác"
          className="p-2 rounded-lg"
          style={{ color: '#94a3b8', background: 'transparent' }}
          onTouchStart={e => (e.currentTarget as HTMLElement).style.background = '#f1f5f9'}
          onTouchEnd={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
        >
          <RotateCcw size={14} />
        </button>
        <button
          type="button"
          onClick={() => onRemoveRow(row.id)}
          title="Bỏ khỏi lần nhập"
          className="p-2 rounded-lg"
          style={{ color: '#94a3b8', background: 'transparent' }}
          onTouchStart={e => { (e.currentTarget as HTMLElement).style.background = '#fee2e2'; (e.currentTarget as HTMLElement).style.color = '#dc2626'; }}
          onTouchEnd={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#94a3b8'; }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
