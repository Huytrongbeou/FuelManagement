import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'
import * as stationClient from '../clients/station.client'
import * as fuelClient from '../clients/fuel.client'
import type { UserContext } from '../clients/fuel.client'
import { confirmImport } from './import-orchestrator.service'
import type { ParsedRow } from './excel-validator.service'
import { formatBusinessDateVN } from '../helpers/date-vn'
import { normalizeDecimal2 } from '../helpers/normalize'
import { auditLog } from '../helpers/audit-log'
import { prisma } from '../config/prisma'

// In-memory 60s duplicate guard for direct entry (single-instance dev; use Redis for multi-instance prod)
const batchSubmitCache = new Map<string, number>()
const BATCH_DUPLICATE_WINDOW_MS = 60_000

setInterval(() => {
  const cutoff = Date.now() - BATCH_DUPLICATE_WINDOW_MS
  for (const [k, t] of batchSubmitCache) if (t < cutoff) batchSubmitCache.delete(k)
}, BATCH_DUPLICATE_WINDOW_MS).unref()

type PreviewRowJson = { stationCode?: string; recordedDate?: string | null; fuelAdded?: number | null; hoursRun?: number | null; hasFuelActivity?: boolean }

function computeBatchSignature(userId: string, rows: PreviewRowJson[]): string {
  const content = userId + '\n' +
    rows
      .filter(r => r.hasFuelActivity)
      .map(r => {
        try {
          const dateStr = r.recordedDate ? formatBusinessDateVN(new Date(r.recordedDate)) : ''
          return [
            (r.stationCode ?? '').trim().toUpperCase(),
            dateStr,
            normalizeDecimal2(r.fuelAdded),
            normalizeDecimal2(r.hoursRun),
          ].join('|')
        } catch {
          return null
        }
      })
      .filter((x): x is string => x !== null)
      .sort()
      .join('\n')
  return crypto.createHash('sha256').update(content).digest('hex')
}

export interface DirectEntryRow {
  stationCode: string
  stationName?: string
  generatorName?: string | null
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  currentAdminUnitName?: string | null
  legacyAreaName?: string | null
  operationAreaName?: string | null
  brandName?: string | null
  modelName?: string | null
  powerKva?: number | null
  fuelType?: string | null
  consumptionRate?: number | null
  maxCapacity?: number | null
  fuelAdded?: number | null
  hoursRun?: number | null
  recordedDate?: string | null
  notes?: string | null
}

function toParsedRow(row: DirectEntryRow, stations: { stationCode: string }[], rowNum: number): ParsedRow {
  const isNewStation = !stations.find(s => s.stationCode === row.stationCode)
  const errors: string[] = []
  const warnings: string[] = []

  if (!row.stationCode) errors.push('Mã trạm là bắt buộc')
  if (isNewStation) errors.push('Mã trạm không tồn tại. Khởi tạo trạm trong Quản lý trạm trước khi nhập nhiên liệu.')
  const fa = row.fuelAdded != null ? Number(row.fuelAdded) : null
  const hr = row.hoursRun != null ? Number(row.hoursRun) : null
  if (fa != null && !Number.isFinite(fa)) errors.push('Nhiên liệu bổ sung không hợp lệ')
  else if (fa != null && fa < 0) errors.push('Nhiên liệu bổ sung không thể âm')
  if (hr != null && !Number.isFinite(hr)) errors.push('Số giờ chạy không hợp lệ')
  else if (hr != null && hr < 0) errors.push('Số giờ chạy không thể âm')

  const hasFuelActivity = (fa ?? 0) > 0 || (hr ?? 0) > 0

  const recordedDate = row.recordedDate ? new Date(row.recordedDate) : (hasFuelActivity ? new Date() : null)

  return {
    rowNum,
    stationCode: row.stationCode,
    stationName: row.stationName || '',
    generatorName: row.generatorName ?? null,
    address: row.address || '',
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    currentAdminUnitName: row.currentAdminUnitName ?? null,
    legacyAreaName: row.legacyAreaName ?? null,
    operationAreaName: row.operationAreaName ?? null,
    brandName: row.brandName ?? null,
    modelName: row.modelName ?? null,
    powerKva: row.powerKva ?? null,
    fuelType: row.fuelType ?? null,
    consumptionRate: row.consumptionRate ?? null,
    maxCapacity: row.maxCapacity ?? null,
    fuelAdded: fa,
    hoursRun: hr,
    recordedDate,
    notes: row.notes || '',
    isNewStation,
    hasFuelActivity,
    errors,
    warnings,
  }
}

export async function preview(rows: DirectEntryRow[], createdBy?: string, userCtx?: UserContext) {
  if (!rows || rows.length === 0) {
    throw Object.assign(new Error('rows array must not be empty'), { status: 400 })
  }

  const [stations, fuelStates] = await Promise.all([
    stationClient.getAllStations({ active: 'all' }),
    fuelClient.getAllCurrentStates(),
  ])

  const parsedRows = rows.map((r, i) => toParsedRow(r, stations, i + 2))

  // Same station with multiple fuel-activity rows in one batch is rejected — see
  // excel-validator.service.ts for the equivalent Excel-import rule and rationale.
  const activityRowsByStation = new Map<string, ParsedRow[]>()
  for (const row of parsedRows) {
    if (!row.hasFuelActivity) continue
    const key = row.stationCode.trim().toUpperCase()
    if (!activityRowsByStation.has(key)) activityRowsByStation.set(key, [])
    activityRowsByStation.get(key)!.push(row)
  }
  for (const dupRows of activityRowsByStation.values()) {
    if (dupRows.length < 2) continue
    for (const row of dupRows) {
      row.errors.push('Trạm xuất hiện nhiều dòng có số liệu trong cùng lần nhập — mỗi trạm chỉ một dòng.')
    }
  }

  const fuelStateMap = new Map(fuelStates.map(s => [s.stationId, s]))

  const versions: Record<string, number | null> = {}
  const stationCodeMap = new Map(stations.map(s => [s.stationCode, s]))
  for (const row of parsedRows) {
    const existing = stationCodeMap.get(row.stationCode)
    if (existing) {
      const fuelState = fuelStateMap.get(existing.id)
      versions[existing.id] = fuelState ? Number(fuelState.snapshotVersion) : null
    }
  }

  // Direct-entry never initializes CurrentFuelState — active stations missing it are a red error
  for (const row of parsedRows) {
    if (!row.hasFuelActivity) continue
    const station = stationCodeMap.get(row.stationCode)
    if (!station) continue // unknown station already errors elsewhere
    if (!fuelStateMap.has(station.id)) {
      row.errors.push(`Trạm "${station.stationName}" chưa có tồn nhiên liệu ban đầu. Khởi tạo tồn ban đầu trong Quản lý trạm trước khi nhập.`)
    }
  }

  const pvEntries: Array<{ idx: number; item: { stationId: string; fuelAdded: number; hoursRun: number; consumptionRate: number; maxCapacity: number } }> = []
  parsedRows.forEach((r, idx) => {
    if (!r.hasFuelActivity || r.errors.length > 0) return
    const station = stationCodeMap.get(r.stationCode)
    if (!station) return
    pvEntries.push({
      idx,
      item: {
        stationId: station.id,
        fuelAdded: r.fuelAdded ?? 0,
        hoursRun: r.hoursRun ?? 0,
        consumptionRate: Number(station.consumptionRate ?? 0),
        maxCapacity: Number(station.maxCapacity ?? 0),
      }
    })
  })
  if (pvEntries.length > 0) {
    try {
      const pvResults = await fuelClient.previewValidate(pvEntries.map(e => e.item), userCtx)
      pvEntries.forEach(({ idx }, i) => {
        const pv = pvResults[i]
        if (pv && !pv.valid && pv.errorCode) {
          parsedRows[idx].errors.push(
            pv.errorCode === 'EXCEEDS_CAPACITY'
              ? 'Nhiên liệu vượt quá dung tích tối đa'
              : 'Nhiên liệu âm sau khi trừ tiêu thụ'
          )
        }
      })
    } catch {
      // non-blocking advisory
    }
  }

  // Content-based duplicate check (A5). Unlike Excel import — where an exact duplicate is a hard
  // error — direct entry treats it as a *warning* so a genuine second run in the same day can still
  // be saved via "Vẫn tạo". Same-date-different-values is a warning for the same reason.
  const dupCandidates: Array<{ row: ParsedRow; stationId: string; stationName: string }> = []
  for (const r of parsedRows) {
    if (r.errors.length > 0 || !r.hasFuelActivity || !r.recordedDate) continue
    const station = stationCodeMap.get(r.stationCode)
    if (!station) continue
    dupCandidates.push({ row: r, stationId: station.id, stationName: station.stationName })
  }
  if (dupCandidates.length > 0) {
    try {
      const dupResults = await fuelClient.checkExactDuplicates(
        dupCandidates.map(c => ({ stationId: c.stationId, recordedDate: c.row.recordedDate as Date, fuelAdded: c.row.fuelAdded ?? 0, hoursRun: c.row.hoursRun ?? 0 })),
        userCtx,
      )
      dupCandidates.forEach((c, i) => {
        const dup = dupResults[i]
        if (!dup) return
        const dateStr = (c.row.recordedDate as Date).toLocaleDateString('vi-VN')
        if (dup.isDuplicate) {
          c.row.warnings.push(`Trạm "${c.stationName}" đã có bản ghi ngày ${dateStr} với cùng số liệu — có thể nhập trùng. Bấm "Vẫn tạo" nếu đây là phát sinh thực sự.`)
        } else if (dup.hasSameDateDifferentValues) {
          c.row.warnings.push(`Trạm "${c.stationName}" đã có bản ghi ngày ${dateStr}. Xác nhận sẽ tạo thêm một phát sinh mới.`)
        }
      })
    } catch {
      // non-blocking advisory — dup check must never block a legitimate entry
    }
  }

  const totalRows = parsedRows.length
  const invalidRows = parsedRows.filter(r => r.errors.length > 0).length
  const warningRows = parsedRows.filter(r => r.warnings.length > 0 && r.errors.length === 0).length
  const validRows = totalRows - invalidRows

  const job = await prisma.importJob.create({
    data: {
      idempotencyKey: uuidv4(),
      filename: 'direct-entry',
      source: 'direct',
      status: 'previewing',
      totalRows,
      validRows,
      invalidRows,
      warningRows,
      previewData: parsedRows as unknown as object,
      validationErrors: parsedRows.filter(r => r.errors.length > 0).map(r => ({ row: r.rowNum, errors: r.errors })) as unknown as object,
      fuelStateVersionsAtPreview: versions as unknown as object,
      createdBy,
    },
  })

  return { jobId: job.id, totalRows, validRows, invalidRows, warningRows, rows: parsedRows }
}

async function failJobValidation(jobId: string, message: string): Promise<never> {
  await prisma.importJob.update({
    where: { id: jobId },
    data: { status: 'failed', failureStage: 'validation', retryable: false, errorMessage: message },
  })
  throw Object.assign(new Error(message), { status: 422 })
}

export async function confirm(jobId: string, committedBy?: string, userCtx?: UserContext, acknowledgeWarnings?: boolean) {
  const job = await prisma.importJob.findUnique({ where: { id: jobId }, select: { previewData: true } })
  if (!job) throw Object.assign(new Error('Job not found'), { status: 404 })

  const previewRows = (job.previewData as unknown as PreviewRowJson[]) || []
  const userId = userCtx?.userId ?? 'anonymous'
  const batchSignature = computeBatchSignature(userId, previewRows)

  const lastSubmit = batchSubmitCache.get(batchSignature)
  if (lastSubmit && Date.now() - lastSubmit < BATCH_DUPLICATE_WINDOW_MS) {
    throw Object.assign(
      new Error('Dữ liệu này đã được gửi trong 60 giây qua. Vui lòng đợi trước khi gửi lại.'),
      { status: 409 }
    )
  }

  const freshStations = await stationClient.getAllStations({ active: 'all' })
  const activeMap = new Map(freshStations.map(s => [s.stationCode, s]))

  for (const r of previewRows) {
    if (!r.hasFuelActivity) continue
    const station = activeMap.get(r.stationCode ?? '')
    if (!station) {
      await failJobValidation(jobId, `Trạm ${r.stationCode} không xác định được. Vui lòng thử lại.`)
      continue
    }
    if (!station.isActive) {
      await failJobValidation(jobId, `Trạm ${r.stationCode} không còn hoạt động.`)
      continue
    }
  }

  const pvItems = previewRows
    .filter(r => r.hasFuelActivity)
    .map(r => {
      const station = activeMap.get(r.stationCode ?? '')!
      return {
        stationId: station.id,
        fuelAdded: r.fuelAdded ?? 0,
        hoursRun: r.hoursRun ?? 0,
        consumptionRate: Number(station.consumptionRate ?? 0),
        maxCapacity: Number(station.maxCapacity ?? 0),
      }
    })

  if (pvItems.length > 0) {
    const pvResults = await fuelClient.previewValidate(pvItems, userCtx)
    for (let i = 0; i < pvItems.length; i++) {
      const pv = pvResults[i]
      if (pv && !pv.valid) {
        const message = pv.errorCode === 'EXCEEDS_CAPACITY'
          ? 'Nhiên liệu vượt quá dung tích tối đa. Vui lòng kiểm tra lại trước khi xác nhận.'
          : 'Nhiên liệu âm sau khi trừ tiêu thụ. Vui lòng kiểm tra lại trước khi xác nhận.'
        await failJobValidation(jobId, message)
      }
    }
  }

  const result = await confirmImport(jobId, { committedBy, source: 'direct', userCtx, acknowledgeWarnings })
  batchSubmitCache.set(batchSignature, Date.now())

  auditLog({
    action: 'manual_entry_confirm',
    jobId,
    committedBy,
    userId: userCtx?.userId,
    userName: userCtx?.userName,
    role: userCtx?.userRole,
    result: 'success',
  })

  return result
}
