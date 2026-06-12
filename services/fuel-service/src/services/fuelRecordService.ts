import { prisma, findCurrentState } from '../repositories/fuelRepository'
import * as calc from '../utils/fuelCalculator'
import * as stationClient from '../clients/stationClient'
import * as mq from '../clients/rabbitmq'

interface ManualRecordInput {
  stationId: string
  stationCode: string
  recordedDate: string
  fuelAdded: number
  hoursRun: number
  actualFuel: number | null
  notes?: string
  recordedBy?: string
}

export async function createManualRecord(input: ManualRecordInput) {
  const station = await stationClient.getStation(input.stationId)
  const currentState = await findCurrentState(input.stationId)

  let fuelBefore: number
  if (currentState) {
    fuelBefore = Number(currentState.currentFuel)
  } else {
    if (input.actualFuel == null) {
      throw Object.assign(
        new Error('Trạm chưa có dữ liệu nhiên liệu. Vui lòng nhập Nhiên liệu tồn ban đầu.'),
        { status: 400 }
      )
    }
    fuelBefore = 0
  }

  const consumptionRate = Number(station.generatorType.consumptionRate)
  const maxCapacity = Number(station.maxCapacity)
  const fuelConsumed = calc.calculateFuelConsumed(input.hoursRun, consumptionRate)
  const fuelCalculated = calc.calculateFuelResult(fuelBefore, input.fuelAdded, fuelConsumed)
  const fuelAfter = calc.resolveFinalFuel(fuelCalculated, input.actualFuel)
  const fuelDifference = calc.computeDifference(input.actualFuel, fuelCalculated)
  const fuelStatus = calc.determineFuelStatus(fuelAfter) as calc.FuelStatus

  if (fuelAfter < 0) throw Object.assign(new Error('Nhiên liệu sau không thể âm'), { status: 400 })
  if (fuelAfter > maxCapacity) throw Object.assign(new Error('Nhiên liệu sau vượt dung tích tối đa'), { status: 400 })

  const expectedVersion = currentState ? currentState.snapshotVersion : null

  const record = await prisma.$transaction(async (tx) => {
    const newRecord = await tx.fuelRecord.create({
      data: {
        stationId: input.stationId,
        stationCode: input.stationCode,
        recordedDate: new Date(input.recordedDate),
        fuelBefore,
        fuelAdded: input.fuelAdded,
        hoursRun: input.hoursRun,
        consumptionRate,
        maxCapacity,
        fuelConsumed,
        fuelCalculated,
        actualFuel: input.actualFuel,
        fuelAfter,
        fuelDifference,
        fuelStatus,
        notes: input.notes,
        recordedBy: input.recordedBy,
        source: 'manual',
      },
    })

    await tx.currentFuelState.upsert({
      where: { stationId: input.stationId },
      create: {
        stationId: input.stationId,
        stationCode: input.stationCode,
        currentFuel: fuelAfter,
        fuelStatus,
        lastUpdated: new Date(),
        lastRecordId: newRecord.id,
        snapshotVersion: 1,
      },
      update: {
        currentFuel: fuelAfter,
        fuelStatus,
        lastUpdated: new Date(),
        lastRecordId: newRecord.id,
        snapshotVersion: { increment: 1 },
        ...(expectedVersion !== null && {
          // optimistic concurrency enforced via WHERE clause below
        }),
      },
    })

    // Verify optimistic concurrency for existing state
    if (expectedVersion !== null) {
      const updated = await tx.currentFuelState.findUnique({ where: { stationId: input.stationId } })
      if (!updated || updated.snapshotVersion !== expectedVersion + 1n) {
        throw Object.assign(new Error('Concurrent update detected'), { status: 409 })
      }
    }

    return newRecord
  })

  await mq.publish('fuel.record.created', { stationId: input.stationId, stationCode: input.stationCode, fuelAfter, fuelStatus })
  return record
}
