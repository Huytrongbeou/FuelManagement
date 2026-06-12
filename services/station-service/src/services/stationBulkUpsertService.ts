import { PrismaClient } from '@prisma/client'
import type { BulkUpsertRow, BulkUpsertResult } from '../models/station'
import * as genTypeRepo from '../repositories/generatorTypeRepository'

const prisma = new PrismaClient()

export async function bulkUpsert(rows: BulkUpsertRow[]): Promise<{
  success: boolean
  results: BulkUpsertResult[]
  has_errors: boolean
  errors?: string[]
}> {
  const errors: string[] = []
  const results: BulkUpsertResult[] = []

  // Pre-validate all rows and resolve generator types BEFORE transaction
  type ResolvedRow = BulkUpsertRow & {
    resolvedGeneratorTypeId: string
    resolvedConsumptionRate: number
    warning: string | null
    existingStationId: string | null
  }

  const resolved: ResolvedRow[] = []

  for (const row of rows) {
    if (!row.station_code || row.station_code.length > 50) {
      errors.push(`${row.station_code || '(blank)'}: station_code must be 1-50 characters`)
      continue
    }

    let genType = await genTypeRepo.findByName(row.generator_type_name)
    let warning: string | null = null

    if (!genType) {
      // New generator type — consumption_rate required
      if (row.consumption_rate == null || row.consumption_rate <= 0) {
        errors.push(`${row.station_code}: New generator type "${row.generator_type_name}" requires a valid consumption_rate > 0`)
        continue
      }
      // Will be created in transaction
    } else {
      // Existing type — check consumption_rate conflict
      const dbRate = Number(genType.consumptionRate)
      if (row.consumption_rate != null && Math.abs(row.consumption_rate - dbRate) > 0.0005) {
        warning = `Định mức ${row.generator_type_name} trong Excel (${row.consumption_rate} L/giờ) khác hệ thống (${dbRate} L/giờ). Dùng định mức hệ thống.`
      }
    }

    if (row.max_capacity != null && row.max_capacity <= 0) {
      errors.push(`${row.station_code}: max_capacity must be > 0`)
      continue
    }

    const existingStation = await prisma.station.findUnique({ where: { stationCode: row.station_code } })

    resolved.push({
      ...row,
      resolvedGeneratorTypeId: genType?.id ?? '',  // placeholder; resolved in tx if new type
      resolvedConsumptionRate: genType ? Number(genType.consumptionRate) : (row.consumption_rate ?? 0),
      warning,
      existingStationId: existingStation?.id ?? null,
    })
  }

  if (errors.length > 0) {
    return { success: false, results: [], has_errors: true, errors }
  }

  // All-or-nothing transaction
  try {
    await prisma.$transaction(async (tx) => {
      for (const row of resolved) {
        // Create generator type if new
        let genTypeId = row.resolvedGeneratorTypeId
        if (!genTypeId) {
          const created = await tx.generatorType.create({
            data: {
              typeName: row.generator_type_name,
              consumptionRate: row.resolvedConsumptionRate,
            },
          })
          genTypeId = created.id
        }

        if (row.existingStationId) {
          // Update existing station
          const updateData: Record<string, unknown> = { generatorTypeId: genTypeId }
          if (row.station_name != null) updateData.stationName = row.station_name
          if (row.address != null) updateData.address = row.address
          if (row.latitude != null) updateData.latitude = row.latitude
          if (row.longitude != null) updateData.longitude = row.longitude
          if (row.max_capacity != null) updateData.maxCapacity = row.max_capacity

          await tx.station.update({ where: { id: row.existingStationId }, data: updateData })
          results.push({ station_code: row.station_code, station_id: row.existingStationId, action: 'updated', warning: row.warning })
        } else {
          // Create new station
          if (!row.station_name) throw new Error(`${row.station_code}: station_name required for new station`)
          if (!row.max_capacity || row.max_capacity <= 0) throw new Error(`${row.station_code}: max_capacity required for new station`)

          const created = await tx.station.create({
            data: {
              stationCode: row.station_code,
              stationName: row.station_name,
              address: row.address,
              latitude: row.latitude,
              longitude: row.longitude,
              generatorTypeId: genTypeId,
              maxCapacity: row.max_capacity,
            },
          })
          results.push({ station_code: row.station_code, station_id: created.id, action: 'created', warning: row.warning })
        }
      }
    })
  } catch (err: unknown) {
    return {
      success: false,
      results: [],
      has_errors: true,
      errors: [(err as Error).message],
    }
  }

  return { success: true, results, has_errors: false }
}
