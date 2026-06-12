import API from './client'

export async function uploadFile(file: File) {
  const form = new FormData()
  form.append('file', file)
  const { data } = await API.post('/api/import/upload', form)
  return data as { id: string; status: string; totalRows: number; validRows: number; invalidRows: number; warningRows: number; previewData: unknown; validationErrors: unknown }
}

export async function getJob(jobId: string) {
  const { data } = await API.get(`/api/import/jobs/${jobId}`)
  return data
}

export async function confirmJob(jobId: string) {
  const { data } = await API.post(`/api/import/jobs/${jobId}/confirm`)
  return data
}

export async function cancelJob(jobId: string) {
  const { data } = await API.post(`/api/import/jobs/${jobId}/cancel`)
  return data
}

export function getExportUrl(): string {
  return 'http://localhost:3000/api/export/snapshot'
}

export function getTemplateUrl(): string {
  return 'http://localhost:3000/api/export/template'
}
