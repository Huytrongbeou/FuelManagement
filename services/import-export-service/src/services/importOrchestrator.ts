import { PrismaClient } from '@prisma/client'
import { parseAndValidate } from './excelValidatorService'
import * as stationClient from '../clients/stationClient'
import * as fuelClient from '../clients/fuelClient'
import * as mq from '../clients/rabbitmq'
import fs from 'fs/promises'

const prisma = new PrismaClient()

export async function previewImport(jobId: string, filePath: string, importDate: Date, createdBy?: string) {
  const [stations, genTypes, fuelStates] = await Promise.all([
    stationClient.getAllStations(),
    stationClient.getAllGeneratorTypes(),
    fuelClient.getAllCurrentStates(),
  ])

  const buffer = await fs.readFile(filePath)

  const rows = await parseAndValidate(buffer, stations, genTypes, importDate)

  const fuelStateMap = new Map(fuelStates.map(s => [s.stationId, s]))

  // Build fuel_state_versions_at_preview keyed by station_code for new stations, station_id for existing
  const versions: Record<string, number | null> = {}
  for (const row of rows) {
    const existing = stations.find(s => s.stationCode === row.stationCode)
    if (existing) {
      const fuelState = fuelStateMap.get(existing.id)
      versions[existing.id] = fuelState ? Number(fuelState.snapshotVersion) : null
    }
    // New stations get resolved to station_id after bulk-upsert in confirm
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

export async function confirmImport(jobId: string, committedBy?: string) {
  const job = await prisma.importJob.findUnique({ where: { id: jobId } })
  if (!job) throw Object.assign(new Error('Import job not found'), { status: 404 })

  // Idempotent
  if (job.status === 'committed') {
    return { already_committed: true, result: job.commitResult }
  }

  // Retry logic
  if (job.status === 'failed') {
    if (!job.retryable) {
      throw Object.assign(new Error('Cần preview lại trước khi thử xác nhận'), { status: 409 })
    }
    // Continue from failure_stage
  } else if (job.status !== 'previewing') {
    throw Object.assign(new Error(`Không thể xác nhận job ở trạng thái "${job.status}"`), { status: 400 })
  }

  const previewRows = (job.previewData as unknown as Array<{
    stationCode: string
    stationName: string
    address: string
    latitude: number | null
    longitude: number | null
    generatorTypeName: string
    consumptionRateExcel: number | null
    maxCapacity: number | null
    fuelAdded: number | null
    hoursRun: number | null
    actualFuel: number | null
    recordedDate: string | null
    notes: string
    isNewStation: boolean
    isNewGeneratorType: boolean
    hasFuelActivity: boolean
    errors: string[]
  }>) || []

  const validRows = previewRows.filter(r => r.errors.length === 0)

  // Step 2: BACKUP (skip if already past this stage)
  if (!job.failureStage || job.failureStage === 'backup') {
    try {
      const [backupStations, backupGenTypes, backupFuelStates] = await Promise.all([
        stationClient.getAllStations(),
        stationClient.getAllGeneratorTypes(),
        fuelClient.getAllCurrentStates(),
      ])
      await prisma.importJob.update({
        where: { id: jobId },
        data: {
          backupStations: backupStations as unknown as object,
          backupGeneratorTypes: backupGenTypes as unknown as object,
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
      address: r.address,
      latitude: r.latitude,
      longitude: r.longitude,
      generator_type_name: r.generatorTypeName,
      consumption_rate: r.consumptionRateExcel,
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

    // Build station_code → station_id map
    const codeToId = new Map(upsertResult.results.map(r => [r.station_code, r.station_id]))

    // Rebuild fuel_state_versions with actual station_ids for new stations
    const versionsAtPreview = (job.fuelStateVersionsAtPreview as Record<string, number | null>) || {}
    const resolvedVersions: Record<string, number | null> = {}

    for (const r of validRows) {
      const stationId = codeToId.get(r.stationCode)
      if (!stationId) continue
      // New station: expected version = null
      // Existing station: use version captured at preview (keyed by station_id)
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
    .filter(r => r.hasFuelActivity && r.recordedDate)
    .map(r => ({
      station_id: codeToId.get(r.stationCode) || '',
      station_code: r.stationCode,
      recorded_date: r.recordedDate!,
      fuel_added: r.fuelAdded ?? 0,
      hours_run: r.hoursRun ?? 0,
      actual_fuel: r.actualFuel,
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
    })
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } }).response?.status
    if (status === 409) {
      await prisma.importJob.update({
        where: { id: jobId },
        data: {
          status: 'failed', failureStage: 'stale_data', retryable: false,
          errorMessage: 'Dữ liệu nhiên liệu đã thay đổi sau khi preview. Vui lòng xuất và preview lại.',
        },
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

  // Step 6: Publish import.committed
  await mq.publish('import.committed', { importJobId: jobId, committedBy })

  return { success: true, result: commitResult }
}
