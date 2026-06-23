import { useState, useRef, useReducer } from 'react';
import { Upload, FileSpreadsheet, Download, CheckCircle, AlertTriangle, XCircle, ArrowLeft, ArrowRight, Check, Info } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { LazyMotion, m, AnimatePresence, domAnimation } from 'motion/react';
import { uploadExcel, confirmJob } from '../api/importApi';
import { downloadWithAuth } from '@/shared/api/client';

type RowStatus = 'valid' | 'warning' | 'error';

interface PreviewRow {
  code: string;
  name: string;
  added: number | string;
  hoursRun: number | string;
  calculated: number | string;
  status: RowStatus;
  message?: string;
}

interface ImportExcelProps {
  onNavigateToHistory: () => void;
  onNavigateToDashboard: () => void;
}

const STEPS = [
  { n: 1, label: 'Upload file' },
  { n: 2, label: 'Preview dữ liệu' },
  { n: 3, label: 'Xác nhận import' },
];

type JobSummary = { totalRows: number; validRows: number; warningRows: number; errorRows: number };
type SignatureWarning = { importedAt: string; importedBy: string | null; filename: string } | null;

type ImportState = {
  step: 1 | 2 | 3;
  file: File | null;
  uploading: boolean;
  confirming: boolean;
  previewRows: PreviewRow[];
  jobSummary: JobSummary;
  signatureWarning: SignatureWarning;
  warningAcknowledged: boolean;
  showSuccessModal: boolean;
};

type ImportAction =
  | { type: 'select-file'; file: File }
  | { type: 'upload-start' }
  | { type: 'upload-success'; previewRows: PreviewRow[]; jobSummary: JobSummary; signatureWarning: SignatureWarning }
  | { type: 'upload-error' }
  | { type: 'go-step'; step: 1 | 2 | 3 }
  | { type: 'acknowledge-warning'; checked: boolean }
  | { type: 'confirm-start' }
  | { type: 'confirm-success' }
  | { type: 'confirm-error' }
  | { type: 'close-modal' };

const IMPORT_INITIAL: ImportState = {
  step: 1,
  file: null,
  uploading: false,
  confirming: false,
  previewRows: [],
  jobSummary: { totalRows: 0, validRows: 0, warningRows: 0, errorRows: 0 },
  signatureWarning: null,
  warningAcknowledged: false,
  showSuccessModal: false,
};

function importReducer(state: ImportState, action: ImportAction): ImportState {
  switch (action.type) {
    case 'select-file':         return { ...state, file: action.file };
    case 'upload-start':        return { ...state, uploading: true, warningAcknowledged: false, signatureWarning: null };
    case 'upload-success':      return { ...state, uploading: false, step: 2, previewRows: action.previewRows, jobSummary: action.jobSummary, signatureWarning: action.signatureWarning };
    case 'upload-error':        return { ...state, uploading: false };
    case 'go-step':             return { ...state, step: action.step };
    case 'acknowledge-warning': return { ...state, warningAcknowledged: action.checked };
    case 'confirm-start':       return { ...state, confirming: true };
    case 'confirm-success':     return { ...state, confirming: false, showSuccessModal: true };
    case 'confirm-error':       return { ...state, confirming: false };
    case 'close-modal':         return { ...state, showSuccessModal: false };
    default:                    return state;
  }
}

// ── Step sub-components ───────────────────────────────────────────────────────

interface Step1Props {
  file: File | null;
  dragging: boolean;
  uploading: boolean;
  fileRef: React.RefObject<HTMLInputElement | null>;
  setDragging: (v: boolean) => void;
  onDrop: (e: React.DragEvent) => void;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUpload: () => void;
}

function ImportStep1Panel({ file, dragging, uploading, fileRef, setDragging, onDrop, onFileChange, onUpload }: Step1Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={onFileChange} aria-label="Chọn file Excel (.xlsx)" />
        <button
          type="button"
          aria-label="Khu vực tải file — kéo thả hoặc nhấn để chọn file Excel"
          className="w-full rounded-xl border-2 border-dashed p-10 text-center transition-all cursor-pointer"
          style={{ borderColor: dragging ? '#2563eb' : '#e2e8f0', background: dragging ? '#eff6ff' : file ? '#f0fdf4' : 'white' }}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
        >
          {file ? (
            <div>
              <div className="w-14 h-14 rounded-xl mx-auto mb-3 flex items-center justify-center" style={{ background: '#dcfce7' }}>
                <FileSpreadsheet size={28} style={{ color: '#16a34a' }} />
              </div>
              <div style={{ fontWeight: 600, color: '#16a34a', fontSize: '1rem' }}>{file.name}</div>
              <div style={{ color: '#64748b', fontSize: '0.8rem', marginTop: '4px' }}>{(file.size / 1024).toFixed(1)} KB — Click để chọn lại</div>
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
        </button>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => downloadWithAuth('export/template', 'import-template.xlsx').catch(e => toast.error((e as Error).message))}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors"
            style={{ borderColor: '#e2e8f0', color: '#475569', fontSize: '0.875rem', background: 'white' }}
          >
            <Download size={16} /> Tải file mẫu
          </button>
          <button
            type="button"
            onClick={() => downloadWithAuth('export/snapshot', 'fuel-snapshot.xlsx').catch(e => toast.error((e as Error).message))}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors"
            style={{ borderColor: '#e2e8f0', color: '#475569', fontSize: '0.875rem', background: 'white' }}
          >
            <Download size={16} /> Export file tổng hiện tại
          </button>
        </div>
      </div>

      <div className="rounded-xl border p-5" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
        <div className="flex items-center gap-2 mb-3">
          <Info size={16} style={{ color: '#ca8a04' }} />
          <span style={{ fontWeight: 600, color: '#92400e', fontSize: '0.875rem' }}>Hướng dẫn</span>
        </div>
        <ul className="space-y-2.5">
          {[
            'Ô trống có nghĩa là không cập nhật cho trạm đó.',
            'Số 0 là giá trị hợp lệ (không chạy máy).',
            'Cột P: Nhiên liệu bổ sung. Cột Q: Số giờ chạy.',
            'Các cột hệ thống (T-Z) không cần sửa.',
            'Hệ thống tự tính tồn cuối từ giờ chạy và định mức.',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2" style={{ fontSize: '0.8rem', color: '#92400e' }}>
              <span className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ background: '#ca8a04' }} />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="lg:col-span-3 flex justify-end">
        <button
          type="button"
          disabled={!file || uploading}
          onClick={onUpload}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg transition-all"
          style={{ background: file && !uploading ? '#2563eb' : '#e2e8f0', color: file && !uploading ? 'white' : '#94a3b8', fontSize: '0.875rem', fontWeight: 600, cursor: file && !uploading ? 'pointer' : 'not-allowed' }}
        >
          {uploading ? 'Đang tải lên...' : 'Tiếp theo'} <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

interface Step2Props {
  previewRows: PreviewRow[];
  jobSummary: JobSummary;
  file: File | null;
  validRows: number;
  warningRows: number;
  errorRows: number;
  signatureWarning: SignatureWarning;
  onBack: () => void;
  onNext: () => void;
}

function ImportStep2Panel({ previewRows, jobSummary, file, validRows, warningRows, errorRows, signatureWarning, onBack, onNext }: Step2Props) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Tổng dòng',    value: jobSummary.totalRows || previewRows.length, bg: '#f1f5f9', text: '#475569', icon: FileSpreadsheet },
          { label: 'Dòng hợp lệ', value: jobSummary.validRows || validRows,   bg: '#dcfce7', text: '#16a34a', icon: CheckCircle },
          { label: 'Dòng cảnh báo',value: jobSummary.warningRows || warningRows, bg: '#fef9c3', text: '#ca8a04', icon: AlertTriangle },
          { label: 'Dòng lỗi',    value: jobSummary.errorRows || errorRows,   bg: '#fee2e2', text: '#dc2626', icon: XCircle },
        ].map(card => (
          <div key={card.label} className="rounded-xl p-4 border" style={{ background: card.bg, borderColor: card.text + '30' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: card.text, lineHeight: 1 }}>{card.value}</div>
            <div style={{ fontSize: '0.8rem', color: card.text + 'cc', marginTop: '4px' }}>{card.label}</div>
          </div>
        ))}
      </div>

      {signatureWarning && (
        <div className="flex items-start gap-3 rounded-xl px-4 py-3 border" style={{ background: '#fef3c7', borderColor: '#f59e0b' }}>
          <AlertTriangle size={18} style={{ color: '#b45309', flexShrink: 0, marginTop: '1px' }} />
          <div style={{ fontSize: '0.85rem', color: '#92400e' }}>
            <span style={{ fontWeight: 600 }}>Nội dung file đã được import trước đó.</span>
            {' '}File có nội dung giống lần import lúc{' '}
            <span style={{ fontWeight: 600 }}>{new Date(signatureWarning.importedAt).toLocaleString('vi-VN')}</span>
            {signatureWarning.importedBy ? <> bởi <span style={{ fontWeight: 600 }}>{signatureWarning.importedBy}</span></> : null}
            {signatureWarning.filename ? <> (file: <span style={{ fontWeight: 600 }}>{signatureWarning.filename}</span>)</> : null}.
            {' '}Nếu đây là lần import mới hợp lệ, vẫn có thể xác nhận.
          </div>
        </div>
      )}

      <div className="rounded-xl border overflow-hidden" style={{ background: 'white', borderColor: '#e2e8f0' }}>
        <div className="px-4 py-3 border-b" style={{ borderColor: '#f1f5f9', background: '#f8fafc' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>Preview dữ liệu — {file?.name}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Mã trạm', 'Tên trạm', 'NL bổ sung', 'Số giờ chạy', 'Tồn sau tính', 'Trạng thái', 'Ghi chú'].map(h => (
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
                  <tr key={row.code} style={{ background: rowBg }}>
                    <td className="px-4 py-2.5 border-b" style={{ borderColor: '#f1f5f9', fontFamily: 'monospace', fontSize: '0.8rem', color: '#475569' }}>{row.code}</td>
                    <td className="px-4 py-2.5 border-b" style={{ borderColor: '#f1f5f9', fontSize: '0.8rem', color: '#1e293b', whiteSpace: 'nowrap' }}>{row.name}</td>
                    <td className="px-4 py-2.5 border-b" style={{ borderColor: '#f1f5f9', fontSize: '0.8rem', color: '#64748b' }}>{row.added !== '' ? `${row.added} L` : '—'}</td>
                    <td className="px-4 py-2.5 border-b" style={{ borderColor: '#f1f5f9', fontSize: '0.8rem', color: '#64748b' }}>{row.hoursRun !== '' ? `${row.hoursRun}h` : '—'}</td>
                    <td className="px-4 py-2.5 border-b" style={{ borderColor: '#f1f5f9', fontSize: '0.8rem', fontWeight: 500, color: '#475569' }}>{row.calculated !== '' ? `${row.calculated} L` : '—'}</td>
                    <td className="px-4 py-2.5 border-b" style={{ borderColor: '#f1f5f9' }}>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full" style={{
                        fontSize: '0.75rem', fontWeight: 600,
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
                <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Không có dữ liệu preview</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {errorRows > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl" style={{ background: '#fff5f5', border: '1px solid #fca5a5' }}>
          <XCircle size={16} style={{ color: '#dc2626', flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontWeight: 600, color: '#b91c1c', fontSize: '0.875rem' }}>File có {errorRows} dòng lỗi — không thể xác nhận</div>
            <div style={{ color: '#b91c1c', fontSize: '0.8rem', marginTop: '2px' }}>Vui lòng sửa file và upload lại. Không có "import một phần" — tất cả hoặc không có gì.</div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button type="button" onClick={onBack} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors" style={{ borderColor: '#e2e8f0', color: '#475569', fontSize: '0.875rem', background: 'white' }}>
          <ArrowLeft size={16} /> Quay lại
        </button>
        <button
          type="button"
          disabled={errorRows > 0}
          onClick={onNext}
          className="flex items-center gap-2 px-6 py-2.5 rounded-lg transition-all"
          style={{ background: errorRows > 0 ? '#e2e8f0' : '#2563eb', color: errorRows > 0 ? '#94a3b8' : 'white', fontSize: '0.875rem', fontWeight: 600, cursor: errorRows > 0 ? 'not-allowed' : 'pointer' }}
        >
          Tiếp theo <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

interface SuccessModalProps {
  open: boolean;
  jobSummary: JobSummary;
  validRows: number;
  warningRows: number;
  errorRows: number;
  onHistory: () => void;
  onDashboard: () => void;
}

function ImportSuccessModal({ open, jobSummary, validRows, warningRows, errorRows, onHistory, onDashboard }: SuccessModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={() => {}}>
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
            ].map(card => (
              <div key={card.label} className="rounded-xl p-3" style={{ background: '#f8fafc' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: card.color }}>{card.value}</div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>{card.label}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={onHistory} className="flex-1 py-2.5 rounded-lg border transition-colors" style={{ borderColor: '#e2e8f0', color: '#475569', fontSize: '0.875rem' }}>
              Xem lịch sử
            </button>
            <button type="button" onClick={onDashboard} className="flex-1 py-2.5 rounded-lg transition-all" style={{ background: '#2563eb', color: 'white', fontSize: '0.875rem', fontWeight: 600 }}>
              Về Dashboard
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ImportExcel({ onNavigateToHistory, onNavigateToDashboard }: ImportExcelProps) {
  const [s, dispatch] = useReducer(importReducer, IMPORT_INITIAL);
  const [dragging, setDragging] = useState(false);
  const jobIdRef = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const validRows   = s.previewRows.filter(r => r.status === 'valid').length;
  const warningRows = s.previewRows.filter(r => r.status === 'warning').length;
  const errorRows   = s.previewRows.filter(r => r.status === 'error').length;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith('.xlsx')) { dispatch({ type: 'select-file', file: f }); }
    else toast.error('Chỉ chấp nhận file .xlsx');
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) dispatch({ type: 'select-file', file: f });
  };

  const handleUpload = async () => {
    if (!s.file) return;
    dispatch({ type: 'upload-start' });
    try {
      const job = await uploadExcel(s.file) as Record<string, unknown>;
      jobIdRef.current = job.id as string;
      const rawRows = (job.previewData as Record<string, unknown>[]) ?? [];
      const previewRows: PreviewRow[] = rawRows.map(r => {
        const errors = (r.errors as string[]) ?? [];
        const warnings = (r.warnings as string[]) ?? [];
        const status: RowStatus = errors.length > 0 ? 'error' : warnings.length > 0 ? 'warning' : 'valid';
        return {
          code: (r.stationCode as string) ?? '',
          name: (r.stationName as string) ?? '',
          added: r.fuelAdded != null ? Number(r.fuelAdded) : '',
          hoursRun: r.hoursRun != null ? Number(r.hoursRun) : '',
          calculated: r.fuelCalculated != null ? Number(r.fuelCalculated) : '',
          status,
          message: errors[0] ?? warnings[0] ?? undefined,
        };
      });
      dispatch({
        type: 'upload-success',
        previewRows,
        jobSummary: {
          totalRows: (job.totalRows as number) ?? previewRows.length,
          validRows: (job.validRows as number) ?? previewRows.filter(r => r.status !== 'error').length,
          warningRows: (job.warningRows as number) ?? previewRows.filter(r => r.status === 'warning').length,
          errorRows: (job.invalidRows as number) ?? previewRows.filter(r => r.status === 'error').length,
        },
        signatureWarning: job.signatureWarning ? job.signatureWarning as { importedAt: string; importedBy: string | null; filename: string } : null,
      });
    } catch (err) {
      toast.error((err as Error).message || 'Lỗi upload file');
      dispatch({ type: 'upload-error' });
    }
  };

  const handleConfirmImport = async () => {
    if (!jobIdRef.current) return;
    dispatch({ type: 'confirm-start' });
    try {
      await confirmJob(jobIdRef.current);
      dispatch({ type: 'confirm-success' });
    } catch (err) {
      toast.error((err as Error).message || 'Lỗi xác nhận import');
      dispatch({ type: 'confirm-error' });
    }
  };

  return (
    <LazyMotion features={domAnimation}>
    <div className="p-4 lg:p-6 space-y-6">
      <div>
        <h2 style={{ color: '#0f172a' }}>Import Excel</h2>
        <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Nhập dữ liệu nhiên liệu từ file Excel tổng</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((step, i) => (
          <div key={step.n} className="flex items-center flex-1">
            <div className="flex items-center gap-2 flex-shrink-0">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                style={{
                  background: s.step > step.n ? '#16a34a' : s.step === step.n ? '#2563eb' : '#e2e8f0',
                  color: s.step >= step.n ? 'white' : '#94a3b8',
                  fontSize: '0.85rem', fontWeight: 700,
                }}
              >
                {s.step > step.n ? <Check size={14} /> : step.n}
              </div>
              <span style={{ fontSize: '0.8rem', fontWeight: s.step === step.n ? 600 : 400, color: s.step === step.n ? '#0f172a' : '#94a3b8', whiteSpace: 'nowrap' }}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className="flex-1 h-px mx-3" style={{ background: s.step > step.n ? '#16a34a' : '#e2e8f0' }} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <AnimatePresence mode="wait">
        {s.step === 1 && (
          <m.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
            <ImportStep1Panel
              file={s.file}
              dragging={dragging}
              uploading={s.uploading}
              fileRef={fileRef}
              setDragging={setDragging}
              onDrop={handleDrop}
              onFileChange={handleFileChange}
              onUpload={handleUpload}
            />
          </m.div>
        )}

        {s.step === 2 && (
          <m.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <ImportStep2Panel
              previewRows={s.previewRows}
              jobSummary={s.jobSummary}
              file={s.file}
              validRows={validRows}
              warningRows={warningRows}
              errorRows={errorRows}
              signatureWarning={s.signatureWarning}
              onBack={() => dispatch({ type: 'go-step', step: 1 })}
              onNext={() => dispatch({ type: 'go-step', step: 3 })}
            />
          </m.div>
        )}

        {s.step === 3 && (
          <m.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
            <div className="max-w-xl mx-auto space-y-5">
              <div className="rounded-xl border p-6" style={{ background: 'white', borderColor: '#e2e8f0' }}>
                <h4 className="mb-4" style={{ color: '#0f172a' }}>Tóm tắt trước khi xác nhận</h4>
                <div className="space-y-3">
                  <div className="flex justify-between py-2 border-b" style={{ borderColor: '#f1f5f9' }}>
                    <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Tên file</span>
                    <span style={{ color: '#1e293b', fontSize: '0.875rem', fontWeight: 500 }}>{s.file?.name}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b" style={{ borderColor: '#f1f5f9' }}>
                    <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Tổng dòng sẽ import</span>
                    <span style={{ color: '#1e293b', fontWeight: 600 }}>{s.jobSummary.totalRows || s.previewRows.length}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b" style={{ borderColor: '#f1f5f9' }}>
                    <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Dòng hợp lệ</span>
                    <span style={{ color: '#16a34a', fontWeight: 600 }}>{s.jobSummary.validRows || validRows}</span>
                  </div>
                  {(s.jobSummary.warningRows || warningRows) > 0 && (
                    <div className="flex justify-between py-2" style={{ borderColor: '#f1f5f9' }}>
                      <span style={{ color: '#64748b', fontSize: '0.875rem' }}>Dòng cảnh báo (sẽ import)</span>
                      <span style={{ color: '#ca8a04', fontWeight: 600 }}>{s.jobSummary.warningRows || warningRows}</span>
                    </div>
                  )}
                </div>
                {(s.jobSummary.warningRows || warningRows) > 0 && (
                  <label className="flex items-start gap-3 mt-5 cursor-pointer select-none p-3 rounded-lg" style={{ background: '#fffbeb', border: '1px solid #fde68a' }}>
                    <input
                      type="checkbox"
                      checked={s.warningAcknowledged}
                      onChange={e => dispatch({ type: 'acknowledge-warning', checked: e.target.checked })}
                      className="mt-0.5 flex-shrink-0"
                      style={{ width: '16px', height: '16px', accentColor: '#ca8a04' }}
                    />
                    <span style={{ fontSize: '0.8rem', color: '#92400e' }}>
                      Tôi đã kiểm tra các cảnh báo và xác nhận dữ liệu là đúng.
                    </span>
                  </label>
                )}
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => dispatch({ type: 'go-step', step: 2 })} className="flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-colors flex-1 justify-center" style={{ borderColor: '#e2e8f0', color: '#475569', fontSize: '0.875rem', background: 'white' }}>
                  <ArrowLeft size={16} /> Quay lại
                </button>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={s.confirming || ((s.jobSummary.warningRows || warningRows) > 0 && !s.warningAcknowledged)}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg transition-all flex-1 justify-center"
                  style={{
                    background: s.confirming || ((s.jobSummary.warningRows || warningRows) > 0 && !s.warningAcknowledged) ? '#e2e8f0' : '#16a34a',
                    color: s.confirming || ((s.jobSummary.warningRows || warningRows) > 0 && !s.warningAcknowledged) ? '#94a3b8' : 'white',
                    fontSize: '0.875rem', fontWeight: 600,
                    cursor: s.confirming || ((s.jobSummary.warningRows || warningRows) > 0 && !s.warningAcknowledged) ? 'not-allowed' : 'pointer',
                  }}
                >
                  <Check size={16} /> {s.confirming ? 'Đang xử lý...' : 'Xác nhận import'}
                </button>
              </div>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      <ImportSuccessModal
        open={s.showSuccessModal}
        jobSummary={s.jobSummary}
        validRows={validRows}
        warningRows={warningRows}
        errorRows={errorRows}
        onHistory={() => { dispatch({ type: 'close-modal' }); onNavigateToHistory(); }}
        onDashboard={() => { dispatch({ type: 'close-modal' }); onNavigateToDashboard(); }}
      />
    </div>
    </LazyMotion>
  );
}
