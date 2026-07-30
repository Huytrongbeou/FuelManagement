import * as maintenanceRepo from '../repositories/maintenance.repository'
import * as stationRepo from '../repositories/station.repository'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function fail(message: string, status = 400) {
  return Object.assign(new Error(message), { status })
}

/** YYYY-MM-DD → Date at UTC midnight, matching how @db.Date columns round-trip. */
function toDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`)
}

export async function createMaintenance(stationId: string, data: Record<string, unknown>, recordedBy?: string) {
  if (!UUID_RE.test(stationId)) throw fail('Không tìm thấy trạm', 404)
  const station = await stationRepo.findById(stationId)
  if (!station) throw fail('Không tìm thấy trạm', 404)

  const dateStr = String(data.performedAt ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) throw fail('Ngày bảo dưỡng không hợp lệ (định dạng YYYY-MM-DD)')
  const performedAt = toDateOnly(dateStr)
  if (Number.isNaN(performedAt.getTime())) throw fail('Ngày bảo dưỡng không hợp lệ')

  const note = data.note == null ? null : String(data.note).trim() || null

  return maintenanceRepo.create({
    stationId,
    stationCode: station.stationCode,
    performedAt,
    note,
    recordedBy: recordedBy ?? null,
  })
}

export async function listMaintenance(stationId: string) {
  if (!UUID_RE.test(stationId)) throw fail('Không tìm thấy trạm', 404)
  const logs = await maintenanceRepo.findByStation(stationId)

  // Summary the station detail shows: last maintenance date + how many this calendar month.
  const now = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const countThisMonth = logs.filter(l => l.performedAt >= monthStart).length

  return {
    logs,
    lastPerformedAt: logs.length > 0 ? logs[0].performedAt : null,
    countThisMonth,
    total: logs.length,
  }
}
