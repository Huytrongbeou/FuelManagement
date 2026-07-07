import type { BulkUpsertRow, BulkUpsertResult } from '../models/station.types'
import * as brandRepo from '../repositories/generator-brand.repository'
import * as modelRepo from '../repositories/generator-model.repository'
import * as fuelClient from '../clients/fuel.client'
import type { UserContext } from '../clients/fuel.client'
import { prisma } from '../lib/prisma'

async function findOrCreateBrand(name: string): Promise<string> {
  const normalized = name.trim().toLowerCase()
  const existing = await prisma.generatorBrand.findUnique({ where: { normalizedName: normalized } })
  if (existing) return existing.id
  const created = await prisma.generatorBrand.create({
    data: { name: name.trim(), normalizedName: normalized },
  })
  return created.id
}

async function findOrCreateModel(
  brandId: string,
  modelName: string,
  hints: { powerKva?: number | null; fuelType?: string | null; consumptionRate?: number | null; maxCapacity?: number | null }
): Promise<{ id: string; warning: string | null }> {
  const normalizedModelName = modelName.trim().toLowerCase()
  const existing = await prisma.generatorModel.findUnique({
    where: { brandId_normalizedModelName: { brandId, normalizedModelName } },
  })
  if (existing) return { id: existing.id, warning: null }

  let warning: string | null = null
  if (hints.consumptionRate == null || hints.maxCapacity == null) {
    warning = `Model "${modelName}" mới — thiếu suggestedConsumptionRate hoặc suggestedMaxCapacity`
  }

  const created = await prisma.generatorModel.create({
    data: {
      brandId,
      modelName: modelName.trim(),
      normalizedModelName,
      powerKva: hints.powerKva ?? null,
      fuelType: hints.fuelType ?? 'diesel',
      suggestedConsumptionRate: hints.consumptionRate ?? null,
      suggestedMaxCapacity: hints.maxCapacity ?? null,
    },
  })
  return { id: created.id, warning }
}

export async function bulkUpsert(rows: BulkUpsertRow[], userCtx?: UserContext): Promise<{
  success: boolean
  results: BulkUpsertResult[]
  has_errors: boolean
  errors?: string[]
}> {
  const errors: string[] = []
  const results: BulkUpsertResult[] = []

  type ResolvedRow = BulkUpsertRow & {
    resolvedBrandId: string | null
    resolvedModelId: string | null
    resolvedConsumptionRate: number
    resolvedMaxCapacity: number
    normalizedInitialFuel: number | null
    warning: string | null
    existingStationId: string | null
  }

  const resolved: ResolvedRow[] = []

  for (const row of rows) {
    if (!row.station_code || row.station_code.length > 50) {
      errors.push(`${row.station_code || '(blank)'}: station_code must be 1-50 characters`)
      continue
    }
    if (!row.station_name && !(await prisma.station.findUnique({ where: { stationCode: row.station_code } }))) {
      errors.push(`${row.station_code}: station_name required for new station`)
      continue
    }

    const existingStation = await prisma.station.findUnique({ where: { stationCode: row.station_code } })
    const isNew = !existingStation

    // For new stations, consumptionRate + maxCapacity are required
    if (isNew && (row.consumption_rate == null || row.consumption_rate <= 0)) {
      errors.push(`${row.station_code}: consumptionRate required for new station`)
      continue
    }
    if (isNew && (row.max_capacity == null || row.max_capacity <= 0)) {
      errors.push(`${row.station_code}: maxCapacity required for new station`)
      continue
    }

    if (row.max_capacity != null && row.max_capacity <= 0) {
      errors.push(`${row.station_code}: max_capacity must be > 0`)
      continue
    }
    if (row.consumption_rate != null && row.consumption_rate <= 0) {
      errors.push(`${row.station_code}: consumption_rate must be > 0`)
      continue
    }

    // Resolve brand/model IDs (auto-create if needed)
    let resolvedBrandId: string | null = null
    let resolvedModelId: string | null = null
    let warning: string | null = null

    if (row.brand_name) {
      resolvedBrandId = await findOrCreateBrand(row.brand_name)
      if (row.model_name) {
        const modelResult = await findOrCreateModel(resolvedBrandId, row.model_name, {
          powerKva: row.power_kva,
          fuelType: row.fuel_type,
          consumptionRate: row.consumption_rate,
          maxCapacity: row.max_capacity,
        })
        resolvedModelId = modelResult.id
        if (modelResult.warning) warning = modelResult.warning
      }
    }

    const fallbackRate = existingStation ? Number((existingStation as any).consumptionRate) : (row.consumption_rate ?? 0)
    const fallbackCap = existingStation ? Number((existingStation as any).maxCapacity) : (row.max_capacity ?? 0)
    const resolvedConsumptionRate = row.consumption_rate ?? fallbackRate
    const resolvedMaxCapacity = row.max_capacity ?? fallbackCap

    let normalizedInitialFuel: number | null = null
    if (row.initial_fuel != null) {
      normalizedInitialFuel = Number(row.initial_fuel)
      if (!isNew) {
        const initialFuelWarning = `${row.station_code}: initial_fuel chỉ áp dụng khi tạo trạm mới, bị bỏ qua vì trạm đã tồn tại`
        warning = warning ? `${warning}; ${initialFuelWarning}` : initialFuelWarning
      } else if (!Number.isFinite(normalizedInitialFuel) || normalizedInitialFuel < 0) {
        errors.push(`${row.station_code}: initial_fuel không hợp lệ`)
        continue
      } else if (normalizedInitialFuel > resolvedMaxCapacity) {
        errors.push(`${row.station_code}: initial_fuel vượt quá dung tích tối đa`)
        continue
      }
    }

    resolved.push({
      ...row,
      resolvedBrandId,
      resolvedModelId,
      resolvedConsumptionRate,
      resolvedMaxCapacity,
      normalizedInitialFuel,
      warning,
      existingStationId: existingStation?.id ?? null,
    })
  }

  if (errors.length > 0) {
    return { success: false, results: [], has_errors: true, errors }
  }

  try {
    await prisma.$transaction(async (tx) => {
      for (const row of resolved) {
        if (row.existingStationId) {
          const updateData: Record<string, unknown> = {}
          if (row.station_name != null) updateData.stationName = row.station_name
          if (row.generator_name != null) updateData.generatorName = row.generator_name
          if (row.address != null) updateData.address = row.address
          if (row.latitude != null) updateData.latitude = row.latitude
          if (row.longitude != null) updateData.longitude = row.longitude
          if (row.current_admin_unit_name != null) updateData.currentAdminUnitName = row.current_admin_unit_name
          if (row.legacy_area_name != null) updateData.legacyAreaName = row.legacy_area_name
          if (row.operation_area_name != null) updateData.operationAreaName = row.operation_area_name
          if (row.resolvedBrandId != null) updateData.brandId = row.resolvedBrandId
          if (row.resolvedModelId != null) updateData.modelId = row.resolvedModelId
          if (row.power_kva != null) updateData.powerKva = row.power_kva
          if (row.fuel_type != null) updateData.fuelType = row.fuel_type
          if (row.consumption_rate != null) updateData.consumptionRate = row.consumption_rate
          if (row.max_capacity != null) updateData.maxCapacity = row.max_capacity

          await tx.station.update({ where: { id: row.existingStationId }, data: updateData })
          results.push({ station_code: row.station_code, station_id: row.existingStationId, action: 'updated', warning: row.warning })
        } else {
          const created = await tx.station.create({
            data: {
              stationCode: row.station_code,
              stationName: row.station_name!,
              generatorName: row.generator_name ?? null,
              address: row.address ?? null,
              latitude: row.latitude ?? null,
              longitude: row.longitude ?? null,
              currentAdminUnitName: row.current_admin_unit_name ?? null,
              legacyAreaName: row.legacy_area_name ?? null,
              operationAreaName: row.operation_area_name ?? null,
              brandId: row.resolvedBrandId,
              modelId: row.resolvedModelId,
              powerKva: row.power_kva ?? null,
              fuelType: row.fuel_type ?? 'diesel',
              consumptionRate: row.resolvedConsumptionRate,
              maxCapacity: row.resolvedMaxCapacity,
            },
          })
          results.push({
            station_code: row.station_code,
            station_id: created.id,
            action: 'created',
            warning: row.warning,
            resolvedConsumptionRate: row.resolvedConsumptionRate,
            resolvedMaxCapacity: row.resolvedMaxCapacity,
            initialFuel: row.normalizedInitialFuel ?? 0,
          })
        }
      }
    })
  } catch (err: unknown) {
    return { success: false, results: [], has_errors: true, errors: [(err as Error).message] }
  }

  // Init CurrentFuelState for newly created stations — must read from `results`, not the
  // `resolved` rows, since those are out of scope once the transaction callback has returned.
  for (const r of results) {
    if (r.action !== 'created') continue
    const initResult = await fuelClient.initCurrentState({
      stationId: r.station_id,
      stationCode: r.station_code,
      consumptionRate: r.resolvedConsumptionRate!,
      maxCapacity: r.resolvedMaxCapacity!,
      initialFuel: r.initialFuel ?? 0,
    }, userCtx)

    if (!initResult.ok) {
      r.currentFuelStateInitialized = false
      const initFailWarning = 'Trạm đã tạo nhưng chưa khởi tạo tồn nhiên liệu ban đầu — vui lòng thử lại hoặc liên hệ Admin.'
      r.warning = r.warning ? `${r.warning}; ${initFailWarning}` : initFailWarning
    } else {
      r.currentFuelStateInitialized = true
    }
  }

  return { success: true, results, has_errors: false }
}
