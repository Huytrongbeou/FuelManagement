import { PrismaClient } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'
import * as stationClient from '../clients/stationClient'
import * as fuelClient from '../clients/fuelClient'
import { confirmImport } from './importOrchestrator'
import type { ParsedRow } from './excelValidatorService'

const prisma = new PrismaClient()

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
  actualFuel?: number | null
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
  const hasFuelActivity = row.fuelAdded != null || row.hoursRun != null || row.actualFuel != null
  if (isNewStation && hasFuelActivity && row.actualFuel == null) {
    errors.push('Trạm mới cần nhập Nhiên liệu tồn ban đầu')
  }

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
    actualFuel: row.actualFuel ?? null,
    recordedDate,
    notes: row.notes || '',
    isNewStation,
    hasFuelActivity,
    errors,
    warnings,
  }
}

export async function preview(rows: DirectEntryRow[], createdBy?: string) {
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
  for (const row of parsedRows) {
    const existing = stations.find(s => s.stationCode === row.stationCode)
    if (existing) {
      const fuelState = fuelStateMap.get(existing.id)
      versions[existing.id] = fuelState ? Number(fuelState.snapshotVersion) : null
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

export async function confirm(jobId: string, committedBy?: string) {
  return confirmImport(jobId, { committedBy, source: 'direct' })
}
