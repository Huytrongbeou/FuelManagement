import { PrismaClient } from '@prisma/client'
import { parseAndValidate } from './excelValidatorService'
import * as stationClient from '../clients/stationClient'
import * as fuelClient from '../clients/fuelClient'
import * as mq from '../clients/rabbitmq'
import fs from 'fs/promises'

const prisma = new PrismaClient()

export async function previewImport(jobId: string, filePath: string, importDate: Date, createdBy?: string) {
  const [stations, fuelStates] = await Promise.all([
    stationClient.getAllStations({ active: 'all' }),
    fuelClient.getAllCurrentStates(),
  ])

  const buffer = await fs.readFile(filePath)
  const rows = await parseAndValidate(buffer, stations, importDate)

  const fuelStateMap = new Map(fuelStates.map(s => [s.stationId, s]))

  const versions: Record<string, number | null> = {}
  for (const row of rows) {
    const existing = stations.find(s => s.stationCode === row.stationCode)
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

  return { totalRows, validRows, invalidRows, warningRows, rows }
}

export async function confirmImport(
  jobId: string,
  opts: { committedBy?: string; source?: string } = {}
) {
  const { committedBy, source = 'import' } = opts
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

  // Step 3: UPSERT STATIONS
  if (!job.failureStage || job.failureStage === 'backup' || job.failureStage === 'station_upsert') {
    const upsertRows = validRows.map(r => ({
      station_code: r.stationCode,
      station_name: r.stationName,
      generator_name: r.generatorName,
      address: r.address,
      latitude: r.latitude,
      longitude: r.longitude,
      current_admin_unit_name: r.currentAdminUnitName,
      legacy_area_name: r.legacyAreaName,
      operation_area_name: r.operationAreaName,
      brand_name: r.brandName,
      model_name: r.modelName,
      power_kva: r.powerKva,
      fuel_type: r.fuelType,
      consumption_rate: r.consumptionRate,
      max_capacity: r.maxCapacity,
    }))

    let upsertResult: Awaited<ReturnType<typeof stationClient.bulkUpsert>>
    try {
      upsertResult = await stationClient.bulkUpsert(upsertRows)
    } catch {
      await prisma.importJob.update({
        where: { id: jobId },
        data: { status: 'failed', failureStage: 'station_upsert', retryable: true, errorMessage: 'Lỗi kết nối station-service' },
      })
      throw Object.assign(new Error('Lỗi kết nối station-service, vui lòng thử lại'), { status: 500 })
    }

    await prisma.importJob.update({
      where: { id: jobId },
      data: { stationUpsertResults: upsertResult as unknown as object },
    })

    if (upsertResult.has_errors) {
      await prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: 'failed', failureStage: 'station_upsert', retryable: true,
          errorMessage: (upsertResult.errors || []).join('; '),
        },
      })
      throw Object.assign(new Error('Cập nhật trạm thất bại: ' + (upsertResult.errors || []).join('; ')), { status: 422 })
    }

    const codeToId = new Map(upsertResult.results.map(r => [r.station_code, r.station_id]))
    const versionsAtPreview = (job.fuelStateVersionsAtPreview as Record<string, number | null>) || {}
    const resolvedVersions: Record<string, number | null> = {}

    for (const r of validRows) {
      const stationId = codeToId.get(r.stationCode)
      if (!stationId) continue
      resolvedVersions[stationId] = r.isNewStation ? null : (versionsAtPreview[stationId] ?? null)
    }

    await prisma.importJob.update({
      where: { id: jobId },
      data: { fuelStateVersionsAtPreview: resolvedVersions as unknown as object },
    })
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
      recorded_date: (r.recordedDate ?? new Date()).toISOString(),
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
    })
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
