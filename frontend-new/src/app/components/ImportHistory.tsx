import { useState } from 'react';
import { Eye, CheckCircle, XCircle, AlertTriangle, Clock, FileSpreadsheet, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { ImportSession } from '../types';

interface ImportHistoryProps {
  sessions: ImportSession[];
}

const statusConfig = {
  committed:  { label: 'Thành công',   bg: '#dcfce7', text: '#16a34a', icon: CheckCircle },
  failed:     { label: 'Thất bại',     bg: '#fee2e2', text: '#dc2626', icon: XCircle },
  previewing: { label: 'Đang xem',     bg: '#eff6ff', text: '#2563eb', icon: Clock },
  cancelled:  { label: 'Đã hủy',       bg: '#f8fafc', text: '#64748b', icon: XCircle },
};

const mockErrors = [
  { row: 8,  code: 'STXXX', field: 'Mã trạm',           message: 'Mã trạm không tồn tại trong hệ thống' },
  { row: 10, code: 'ST011', field: 'Nhiên liệu tồn',    message: 'Giá trị âm không hợp lệ: -5' },
];

const mockWarnings = [
  { row: 3,  code: 'ST003', field: 'Chênh lệch',  message: 'Chênh lệch -2L so với tính toán' },
  { row: 5,  code: 'ST006', field: 'Số giờ chạy', message: 'Số giờ chạy cao bất thường: 22h' },
];

const affectedStations = ['ST001','ST002','ST003','ST004','ST005','ST006','ST007','ST009','ST012'];

export function ImportHistory({ sessions }: ImportHistoryProps) {
  const [selected, setSelected] = useState<ImportSession | null>(null);

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div>
        <h2 style={{ color: '#0f172a' }}>Lịch sử import</h2>
        <p style={{ color: '#64748b', fontSize: '0.875rem' }}>{sessions.length} lần import</p>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ background: 'white', borderColor: '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Mã lần import', 'Tên file', 'Người import', 'Thời gian', 'Tổng', 'Hợp lệ', 'Cảnh báo', 'Lỗi', 'Trạng thái', 'Hành động'].map(h => (
                  <th key={h} className="px-4 py-3 text-left border-b" style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, borderColor: '#e2e8f0', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((s, i) => {
                const cfg = statusConfig[s.status];
                const Icon = cfg.icon;
                return (
                  <tr key={s.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f0f7ff'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'white' : '#fafafa'}
                  >
                    <td className="px-4 py-3 border-b" style={{ borderColor: '#f1f5f9', fontFamily: 'monospace', fontSize: '0.8rem', color: '#64748b' }}>
                      {s.id}
                    </td>
                    <td className="px-4 py-3 border-b" style={{ borderColor: '#f1f5f9' }}>
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet size={14} style={{ color: '#16a34a', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.8rem', color: '#1e293b', whiteSpace: 'nowrap' }}>{s.filename}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 border-b" style={{ borderColor: '#f1f5f9', fontSize: '0.8rem', color: '#475569', whiteSpace: 'nowrap' }}>
                      {s.importedBy}
                    </td>
                    <td className="px-4 py-3 border-b" style={{ borderColor: '#f1f5f9', fontSize: '0.8rem', color: '#64748b', whiteSpace: 'nowrap' }}>
                      {s.importedAt}
                    </td>
                    <td className="px-4 py-3 border-b" style={{ borderColor: '#f1f5f9', fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>
                      {s.totalRows}
                    </td>
                    <td className="px-4 py-3 border-b" style={{ borderColor: '#f1f5f9', fontSize: '0.875rem', fontWeight: 600, color: '#16a34a' }}>
                      {s.validRows}
                    </td>
                    <td className="px-4 py-3 border-b" style={{ borderColor: '#f1f5f9', fontSize: '0.875rem', fontWeight: 600, color: '#ca8a04' }}>
                      {s.warningRows}
                    </td>
                    <td className="px-4 py-3 border-b" style={{ borderColor: '#f1f5f9', fontSize: '0.875rem', fontWeight: 600, color: '#dc2626' }}>
                      {s.errorRows}
                    </td>
                    <td className="px-4 py-3 border-b" style={{ borderColor: '#f1f5f9' }}>
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: cfg.bg, color: cfg.text, fontSize: '0.75rem', fontWeight: 600 }}>
                        <Icon size={12} />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 border-b" style={{ borderColor: '#f1f5f9' }}>
                      <button
                        onClick={() => setSelected(s)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors"
                        style={{ background: '#eff6ff', color: '#2563eb', fontSize: '0.78rem', fontWeight: 500 }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#dbeafe'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#eff6ff'}
                      >
                        <Eye size={13} /> Chi tiết
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Dialog */}
      <Dialog.Root open={!!selected} onOpenChange={open => !open && setSelected(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.5)' }} />
          <Dialog.Content aria-describedby={undefined} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" style={{ background: 'white', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            {selected && (() => {
              const cfg = statusConfig[selected.status];
              return (
                <div>
                  <Dialog.Title className="sr-only">Chi tiết import: {selected.filename}</Dialog.Title>
                  <div className="flex items-start justify-between p-6 border-b" style={{ borderColor: '#f1f5f9' }}>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <FileSpreadsheet size={18} style={{ color: '#16a34a' }} />
                        <h3 style={{ color: '#0f172a' }}>{selected.filename}</h3>
                      </div>
                      <div style={{ color: '#64748b', fontSize: '0.8rem' }}>
                        Import bởi {selected.importedBy} lúc {selected.importedAt}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full" style={{ background: cfg.bg, color: cfg.text, fontSize: '0.8rem', fontWeight: 600 }}>
                        {cfg.label}
                      </span>
                      <Dialog.Close asChild>
                        <button style={{ color: '#94a3b8' }}><X size={20} /></button>
                      </Dialog.Close>
                    </div>
                  </div>
                  <div className="p-6 space-y-5">
                    {/* Summary */}
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { label: 'Tổng dòng',    value: selected.totalRows,   color: '#475569', bg: '#f1f5f9' },
                        { label: 'Hợp lệ',       value: selected.validRows,   color: '#16a34a', bg: '#dcfce7' },
                        { label: 'Cảnh báo',     value: selected.warningRows, color: '#ca8a04', bg: '#fef9c3' },
                        { label: 'Lỗi',          value: selected.errorRows,   color: '#dc2626', bg: '#fee2e2' },
                      ].map(s => (
                        <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: s.bg }}>
                          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                          <div style={{ fontSize: '0.72rem', color: s.color + 'cc' }}>{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Errors */}
                    {mockErrors.length > 0 && (
                      <div>
                        <h4 className="mb-3 flex items-center gap-2" style={{ color: '#dc2626' }}>
                          <XCircle size={16} /> Danh sách lỗi
                        </h4>
                        <div className="space-y-2">
                          {mockErrors.map((e, i) => (
                            <div key={i} className="rounded-lg px-4 py-3 flex items-start gap-3" style={{ background: '#fff5f5', border: '1px solid #fca5a5' }}>
                              <span style={{ color: '#dc2626', fontWeight: 600, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>Dòng {e.row}</span>
                              <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#64748b', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>{e.code}</span>
                              <span style={{ fontSize: '0.8rem', color: '#b91c1c' }}>{e.message}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Warnings */}
                    {mockWarnings.length > 0 && (
                      <div>
                        <h4 className="mb-3 flex items-center gap-2" style={{ color: '#ca8a04' }}>
                          <AlertTriangle size={16} /> Cảnh báo
                        </h4>
                        <div className="space-y-2">
                          {mockWarnings.map((w, i) => (
                            <div key={i} className="rounded-lg px-4 py-3 flex items-start gap-3" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                              <span style={{ color: '#ca8a04', fontWeight: 600, fontSize: '0.78rem', whiteSpace: 'nowrap' }}>Dòng {w.row}</span>
                              <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#64748b', background: '#f1f5f9', padding: '1px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>{w.code}</span>
                              <span style={{ fontSize: '0.8rem', color: '#92400e' }}>{w.message}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Affected stations */}
                    <div>
                      <h4 className="mb-3" style={{ color: '#0f172a' }}>Trạm được cập nhật ({affectedStations.length})</h4>
                      <div className="flex flex-wrap gap-2">
                        {affectedStations.map(code => (
                          <span key={code} className="px-2.5 py-1 rounded-lg" style={{ background: '#eff6ff', color: '#2563eb', fontSize: '0.78rem', fontFamily: 'monospace', fontWeight: 600 }}>
                            {code}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
