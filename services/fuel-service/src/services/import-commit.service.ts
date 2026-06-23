import { prisma, findImportCommit } from '../repositories/fuel-record.repository'
import * as calc from '../utils/fuel-calculator'
import * as stationClient from '../clients/station.client'
import * as mq from '../clients/rabbitmq'
import { auditLog } from '../utils/audit-log'

interface ImportRecordRow {
  station_id: string
  station_code: string
  recorded_date: string
  fuel_added: number
  hours_run: number
  notes?: string
}

interface ImportCommitInput {
  import_job_id: string
  idempotency_key: string
  fuel_state_versions: Record<string, number | null>
  records: ImportRecordRow[]
  committed_by?: string
  source?: string
}

export async function commitImport(input: ImportCommitInput) {
  // Idempotency check — BEFORE everything else
  const existing = await findImportCommit(input.idempotency_key)
  if (existing) {
    return existing.result as object
  }

  // Validate numeric fields — reject NaN/Infinity before any DB work
  for (const r of input.records) {
    if (!Number.isFinite(r.fuel_added) || r.fuel_added < 0)
      throw Object.assign(new Error(`Giá trị lượng nhiên liệu không hợp lệ cho trạm ${r.station_code}.`), { status: 400 })
    if (!Number.isFinite(r.hours_run) || r.hours_run < 0)
      throw Object.assign(new Error(`Giá trị số giờ chạy không hợp lệ cho trạm ${r.station_code}.`), { status: 400 })
  }

  // Batch fetch all unique stations + isActive check — OUTSIDE tx (HTTP call)
  const uniqueIds = [...new Set(input.records.map(r => r.station_id))]
  const stationsArr = await Promise.all(uniqueIds.map(id => stationClient.getStation(id)))
  const stationMap = new Map(stationsArr.map(s => [s.id, s]))

  for (const [, station] of stationMap) {
    if (!station.isActive) {
      throw Object.assign(
        new Error(`Trạm ${station.stationCode} đã bị vô hiệu hóa, không thể nhập nhiên liệu`),
        { status: 400 }
      )
    }
  }

  // Group records by stationId; sort by recordedDate ascending within each station
  const byStation = new Map<string, ImportRecordRow[]>()
  for (const r of input.records) {
    if (!byStation.has(r.station_id)) byStation.set(r.station_id, [])
    byStation.get(r.station_id)!.push(r)
  }
  for (const rows of byStation.values()) {
    rows.sort((a, b) => new Date(a.recorded_date).getTime() - new Date(b.recorded_date).getTime())
  }

  const affectedStationIds: string[] = []
  const totalRowsCommitted = input.records.length

  // All-or-nothing transaction
  await prisma.$transaction(async (tx) => {
    for (const [stationId, rows] of byStation) {
      const station = stationMap.get(stationId)!
      const consumptionRate = Number(station.consumptionRate)
      const maxCapacity = Number(station.maxCapacity)
      const expectedVersion = input.fuel_state_versions[stationId]

      // Fetch current state INSIDE tx (serializable read — locks the row)
      const currentState = await tx.currentFuelState.findUnique({ where: { stationId } })

      // Version guard ONCE per station (not per row)
      if (currentState) {
        const dbVersion = Number(currentState.snapshotVersion)
        if (expectedVersion === null || dbVersion !== expectedVersion) {
          throw Object.assign(
            new Error(`Dữ liệu nhiên liệu trạm ${rows[0].station_code} đã thay đổi sau preview, vui lòng preview lại`),
            { status: 409 }
          )
        }
      } else {
        if (expectedVersion !== null) {
          throw Object.assign(
            new Error(`Dữ liệu nhiên liệu trạm ${rows[0].station_code} đã thay đổi sau preview, vui lòng preview lại`),
            { status: 409 }
          )
        }
      }

      // Chain rows: fuelBefore[n] = fuelAfter[n-1]
      let runningFuel = currentState ? Number(currentState.currentFuel) : 0
      let lastRecordId: string | null = null

      for (const row of rows) {
        const fuelBefore = runningFuel
        const fuelConsumed = calc.calculateFuelConsumed(row.hours_run, consumptionRate)
        const fuelAfter = calc.calculateFuelResult(fuelBefore, row.fuel_added, fuelConsumed)
        const fuelStatus = calc.determineFuelStatus(fuelAfter) as calc.FuelStatus

        // Validate INSIDE tx — any failure rolls back entire batch
        if (fuelAfter < 0) {
          throw Object.assign(
            new Error(`Trạm ${row.station_code}: nhiên liệu sau không thể âm`),
            { status: 400 }
          )
        }
        if (fuelAfter > maxCapacity) {
          throw Object.assign(
            new Error(`Trạm ${row.station_code}: nhiên liệu sau vượt dung tích tối đa`),
            { status: 400 }
          )
        }

        const newRecord = await tx.fuelRecord.create({
          data: {
            stationId,
            stationCode: row.station_code,
            recordedDate: new Date(row.recorded_date),
            fuelBefore,
            fuelAdded: row.fuel_added,
            hoursRun: row.hours_run,
            consumptionRate,
            maxCapacity,
            fuelConsumed,
            fuelCalculated: fuelAfter,
            actualFuel: null,
            fuelAfter,
            fuelDifference: null,
            fuelStatus,
            notes: row.notes,
            recordedBy: input.committed_by,
            source: input.source || 'import',
            importJobId: input.import_job_id,
          },
        })
        lastRecordId = newRecord.id
        runningFuel = fuelAfter
      }

      const finalFuelStatus = calc.determineFuelStatus(runningFuel) as calc.FuelStatus

      // Update/create currentFuelState ONCE per station after all rows chain completes
      if (currentState) {
        const updated = await tx.currentFuelState.updateMany({
          where: { stationId, snapshotVersion: expectedVersion! },
          data: {
            currentFuel: runningFuel,
            fuelStatus: finalFuelStatus,
            lastUpdated: new Date(),
            lastRecordId: lastRecordId!,
            snapshotVersion: { increment: rows.length },
          },
        })
        if (updated.count === 0) {
          throw Object.assign(
            new Error(`Dữ liệu nhiên liệu trạm ${rows[0].station_code} đã thay đổi sau preview, vui lòng preview lại`),
            { status: 409 }
          )
        }
      } else {
        try {
          await tx.currentFuelState.create({
            data: {
              stationId,
              stationCode: rows[0].station_code,
              currentFuel: runningFuel,
              fuelStatus: finalFuelStatus,
              lastUpdated: new Date(),
              lastRecordId: lastRecordId!,
              snapshotVersion: rows.length,
            },
          })
        } catch (e: unknown) {
          // P2002 = unique constraint — two concurrent first-time imports racing
          if ((e as { code?: string }).code === 'P2002') {
            throw Object.assign(
              new Error(`Dữ liệu nhiên liệu trạm ${rows[0].station_code} đã thay đổi sau preview, vui lòng preview lại`),
              { status: 409 }
            )
          }
          throw e
        }
      }

      affectedStationIds.push(stationId)
    }

    // fuelImportCommit.create INSIDE tx — atomic with fuel records + state updates
    // Prevents duplicate FuelRecords on retry if crash occurs between tx commit and post-tx record creation
    await tx.fuelImportCommit.create({
      data: {
        importJobId: input.import_job_id,
        idempotencyKey: input.idempotency_key,
        status: 'committed',
        committedAt: new Date(),
        rowsCommitted: totalRowsCommitted,
        result: { rows_committed: totalRowsCommitted, affected_station_ids: affectedStationIds },
      },
    })
  })

  const result = { rows_committed: totalRowsCommitted, affected_station_ids: affectedStationIds }

  auditLog({
    action: 'import_confirm',
    jobId: input.import_job_id,
    committedBy: input.committed_by,
    rowsCommitted: totalRowsCommitted,
    affectedStations: affectedStationIds.length,
    result: 'success',
  })

  try {
    await mq.publish('fuel.records.committed', { importJobId: input.import_job_id, affectedStationIds })
  } catch (e) {
    console.warn('[import-commit] RabbitMQ publish failed (non-fatal):', e)
  }

  return result
}
