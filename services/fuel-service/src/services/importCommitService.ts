import { prisma, findCurrentState, findImportCommit } from '../repositories/fuelRepository'
import * as calc from '../utils/fuelCalculator'
import * as stationClient from '../clients/stationClient'
import * as mq from '../clients/rabbitmq'

interface ImportRecordRow {
  station_id: string
  station_code: string
  recorded_date: string
  fuel_added: number
  hours_run: number
  actual_fuel: number | null
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
  // Idempotency check
  const existing = await findImportCommit(input.idempotency_key)
  if (existing) {
    return existing.result as object
  }

  const affectedStationIds: string[] = []

  // Build fuel rows with server-side fuel_before and DB-sourced rates
  const rows = await Promise.all(input.records.map(async (row) => {
    const station = await stationClient.getStation(row.station_id)
    if (!station.isActive) {
      throw Object.assign(
        new Error(`Trạm ${row.station_code} đã bị vô hiệu hóa, không thể nhập nhiên liệu`),
        { status: 400 }
      )
    }
    const currentState = await findCurrentState(row.station_id)

    const expectedVersion = input.fuel_state_versions[row.station_id]

    // Optimistic concurrency check
    if (currentState) {
      const dbVersion = Number(currentState.snapshotVersion)
      if (expectedVersion === null || dbVersion !== expectedVersion) {
        throw Object.assign(
          new Error(`Dữ liệu nhiên liệu của trạm ${row.station_code} đã thay đổi sau khi preview`),
          { status: 409 }
        )
      }
    } else {
      if (expectedVersion !== null) {
        throw Object.assign(
          new Error(`Dữ liệu nhiên liệu của trạm ${row.station_code} đã thay đổi sau khi preview`),
          { status: 409 }
        )
      }
    }

    let fuelBefore: number
    if (currentState) {
      fuelBefore = Number(currentState.currentFuel)
    } else {
      if (row.actual_fuel == null) {
        throw Object.assign(
          new Error(`Trạm mới ${row.station_code} cần nhập Nhiên liệu tồn ban đầu`),
          { status: 400 }
        )
      }
      fuelBefore = 0
    }

    const consumptionRate = Number(station.consumptionRate)
    const maxCapacity = Number(station.maxCapacity)
    const fuelConsumed = calc.calculateFuelConsumed(row.hours_run, consumptionRate)
    const fuelCalculated = calc.calculateFuelResult(fuelBefore, row.fuel_added, fuelConsumed)
    const fuelAfter = calc.resolveFinalFuel(fuelCalculated, row.actual_fuel)
    const fuelDifference = calc.computeDifference(row.actual_fuel, fuelCalculated)
    const fuelStatus = calc.determineFuelStatus(fuelAfter) as calc.FuelStatus

    if (fuelAfter < 0) throw Object.assign(new Error(`Trạm ${row.station_code}: nhiên liệu sau không thể âm`), { status: 400 })
    if (fuelAfter > maxCapacity) throw Object.assign(new Error(`Trạm ${row.station_code}: nhiên liệu sau vượt dung tích tối đa`), { status: 400 })

    affectedStationIds.push(row.station_id)
    return { row, fuelBefore, consumptionRate, maxCapacity, fuelConsumed, fuelCalculated, fuelAfter, fuelDifference, fuelStatus, isNew: !currentState }
  }))

  // All-or-nothing transaction
  await prisma.$transaction(async (tx) => {
    for (const r of rows) {
      const newRecord = await tx.fuelRecord.create({
        data: {
          stationId: r.row.station_id,
          stationCode: r.row.station_code,
          recordedDate: new Date(r.row.recorded_date),
          fuelBefore: r.fuelBefore,
          fuelAdded: r.row.fuel_added,
          hoursRun: r.row.hours_run,
          consumptionRate: r.consumptionRate,
          maxCapacity: r.maxCapacity,
          fuelConsumed: r.fuelConsumed,
          fuelCalculated: r.fuelCalculated,
          actualFuel: r.row.actual_fuel,
          fuelAfter: r.fuelAfter,
          fuelDifference: r.fuelDifference,
          fuelStatus: r.fuelStatus,
          notes: r.row.notes,
          recordedBy: input.committed_by,
          source: input.source || 'import',
          importJobId: input.import_job_id,
        },
      })

      if (r.isNew) {
        await tx.currentFuelState.create({
          data: {
            stationId: r.row.station_id,
            stationCode: r.row.station_code,
            currentFuel: r.fuelAfter,
            fuelStatus: r.fuelStatus,
            lastUpdated: new Date(),
            lastRecordId: newRecord.id,
            snapshotVersion: 1,
          },
        })
      } else {
        await tx.currentFuelState.update({
          where: { stationId: r.row.station_id },
          data: {
            currentFuel: r.fuelAfter,
            fuelStatus: r.fuelStatus,
            lastUpdated: new Date(),
            lastRecordId: newRecord.id,
            snapshotVersion: { increment: 1 },
          },
        })
      }
    }
  })

  const result = { rows_committed: rows.length, affected_station_ids: affectedStationIds }

  await prisma.fuelImportCommit.create({
    data: {
      importJobId: input.import_job_id,
      idempotencyKey: input.idempotency_key,
      status: 'committed',
      committedAt: new Date(),
      rowsCommitted: rows.length,
      result,
    },
  })

  await mq.publish('fuel.records.committed', { importJobId: input.import_job_id, affectedStationIds })
  return result
}
