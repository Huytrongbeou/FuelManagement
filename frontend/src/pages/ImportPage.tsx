import { useState, useRef } from 'react'
import { uploadFile, confirmJob, cancelJob, getExportUrl, getTemplateUrl } from '../api/imports'

interface PreviewRow {
  rowNum: number
  stationCode: string
  stationName: string
  errors: string[]
  warnings: string[]
  hasFuelActivity: boolean
}

interface JobResult {
  id: string
  status: string
  totalRows: number
  validRows: number
  invalidRows: number
  warningRows: number
  previewData: PreviewRow[]
  validationErrors: unknown
}

export default function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'idle' | 'previewing' | 'confirming' | 'done' | 'error'>('idle')
  const [job, setJob] = useState<JobResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const token = localStorage.getItem('token')

  async function handleUpload() {
    const file = fileRef.current?.files?.[0]
    if (!file) return
    setLoading(true)
    setMessage('')
    try {
      const result = await uploadFile(file)
      setJob(result as JobResult)
      setStep('previewing')
    } catch (err: unknown) {
      setMessage('Lỗi khi tải file: ' + ((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Unknown'))
      setStep('error')
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirm() {
    if (!job) return
    setLoading(true)
    setStep('confirming')
    try {
      await confirmJob(job.id)
      setStep('done')
      setMessage('Import thành công!')
    } catch (err: unknown) {
      setMessage('Lỗi khi xác nhận: ' + ((err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Unknown'))
      setStep('error')
    } finally {
      setLoading(false)
    }
  }

  async function handleCancel() {
    if (!job) return
    await cancelJob(job.id)
    setStep('idle')
    setJob(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Import / Export Excel</h1>

      {/* Export buttons */}
      <div className="flex gap-3 mb-8">
        <a
          href={getExportUrl()}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => {
            e.preventDefault()
            fetch(getExportUrl(), { headers: { Authorization: `Bearer ${token}` } })
              .then(r => r.blob())
              .then(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'fuel-snapshot.xlsx'; a.click() })
          }}
          className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700"
        >
          Xuất snapshot Excel
        </a>
        <a
          href={getTemplateUrl()}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => {
            e.preventDefault()
            fetch(getTemplateUrl(), { headers: { Authorization: `Bearer ${token}` } })
              .then(r => r.blob())
              .then(b => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'import-template.xlsx'; a.click() })
          }}
          className="border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
        >
          Tải template
        </a>
      </div>

      {/* Import wizard */}
      <div className="bg-white rounded-xl shadow border border-gray-100 p-6">
        <h2 className="font-semibold text-gray-800 mb-4">Import Excel</h2>

        {/* Step 1: Upload */}
        {step === 'idle' && (
          <div className="space-y-4">
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx"
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            <button
              onClick={handleUpload}
              disabled={loading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Đang xử lý...' : 'Preview file'}
            </button>
          </div>
        )}

        {/* Step 2: Preview */}
        {(step === 'previewing' || step === 'confirming') && job && (
          <div>
            <div className="flex gap-4 mb-4">
              <span className="text-sm text-gray-600">Tổng: <b>{job.totalRows}</b></span>
              <span className="text-sm text-green-600">Hợp lệ: <b>{job.validRows}</b></span>
              {job.warningRows > 0 && <span className="text-sm text-yellow-600">Cảnh báo: <b>{job.warningRows}</b></span>}
              {job.invalidRows > 0 && <span className="text-sm text-red-600">Lỗi: <b>{job.invalidRows}</b></span>}
            </div>

            <div className="overflow-auto max-h-64 border rounded-lg mb-4">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    {['Dòng', 'Mã trạm', 'Tên trạm', 'Phát sinh', 'Lỗi / Cảnh báo'].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-gray-500">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {job.previewData?.map((r: PreviewRow) => (
                    <tr key={r.rowNum} className={r.errors.length > 0 ? 'bg-red-50' : r.warnings.length > 0 ? 'bg-yellow-50' : ''}>
                      <td className="px-3 py-1">{r.rowNum}</td>
                      <td className="px-3 py-1 font-mono">{r.stationCode}</td>
                      <td className="px-3 py-1">{r.stationName}</td>
                      <td className="px-3 py-1">{r.hasFuelActivity ? '✓' : ''}</td>
                      <td className="px-3 py-1">
                        {r.errors.map((e, i) => <p key={i} className="text-red-600">{e}</p>)}
                        {r.warnings.map((w, i) => <p key={i} className="text-yellow-700">{w}</p>)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {job.invalidRows > 0 && (
              <p className="text-red-600 text-sm mb-4">Có {job.invalidRows} dòng lỗi. Vui lòng sửa file và upload lại.</p>
            )}

            <div className="flex gap-3">
              {job.invalidRows === 0 && (
                <button
                  onClick={handleConfirm}
                  disabled={loading || step === 'confirming'}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Đang xác nhận...' : 'Xác nhận import'}
                </button>
              )}
              <button
                onClick={handleCancel}
                className="border border-gray-300 px-4 py-2 rounded-lg text-sm hover:bg-gray-50"
              >
                Hủy
              </button>
            </div>
          </div>
        )}

        {/* Done / Error */}
        {(step === 'done' || step === 'error') && (
          <div>
            <p className={`mb-4 text-sm ${step === 'done' ? 'text-green-600' : 'text-red-600'}`}>{message}</p>
            <button
              onClick={() => { setStep('idle'); setJob(null); if (fileRef.current) fileRef.current.value = '' }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
            >
              Import khác
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
