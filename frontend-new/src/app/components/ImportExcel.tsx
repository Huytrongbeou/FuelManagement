import { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Download, CheckCircle, AlertTriangle, XCircle, ArrowLeft, ArrowRight, Check, Info } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';
import { uploadExcel, confirmJob, getTemplateUrl, getSnapshotUrl } from '../api/importApi';

type RowStatus = 'valid' | 'warning' | 'error';

interface PreviewRow {
  code: string;
  name: string;
  added: number | string;
  hoursRun: number | string;
  actualFuel: number | string;
  calculated: number | string;
  status: RowStatus;
  message?: string;
}

interface ImportExcelProps {
  onNavigateToHistory: () => void;
  onNavigateToDashboard: () => void;
}

export function ImportExcel({ onNavigateToHistory, onNavigateToDashboard }: ImportExcelProps) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [jobSummary, setJobSummary] = useState({ totalRows: 0, validRows: 0, warningRows: 0, errorRows: 0 });
  const fileRef = useRef<HTMLInputElement>(null);

  const validRows   = previewRows.filter(r => r.status === 'valid').length;
  const warningRows = previewRows.filter(r => r.status === 'warning').length;
  const errorRows   = previewRows.filter(r => r.status === 'error').length;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith('.xlsx')) { setFile(f); }
    else toast.error('Chỉ chấp nhận file .xlsx');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const job = await uploadExcel(file) as Record<string, unknown>;
      setJobId(job.id as string);
      // job.previewData is the array of parsed rows (each has errors/warnings arrays)
      const rawRows = (job.previewData as Record<string, unknown>[]) ?? [];
      const rows: PreviewRow[] = rawRows.map(r => {
        const errors = (r.errors as string[]) ?? [];
        const warnings = (r.warnings as string[]) ?? [];
        const status: RowStatus = errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'valid';
        return {
          code: (r.stationCode as string) ?? '',
          name: (r.stationName as string) ?? '',
          added: r.fuelAdded != null ? Number(r.fuelAdded) : '',
          hoursRun: r.hoursRun != null ? Number(r.hoursRun) : '',
          actualFuel: r.actualFuel != null ? Number(r.actualFuel) : '',
          calculated: r.fuelCalculated != null ? Number(r.fuelCalculated) : '',
          status,
          message: errors[0] ?? warnings[0] ?? undefined,
        };
      });
      setPreviewRows(rows);
      setJobSummary({
        totalRows: (job.totalRows as number) ?? rows.length,
        validRows: (job.validRows as number) ?? rows.filter(r => r.status !== 'error').length,
        warningRows: (job.warningRows as number) ?? rows.filter(r => r.status === 'warning').length,
        errorRows: (job.invalidRows as number) ?? rows.filter(r => r.status === 'error').length,
      });
      setStep(2);
    } catch (err) {
      toast.error((err as Error).message || 'Lỗi upload file');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (!jobId) return;
    setConfirming(true);
    try {
      await confirmJob(jobId);
      setShowSuccessModal(true);
    } catch (err) {
      toast.error((err as Error).message || 'Lỗi xác nhận import');
    } finally {
      setConfirming(false);
    }
  };

  const steps = [
    { n: 1, label: 'Upload file' },
    { n: 2, label: 'Preview dữ liệu' },
    { n: 3, label: 'Xác nhận import' },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 style={{ color: '#0f172a' }}>Import Excel</h2>
        <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Nhập dữ liệu nhiên liệu từ file Excel tổng</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {steps.map((s, i) => (
          <div key={s.n} className="flex items-center flex-1">
            <div className="flex items-center gap-2 flex-shrink-0">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                style={{
                  background: step > s.n ? '#16a34a' : step === s.n ? '#2563eb' : '#e2e8f0',
                  color: step >= s.n ? 'white' : '#94a3b8',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                }}
              >
                {step > s.n ? <Check size={14} /> : s.n}
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: step === s.n ? 600 : 400, color: step === s.n ? '#0f172a' : '#94a3b8', whiteSpace: 'nowrap' }}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div className="flex-1 h-px mx-3" style={{ background: step > s.n ? '#16a34a' : '#e2e8f0' }} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Upload area */}
              <div className="lg:col-span-2 space-y-4">
                <div
                  className="rounded-xl border-2 border-dashed p-10 text-center transition-all cursor-pointer"
                  style={{
                    borderColor: dragging ? '#2563eb' : '#e2e8f0',
                    background: dragging ? '#eff6ff' : file ? '#f0fdf4' : 'white',
                  }}
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileRef.current?.click()}
                >
                  <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={handleFileChange} />
                  {file ? (
                    <div>
                      <div className="w-14 h-14 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ background: '#dcfce7' }}>
                        <FileSpreadsheet size={28} style={{ color: '#16a34a' }} />
                      </div>
                      <div style={{ fontWeight: 600, color: '#16a34a', fontSize: '1rem' }}>{file.name}</div>
                      <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '4px' }}>
                        {(file.size / 1024).toFixed(1)} KB — Click để chọn lại
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="w-14 h-14 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ background: dragging ? '#dbeafe' : '#f1f5f9' }}>
                        <Upload size={28} style={{ color: dragging ? '#2563eb' : '#94a3b8' }} />
                      </div>
                      <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '1rem' }}>Kéo và thả file Excel vào đây</div>
                      <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px' }}>hoặc click để chọn file</div>
                      <div style={{ color: '#94a3b8', fontSize: '0.78rem', marginTop: '12px' }}>Chỉ chấp nhận file .xlsx</div>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex gap-3">
                  <a
                    href={getTemplateUrl()}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors"
                    style={{ borderColor: '#e2e8f0', color: '#475569', fontSize: '0.875rem', background: 'white', textDecoration: 'none' }}
                  >
                    <Download size={16} /> Tải file mẫu
                  </a>
                  <a
                    href={getSnapshotUrl()}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors"
                    style={{ borderColor: '#e2e8f0', color: '#475569', fontSize: '0.875rem', background: 'white', textDecoration: 'none' }}
                  >
                    <Download size={16} /> Export file tổng hiện tại
                  </a>
                </div>
              </div>

              {/* Instructions */}
              <div className="rounded-xl border p-5" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
                <div className="flex items-center gap-2 mb-3">
                  <Info size={16} style={{ color: '#ca8a04' }} />
                  <span style={{ fontWeight: 600, color: '#92400e', fontSize: '0.875rem' }}>Hướng dẫn</span>
                </div>
                <ul className="space-y-2.5">
                  {[
                    'Ô trống có nghĩa là không cập nhật cho trạm đó.',
                    'Số 0 là giá trị hợp lệ (không chạy máy).',
                    'Các cột hệ thống (U-AB) không cần sửa.',
                    'Nhiên liệu tồn thực tế ưu tiên hơn tính toán.',
                    'Chênh lệch ± 2L được coi là cảnh báo.',
                  ].map((item, i) => (
                    <li key={i} className="flex items-start gap-2" style={{ fontSize: '0.8rem', color: '#92400e' }}>
                      <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#ca8a04' }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                disabled={!file || uploading}
                onClick={handleUpload}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg transition-all"
                style={{ background: file && !uploading ? '#2563eb' : '#e2e8f0', color: file && !uploading ? 'white' : '#94a3b8', fontSize: '0.875rem', fontWeight: 600, cursor: file && !uploading ? 'pointer' : 'not-allowed' }}
              >
                {uploading ? 'Đang tải lên...' : 'Tiếp theo'} <ArrowRight size={16} />
              </button>
            </div>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Tổng dòng',    value: jobSummary.totalRows || previewRows.length, bg: '#f1f5f9', text: '#475569', icon: FileSpreadsheet },
                { label: 'Dòng hợp lệ', value: jobSummary.validRows || validRows,   bg: '#dcfce7', text: '#16a34a', icon: CheckCircle },
                { label: 'Dòng cảnh báo',value: jobSummary.warningRows || warningRows, bg: '#fef9c3', text: '#ca8a04', icon: AlertTriangle },
                { label: 'Dòng lỗi',    value: jobSummary.errorRows || errorRows,   bg: '#fee2e2', text: '#dc2626', icon: XCircle },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-4 border" style={{ background: s.bg, borderColor: s.text + '30' }}>
                  <div style={{ fontSize: '1.8rem', fontWeight: 700, color: s.text, lineHeight: 1 }}>{s.value}</div>
                  <div style={{ fontSize: '0.8rem', color: s.text + 'cc', marginTop: '4px' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Preview table */}
            <div className="rounded-xl border overflow-hidden" style={{ background: 'white', borderColor: '#e2e8f0' }}>
              <div className="px-4 py-3 border-b" style={{ borderColor: '#f1f5f9', background: '#f8fafc' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Preview dữ liệu — {file?.name}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full" style={{ borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Mã trạm', 'Tên trạm', 'NL bổ sung', 'Số giờ chạy', 'NL tồn thực', 'Tồn sau tính', 'Trạng thái', 'Ghi chú'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left border-b" style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, borderColor: '#e2e8f0', whiteSpace: 'nowrap', background: '#f8fafc' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => {
                      const rowBg = row.status === 'valid' ? (i % 2 === 0 ? 'white' : '#f9fafb') : row.status === 'warning' ? '#fffbeb' : '#fff5f5';
                      return (
                        <tr key={i} style={{ background: rowBg }}>
                          <td className="px-4 py-2.5 border-b" style={{ borderColor: '#f1f5f9', fontFamily: 'monospace', fontSize: '0.8rem', color: '#475569' }}>{row.code}</td>
                          <td className="px-4 py-2.5 border-b" style={{ borderColor: '#f1f5f9', fontSize: '0.8rem', color: '#1e293b', whiteSpace: 'nowrap' }}>{row.name}</td>
                          <td className="px-4 py-2.5 border-b" style={{ borderColor: '#f1f5f9', fontSize: '0.8rem', color: '#64748b' }}>{row.added !== '' ? `${row.added} L` : '—'}</td>
                          <td className="px-4 py-2.5 border-b" style={{ borderColor: '#f1f5f9', fontSize: '0.8rem', color: '#64748b' }}>{row.hoursRun !== '' ? `${row.hoursRun}h` : '—'}</td>
                          <td className="px-4 py-2.5 border-b" style={{ borderColor: '#f1f5f9', fontSize: '0.8rem', color: '#64748b' }}>{row.actualFuel !== '' ? `${row.actualFuel} L` : '—'}</td>
                          <td className="px-4 py-2.5 border-b" style={{ borderColor: '#f1f5f9', fontSize: '0.8rem', fontWeight: 500, color: '#475569' }}>{row.calculated !== '' ? `${row.calculated} L` : '—'}</td>
                          <td className="px-4 py-2.5 border-b" style={{ borderColor: '#f1f5f9' }}>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full" style={{
                              fontSize: '0.72rem', fontWeight: 600,
                              background: row.status === 'valid' ? '#dcfce7' : row.status === 'warning' ? '#fef9c3' : '#fee2e2',
                              color: row.status === 'valid' ? '#16a34a' : row.status === 'warning' ? '#ca8a04' : '#dc2626',
                            }}>
                              {row.status === 'valid' ? <CheckCircle size={10} /> : row.status === 'warning' ? <AlertTriangle size={10} /> : <XCircle size={10} />}
                              {row.status === 'valid' ? 'Hợp lệ' : row.status === 'warning' ? 'Cảnh báo' : 'Lỗi'}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 border-b" style={{ borderColor: '#f1f5f9', fontSize: '0.75rem', color: row.status === 'error' ? '#dc2626' : '#ca8a04', maxWidth: '180px' }}>
                            {row.message ?? ''}
                          </td>
                        </tr>
                      );
                    })}
                    {previewRows.length === 0 && (
                      <tr><td colSpan={8} className="px-4 py-8 text-center" style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Không có dữ liệu preview</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors"
                style={{ borderColor: '#e2e8f0', color: '#475569', fontSize: '0.875rem', background: 'white' }}
              >
                <ArrowLeft size={16} /> Quay lại
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg transition-all"
                style={{ background: '#2563eb', color: 'white', fontSize: '0.875rem', fontWeight: 600 }}
              >
                Tiếp theo <ArrowRight size={16} />
              </button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div className="max-w-xl mx-auto space-y-5">
              <div className="rounded-xl border p-6" style={{ background: 'white', borderColor: '#e2e8f0' }}>
                <h4 className="mb-4" style={{ color: '#0f172a' }}>Tóm tắt trước khi xác nhận</h4>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b" style={{ borderColor: '#f1f5f9' }}>
                    <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Tên file</span>
                    <span style={{ color: '#1e293b', fontSize: '0.875rem', fontWeight: 500 }}>{file?.name}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b" style={{ borderColor: '#f1f5f9' }}>
                    <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Tổng dòng</span>
                    <span style={{ color: '#1e293b', fontWeight: 600 }}>{jobSummary.totalRows || previewRows.length}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b" style={{ borderColor: '#f1f5f9' }}>
                    <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Dòng hợp lệ sẽ import</span>
                    <span style={{ color: '#16a34a', fontWeight: 600 }}>{jobSummary.validRows || validRows}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b" style={{ borderColor: '#f1f5f9' }}>
                    <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Dòng cảnh báo (sẽ import)</span>
                    <span style={{ color: '#ca8a04', fontWeight: 600 }}>{jobSummary.warningRows || warningRows}</span>
                  </div>
                  <div className="flex justify-between py-2" style={{ borderColor: '#f1f5f9' }}>
                    <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Dòng lỗi (sẽ bỏ qua)</span>
                    <span style={{ color: '#dc2626', fontWeight: 600 }}>{jobSummary.errorRows || errorRows}</span>
                  </div>
                </div>

                {(jobSummary.errorRows || errorRows) > 0 && (
                  <div className="mt-4 rounded-lg p-3 flex items-start gap-2" style={{ background: '#fff5f5', border: '1px solid #fca5a5' }}>
                    <AlertTriangle size={15} style={{ color: '#dc2626', flexShrink: 0, marginTop: '1px' }} />
                    <span style={{ fontSize: '0.8rem', color: '#b91c1c' }}>
                      {jobSummary.errorRows || errorRows} dòng lỗi sẽ bị bỏ qua. Các trạm tương ứng sẽ không được cập nhật.
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(2)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors flex-1 justify-center"
                  style={{ borderColor: '#e2e8f0', color: '#475569', fontSize: '0.875rem', background: 'white' }}
                >
                  <ArrowLeft size={16} /> Quay lại sửa file
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={confirming}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg transition-all flex-1 justify-center"
                  style={{ background: confirming ? '#86efac' : '#16a34a', color: 'white', fontSize: '0.875rem', fontWeight: 600, cursor: confirming ? 'not-allowed' : 'pointer' }}
                >
                  <Check size={16} /> {confirming ? 'Đang xử lý...' : 'Xác nhận import'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      <Dialog.Root open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.5)' }} />
          <Dialog.Content aria-describedby={undefined} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 rounded-2xl p-8 w-full max-w-md text-center" style={{ background: 'white', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <Dialog.Title className="sr-only">Kết quả import</Dialog.Title>
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: '#dcfce7' }}>
              <CheckCircle size={32} style={{ color: '#16a34a' }} />
            </div>
            <h3 className="mb-2" style={{ color: '#0f172a' }}>Import thành công!</h3>
            <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '20px' }}>Dữ liệu đã được cập nhật vào hệ thống.</p>
            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { label: 'Trạm cập nhật', value: (jobSummary.validRows || validRows) + (jobSummary.warningRows || warningRows), color: '#16a34a' },
                { label: 'Dòng cảnh báo', value: jobSummary.warningRows || warningRows, color: '#ca8a04' },
                { label: 'Dòng lỗi bỏ qua', value: jobSummary.errorRows || errorRows, color: '#dc2626' },
              ].map(s => (
                <div key={s.label} className="rounded-xl p-3" style={{ background: '#f8fafc' }}>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowSuccessModal(false); onNavigateToHistory(); }}
                className="flex-1 py-2.5 rounded-lg border transition-colors"
                style={{ borderColor: '#e2e8f0', color: '#475569', fontSize: '0.875rem' }}
              >
                Xem lịch sử
              </button>
              <button
                onClick={() => { setShowSuccessModal(false); onNavigateToDashboard(); }}
                className="flex-1 py-2.5 rounded-lg transition-all"
                style={{ background: '#2563eb', color: 'white', fontSize: '0.875rem', fontWeight: 600 }}
              >
                Về Dashboard
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
