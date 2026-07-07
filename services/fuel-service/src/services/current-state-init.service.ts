import { prisma } from '../lib/prisma'
import * as calc from '../utils/fuel-calculator'

export interface InitCurrentStateInput {
  stationId: string
  stationCode: string
  consumptionRate: number
  maxCapacity: number
  initialFuel?: number
}

// Idempotent create-if-absent. Called by station-service right after a station is created,
// and by the one-shot backfill script for stations that predate that wiring.
export async function initCurrentState(input: InitCurrentStateInput) {
  const existing = await prisma.currentFuelState.findUnique({ where: { stationId: input.stationId } })
  if (existing) {
    return { created: false, currentState: existing }
  }

  const initialFuel = Number(input.initialFuel ?? 0)
  if (!Number.isFinite(initialFuel) || initialFuel < 0) {
    throw Object.assign(new Error('initialFuel không hợp lệ'), { status: 400 })
  }
  if (initialFuel > input.maxCapacity) {
    throw Object.assign(new Error('initialFuel vượt dung tích tối đa'), { status: 400 })
  }
  const fuelStatus = calc.determineFuelStatus(initialFuel) as calc.FuelStatus

  try {
    const currentState = await prisma.$transaction(async (tx) => {
      // Genesis record gives lastRecordId a real row to point to and leaves an audit trail
      // for the initial value — CurrentFuelState.lastRecordId is NOT NULL by schema.
      const genesisRecord = await tx.fuelRecord.create({
        data: {
          stationId: input.stationId,
          stationCode: input.stationCode,
          recordedDate: new Date(),
          fuelBefore: 0,
          fuelAdded: initialFuel,
          hoursRun: 0,
          consumptionRate: input.consumptionRate,
          maxCapacity: input.maxCapacity,
          fuelConsumed: 0,
          fuelCalculated: initialFuel,
          actualFuel: null,
          fuelAfter: initialFuel,
          fuelDifference: null,
          fuelStatus,
          notes: 'Khởi tạo tồn ban đầu',
          source: 'initial_state',
        },
      })

      return tx.currentFuelState.create({
        data: {
          stationId: input.stationId,
          stationCode: input.stationCode,
          currentFuel: initialFuel,
          fuelStatus,
          lastUpdated: new Date(),
          lastRecordId: genesisRecord.id,
          snapshotVersion: 0,
        },
      })
    })
    return { created: true, currentState }
  } catch (e: unknown) {
    if ((e as { code?: string }).code === 'P2002') {
      // Race: concurrent init for the same station — idempotent, return the winner's state.
      const current = await prisma.currentFuelState.findUnique({ where: { stationId: input.stationId } })
      return { created: false, currentState: current }
    }
    throw e
  }
}
