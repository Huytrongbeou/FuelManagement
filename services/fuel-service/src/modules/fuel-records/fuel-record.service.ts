import { prisma, findCurrentState } from './fuel-record.repository'
import * as calc from '../../shared/utils/fuel-calculator'
import * as stationClient from '../../shared/clients/station.client'
import * as mq from '../../shared/clients/rabbitmq'

interface ManualRecordInput {
  stationId: string
  stationCode: string
  recordedDate: string
  fuelAdded: number
  hoursRun: number
  notes?: string
  recordedBy?: string
}

export async function createManualRecord(input: ManualRecordInput) {
  const station = await stationClient.getStation(input.stationId)

  if (!station.isActive) {
    throw Object.assign(
      new Error('Trạm đã bị vô hiệu hóa, không thể nhập nhiên liệu'),
      { status: 400 }
    )
  }

  const currentState = await findCurrentState(input.stationId)

  const fuelBefore: number = currentState ? Number(currentState.currentFuel) : 0

  const fuelAddedValue = input.fuelAdded ?? 0
  const hoursRunValue = input.hoursRun ?? 0
  if (fuelAddedValue < 0 || hoursRunValue < 0) {
    throw Object.assign(new Error('Nhiên liệu bổ sung và số giờ chạy không được âm'), { status: 400 })
  }
  if (fuelAddedValue === 0 && hoursRunValue === 0) {
    throw Object.assign(new Error('Không có phát sinh nhiên liệu để cập nhật'), { status: 400 })
  }

  const consumptionRate = Number(station.consumptionRate)
  const maxCapacity = Number(station.maxCapacity)
  const fuelConsumed = calc.calculateFuelConsumed(hoursRunValue, consumptionRate)
  const fuelCalculated = calc.calculateFuelResult(fuelBefore, fuelAddedValue, fuelConsumed)
  const fuelAfter = fuelCalculated
  const fuelDifference = null
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
        fuelAdded: fuelAddedValue,
        hoursRun: hoursRunValue,
        consumptionRate,
        maxCapacity,
        fuelConsumed,
        fuelCalculated,
        actualFuel: null,
        fuelAfter,
        fuelDifference: null,
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
      },
    })

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
