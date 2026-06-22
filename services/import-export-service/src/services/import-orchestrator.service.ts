import { PrismaClient } from '@prisma/client'
import { parseAndValidate } from './excel-validator.service'
import type { ParsedRow } from './excel-validator.service'
import * as stationClient from '../clients/station.client'
import * as fuelClient from '../clients/fuel.client'
import type { UserContext } from '../clients/fuel.client'
import * as mq from '../clients/rabbitmq'
import fs from 'fs/promises'
import crypto from 'crypto'
import { formatBusinessDateVN } from '../utils/date-vn'
import { normalizeDecimal2 } from '../utils/normalize'

const prisma = new PrismaClient()

function computeImportSignature(rows: ParsedRow[]): string {
  const content = rows
    .filter(r => r.hasFuelActivity)
    .map(r => {
      try {
        return [
          r.stationCode.trim().toUpperCase(),
          r.recordedDate instanceof Date ? formatBusinessDateVN(r.recordedDate) : String(r.recordedDate),
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

export async function previewImport(
  jobId: string,
  filePath: string,
  createdBy?: string,
  userCtx?: UserContext
) {
  const isFuelOnly = userCtx?.userRole === 'manager'

  const [stations, fuelStates] = await Promise.all([
    stationClient.getAllStations({ active: 'all' }),
    fuelClient.getAllCurrentStates(),
  ])

  const buffer = await fs.readFile(filePath)
  const rows = await parseAndValidate(buffer, stations, isFuelOnly ? 'fuel-only' : 'full')

  // Compute importSignature and check for duplicates in last 24h
  const importSignature = computeImportSignature(rows)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  let signatureWarning: { importedAt: Date; importedBy: string | null; filename: string } | null = null
  const existingWithSameSignature = await prisma.importJob.findFirst({
    where: {
      importSignature,
      status: 'committed',
      committedAt: { gte: oneDayAgo },
      NOT: { id: jobId },
    },
    orderBy: { committedAt: 'desc' },
    select: { committedAt: true, committedBy: true, filename: true },
  })
  if (existingWithSameSignature) {
    signatureWarning = {
      importedAt: existingWithSameSignature.committedAt!,
      importedBy: existingWithSameSignature.committedBy,
      filename: existingWithSameSignature.filename,
    }
  }

  const fuelStateMap = new Map(fuelStates.map(s => [s.stationId, s]))
  const stationCodeMap = new Map(stations.map(s => [s.stationCode, s]))

  // Exact duplicate check: applies to both admin and manager for rows with fuel activity
  const dupCheckItems = rows
    .filter(r => r.errors.length === 0 && r.hasFuelActivity && r.recordedDate)
    .map(r => {
      const station = stationCodeMap.get(r.stationCode)
      if (!station) return null
      return { stationId: station.id, recordedDate: r.recordedDate as Date, fuelAdded: r.fuelAdded ?? 0, hoursRun: r.hoursRun ?? 0, stationCode: r.stationCode, stationName: station.stationName }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  if (dupCheckItems.length > 0) {
    try {
      const dupResults = await fuelClient.checkExactDuplicates(dupCheckItems, userCtx)
      const dupByStationId = new Map(dupResults.map(d => [d.stationId, d]))
      for (const row of rows) {
        const station = stationCodeMap.get(row.stationCode)
        if (!station || !row.hasFuelActivity) continue
        const dup = dupByStationId.get(station.id)
        if (!dup) continue
        if (dup.isDuplicate) {
          const dateStr = row.recordedDate ? row.recordedDate.toLocaleDateString('vi-VN') : ''
          row.errors.push(
            `Trạm "${station.stationName}" đã có bản ghi ngày ${dateStr} với cùng số liệu — có thể là nhập trùng. Liên hệ Admin nếu đây là phát sinh thực sự.`
          )
        } else if (dup.hasSameDateDifferentValues) {
          const dateStr = row.recordedDate ? row.recordedDate.toLocaleDateString('vi-VN') : ''
          row.warnings.push(
            `Trạm "${station.stationName}" đã có bản ghi ngày ${dateStr}. Xác nhận sẽ tạo thêm một phát sinh mới.`
          )
        }
      }
    } catch {
      // non-blocking
    }
  }

  // Preview-validate fuel calculations (advisory — confirm still validates in transaction)
  const pvItems = rows
    .filter(r => r.errors.length === 0 && r.hasFuelActivity)
    .map(r => {
      const station = stationCodeMap.get(r.stationCode)
      if (!station) return null
      return {
        stationId: station.id,
        fuelAdded: r.fuelAdded ?? 0,
        hoursRun: r.hoursRun ?? 0,
        consumptionRate: Number(station.consumptionRate ?? 0),
        maxCapacity: Number(station.maxCapacity ?? 0),
        rowNum: r.rowNum,
        stationName: station.stationName,
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  if (pvItems.length > 0) {
    try {
      const pvResults = await fuelClient.previewValidate(pvItems, userCtx)
      const pvByStationId = new Map(pvResults.map(p => [p.stationId, p]))
      for (const item of pvItems) {
        const pv = pvByStationId.get(item.stationId)
        if (!pv || pv.valid) continue
        const row = rows.find(r => r.rowNum === item.rowNum)
        if (!row) continue
        if (pv.errorCode === 'EXCEEDS_CAPACITY') {
          row.errors.push(
            `Hàng ${item.rowNum}: Nhiên liệu dự kiến sau nhập ${pv.fuelAfter?.toFixed(0)} lít vượt dung tích tối đa ${pv.maxCapacity} lít.`
          )
        } else if (pv.errorCode === 'NEGATIVE_FUEL') {
          row.errors.push(
            `Hàng ${item.rowNum}: Nhiên liệu dự kiến sau nhập ${pv.fuelAfter?.toFixed(0)} lít (âm). Kiểm tra lại số giờ chạy.`
          )
        }
      }
    } catch {
      // non-blocking: advisory only
    }
  }

  const versions: Record<string, number | null> = {}
  for (const row of rows) {
    const existing = stationCodeMap.get(row.stationCode)
    if (existing) {
      const fuelState = fuelStateMap.get(existing.id)
      versions[existing.id] = fuelState ? Number(fuelState.snapshotVersion) : null
    }
  }

  const totalRows = rows.length
  const invalidRows = rows.filter(r => r.errors.length > 0).length
  const warningRows = rows.filter(r => r.warnings.length > 0 && r.errors.length === 0).length
  const validRows = totalRows - invalidRows

  await prisma.importJob.update({
    where: { id: jobId },
    data: {
      status: 'previewing',
      importSignature,
      totalRows,
      validRows,
      invalidRows,
      warningRows,
      previewData: rows as unknown as object,
      validationErrors: rows.filter(r => r.errors.length > 0).map(r => ({ row: r.rowNum, errors: r.errors })) as unknown as object,
      fuelStateVersionsAtPreview: versions as unknown as object,
      createdBy,
    },
  })

  return { totalRows, validRows, invalidRows, warningRows, rows, signatureWarning }
}

export async function confirmImport(
  jobId: string,
  opts: { committedBy?: string; source?: string; userCtx?: UserContext } = {}
) {
  const { committedBy, source = 'import', userCtx } = opts
  const job = await prisma.importJob.findUnique({ where: { id: jobId } })
  if (!job) throw Object.assign(new Error('Import job not found'), { status: 404 })

  if (job.status === 'committed') {
    return { already_committed: true, result: job.commitResult }
  }

  if (job.status === 'failed') {
    if (!job.retryable) {
      throw Object.assign(new Error('Cần preview lại trước khi thử xác nhận'), { status: 409 })
    }
  } else if (job.status !== 'previewing') {
    throw Object.assign(new Error(`Không thể xác nhận job ở trạng thái "${job.status}"`), { status: 400 })
  }

  const previewRows = (job.previewData as unknown as Array<{
    stationCode: string
    stationName: string
    generatorName: string | null
    address: string
    latitude: number | null
    longitude: number | null
    currentAdminUnitName: string | null
    legacyAreaName: string | null
    operationAreaName: string | null
    brandName: string | null
    modelName: string | null
    powerKva: number | null
    fuelType: string | null
    consumptionRate: number | null
    maxCapacity: number | null
    fuelAdded: number | null
    hoursRun: number | null
    recordedDate: string | null
    notes: string
    isNewStation: boolean
    hasFuelActivity: boolean
    errors: string[]
  }>) || []

  const validRows = previewRows.filter(r => r.errors.length === 0)
  if (validRows.length === 0) {
    throw Object.assign(new Error('Không có dòng hợp lệ để xác nhận. Vui lòng kiểm tra lại dữ liệu.'), { status: 422 })
  }
  const isFuelOnly = userCtx?.userRole === 'manager'

  if (isFuelOnly) {
    // Manager fuel-only: skip backup and upsert; just verify stations still exist and are active
    if (!job.failureStage || ['backup', 'station_upsert'].includes(job.failureStage || '')) {
      let stations: Awaited<ReturnType<typeof stationClient.getAllStations>>
      try {
        stations = await stationClient.getAllStations({ active: 'all' })
      } catch {
        await prisma.importJob.update({ where: { id: jobId }, data: { status: 'failed', failureStage: 'station_upsert', retryable: true, errorMessage: 'Lỗi kết nối station-service' } })
        throw Object.assign(new Error('Lỗi kết nối station-service, vui lòng thử lại'), { status: 500 })
      }
      const stationByCode = new Map(stations.map(s => [s.stationCode, s]))
      const invalid = validRows.filter(r => {
        const s = stationByCode.get(r.stationCode)
        return !s || !s.isActive
      })
      if (invalid.length > 0) {
        const msg = invalid.map(r => r.stationCode).join(', ')
        await prisma.importJob.update({ where: { id: jobId }, data: { status: 'failed', failureStage: 'station_upsert', retryable: false, errorMessage: `Trạm không hợp lệ tại thời điểm xác nhận: ${msg}` } })
        throw Object.assign(new Error(`Trạm không hợp lệ tại thời điểm xác nhận: ${msg}`), { status: 422 })
      }
      const lookupResults = validRows.map(r => {
        const s = stationByCode.get(r.stationCode)!
        return { station_code: r.stationCode, station_id: s.id, action: 'lookup', warning: null }
      })
      await prisma.importJob.update({ where: { id: jobId }, data: { stationUpsertResults: { results: lookupResults, has_errors: false } as unknown as object } })
    }
  } else {
    // Admin full import: backup then upsert stations

    // Step 2: BACKUP
    if (!job.failureStage || job.failureStage === 'backup') {
      try {
        const [backupStations, backupFuelStates] = await Promise.all([
          stationClient.getAllStations({ active: 'all' }),
          fuelClient.getAllCurrentStates(),
        ])
        await prisma.importJob.update({
          where: { id: jobId },
          data: {
            backupStations: backupStations as unknown as object,
            backupFuelStates: backupFuelStates as unknown as object,
          },
        })
      } catch {
        await prisma.importJob.update({
          where: { id: jobId },
          data: { status: 'failed', failureStage: 'backup', retryable: true, errorMessage: 'Backup thất bại' },
        })
        throw Object.assign(new Error('Backup thất bại, vui lòng thử lại'), { status: 500 })
      }
    }

    // Step 3: VERIFY STATIONS (fuel-only import: no station creation or master data update)
    if (!job.failureStage || job.failureStage === 'backup' || job.failureStage === 'station_upsert') {
      let freshStations: Awaited<ReturnType<typeof stationClient.getAllStations>>
      try {
        freshStations = await stationClient.getAllStations({ active: 'all' })
      } catch {
        await prisma.importJob.update({
          where: { id: jobId },
          data: { status: 'failed', failureStage: 'station_upsert', retryable: true, errorMessage: 'Lỗi kết nối station-service' },
        })
        throw Object.assign(new Error('Lỗi kết nối station-service, vui lòng thử lại'), { status: 500 })
      }
      const stationByCode = new Map(freshStations.map(s => [s.stationCode, s]))
      const invalid = validRows.filter(r => {
        const s = stationByCode.get(r.stationCode)
        return !s || !s.isActive
      })
      if (invalid.length > 0) {
        const msg = invalid.map(r => r.stationCode).join(', ')
        await prisma.importJob.update({ where: { id: jobId }, data: { status: 'failed', failureStage: 'station_upsert', retryable: false, errorMessage: `Trạm không hợp lệ tại thời điểm xác nhận: ${msg}` } })
        throw Object.assign(new Error(`Trạm không hợp lệ tại thời điểm xác nhận: ${msg}`), { status: 422 })
      }
      const lookupResults = validRows.map(r => {
        const s = stationByCode.get(r.stationCode)!
        return { station_code: r.stationCode, station_id: s.id, action: 'lookup', warning: null }
      })
      await prisma.importJob.update({ where: { id: jobId }, data: { stationUpsertResults: { results: lookupResults, has_errors: false } as unknown as object } })
    }
  }

  // Step 4: COMMIT FUEL
  const updatedJob = await prisma.importJob.findUnique({ where: { id: jobId } })!
  const resolvedVersions = (updatedJob?.fuelStateVersionsAtPreview as Record<string, number | null>) || {}
  const upsertResults = (updatedJob?.stationUpsertResults as { results: { station_code: string; station_id: string }[] }) || { results: [] }
  const codeToId = new Map(upsertResults.results.map((r: { station_code: string; station_id: string }) => [r.station_code, r.station_id]))

  const fuelRecords = validRows
    .filter(r => ((r.fuelAdded ?? 0) > 0 || (r.hoursRun ?? 0) > 0))
    .map(r => ({
      station_id: codeToId.get(r.stationCode) || '',
      station_code: r.stationCode,
      recorded_date: new Date(r.recordedDate ?? new Date()).toISOString(),
      fuel_added: r.fuelAdded ?? 0,
      hours_run: r.hoursRun ?? 0,
      notes: r.notes,
    }))
    .filter(r => r.station_id)

  let commitResult: unknown
  try {
    commitResult = await fuelClient.commitImport({
      import_job_id: jobId,
      idempotency_key: job.idempotencyKey,
      fuel_state_versions: resolvedVersions,
      records: fuelRecords,
      committed_by: committedBy,
      source,
    }, userCtx)
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } }).response?.status
    if (status === 409) {
      await prisma.importJob.update({
        where: { id: jobId },
        data: { status: 'failed', failureStage: 'stale_data', retryable: false, errorMessage: 'Dữ liệu nhiên liệu đã thay đổi sau khi preview.' },
      })
      throw Object.assign(new Error('Dữ liệu nhiên liệu đã thay đổi sau khi preview. Vui lòng xuất và preview lại.'), { status: 409 })
    }
    await prisma.importJob.update({
      where: { id: jobId },
      data: { status: 'failed', failureStage: 'fuel_commit', retryable: true, errorMessage: 'Lỗi commit nhiên liệu' },
    })
    throw Object.assign(new Error('Lỗi commit nhiên liệu, vui lòng thử lại'), { status: 500 })
  }

  // Step 5: Mark committed
  await prisma.importJob.update({
    where: { id: jobId },
    data: { status: 'committed', committedAt: new Date(), committedBy, commitResult: commitResult as object },
  })

  // Step 6: Publish
  await mq.publish('import.committed', { importJobId: jobId, committedBy })

  return { success: true, result: commitResult }
}
