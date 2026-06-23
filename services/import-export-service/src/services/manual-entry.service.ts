import { v4 as uuidv4 } from 'uuid'
import crypto from 'crypto'
import * as stationClient from '../clients/station.client'
import * as fuelClient from '../clients/fuel.client'
import type { UserContext } from '../clients/fuel.client'
import { confirmImport } from './import-orchestrator.service'
import type { ParsedRow } from './excel-validator.service'
import { formatBusinessDateVN } from '../utils/date-vn'
import { normalizeDecimal2 } from '../utils/normalize'
import { auditLog } from '../utils/audit-log'
import { prisma } from '../lib/prisma'

// In-memory 60s duplicate guard for direct entry (single-instance dev; use Redis for multi-instance prod)
const batchSubmitCache = new Map<string, number>()
const BATCH_DUPLICATE_WINDOW_MS = 60_000

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
  if (isNewStation && !row.stationName) errors.push('Tên trạm là bắt buộc cho trạm mới')
  if (isNewStation && (row.consumptionRate == null || row.consumptionRate <= 0)) {
    errors.push('Trạm mới cần nhập định mức tiêu thụ')
  }
  if (isNewStation && (row.maxCapacity == null || row.maxCapacity <= 0)) {
    errors.push('Trạm mới cần nhập dung tích tối đa')
  }
  const hasFuelActivity = (row.fuelAdded ?? 0) > 0 || (row.hoursRun ?? 0) > 0

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
    fuelAdded: row.fuelAdded ?? null,
    hoursRun: row.hoursRun ?? null,
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

export async function confirm(jobId: string, committedBy?: string, userCtx?: UserContext) {
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
      const err = new Error(`Trạm ${r.stationCode} không xác định được. Vui lòng thử lại.`)
      ;(err as { status?: number }).status = 422; throw err
    }
    if (!station.isActive) {
      const err = new Error(`Trạm ${r.stationCode} không còn hoạt động.`)
      ;(err as { status?: number }).status = 422; throw err
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
        const err = new Error(pv.errorCode === 'EXCEEDS_CAPACITY'
          ? 'Nhiên liệu vượt quá dung tích tối đa. Vui lòng kiểm tra lại trước khi xác nhận.'
          : 'Nhiên liệu âm sau khi trừ tiêu thụ. Vui lòng kiểm tra lại trước khi xác nhận.')
        ;(err as { status?: number }).status = 422; throw err
      }
    }
  }

  const result = await confirmImport(jobId, { committedBy, source: 'direct', userCtx })
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
