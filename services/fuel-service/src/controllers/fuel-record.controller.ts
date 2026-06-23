import type { Request, Response } from 'express'
import { createManualRecord } from '../services/fuel-record.service'
import { commitImport } from '../services/import-commit.service'
import { findAllCurrentStates, findCurrentState, findRecordsByStation, checkExactDuplicates, previewValidate } from '../repositories/fuel-record.repository'

function toFuelRecordDto(r: Record<string, unknown>) {
  return {
    id: r.id,
    stationId: r.stationId,
    stationCode: r.stationCode,
    date: r.recordedDate,
    previousFuel: r.fuelBefore != null ? Number(r.fuelBefore) : null,
    added: r.fuelAdded != null ? Number(r.fuelAdded) : null,
    hoursRun: r.hoursRun != null ? Number(r.hoursRun) : null,
    consumed: r.fuelConsumed != null ? Number(r.fuelConsumed) : null,
    systemCalculated: r.fuelCalculated != null ? Number(r.fuelCalculated) : null,
    endFuel: r.fuelAfter != null ? Number(r.fuelAfter) : null,
    adjustmentAmount: r.adjustmentAmount != null ? Number(r.adjustmentAmount) : null,
    adjustmentForId: r.adjustmentForId ?? null,
    status: r.fuelStatus,
    source: r.source,
    note: r.notes ?? null,
    createdAt: r.createdAt,
  }
}

function toCurrentStateDto(s: Record<string, unknown>) {
  return {
    stationId: s.stationId,
    stationCode: s.stationCode,
    currentFuel: s.currentFuel != null ? Number(s.currentFuel) : null,
    fuelStatus: s.fuelStatus,
    lastUpdated: s.lastUpdated,
    snapshotVersion: s.snapshotVersion != null ? Number(s.snapshotVersion) : null,
  }
}

function requireFiniteNonNeg(val: unknown, name: string): number {
  const n = Number(val)
  if (!Number.isFinite(n) || n < 0)
    throw Object.assign(new Error(`Giá trị ${name} không hợp lệ.`), { status: 400 })
  return n
}

export async function postRecord(req: Request, res: Response): Promise<void> {
  try {
    const { stationId, stationCode, recordedDate, fuelAdded, hoursRun, notes, recordedBy } = req.body
    if (!stationId || !stationCode || !recordedDate) {
      res.status(400).json({ error: 'stationId, stationCode, recordedDate are required' })
      return
    }
    const record = await createManualRecord({
      stationId, stationCode, recordedDate,
      fuelAdded: requireFiniteNonNeg(fuelAdded ?? 0, 'lượng nhiên liệu'),
      hoursRun: requireFiniteNonNeg(hoursRun ?? 0, 'số giờ chạy'),
      notes, recordedBy,
    })
    res.status(201).json(toFuelRecordDto(record as unknown as Record<string, unknown>))
  } catch (err: unknown) {
    res.status((err as { status?: number }).status || 500).json({ error: (err as Error).message })
  }
}

export async function getRecords(req: Request, res: Response): Promise<void> {
  try {
    const records = await findRecordsByStation(req.params.station_id, {
      limit: req.query.limit ? Number(req.query.limit) : undefined,
      offset: req.query.offset ? Number(req.query.offset) : undefined,
      from: req.query.from as string | undefined,
      to: req.query.to as string | undefined,
    })
    res.json(records.map(r => toFuelRecordDto(r as unknown as Record<string, unknown>)))
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

export async function getAllCurrentStates(_req: Request, res: Response): Promise<void> {
  try {
    const states = await findAllCurrentStates()
    res.json(states.map(s => toCurrentStateDto(s as unknown as Record<string, unknown>)))
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

export async function getCurrentState(req: Request, res: Response): Promise<void> {
  try {
    const state = await findCurrentState(req.params.station_id)
    if (!state) { res.status(404).json({ error: 'No fuel data for this station' }); return }
    res.json(toCurrentStateDto(state as unknown as Record<string, unknown>))
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

export async function postPreviewValidate(req: Request, res: Response): Promise<void> {
  try {
    const items = req.body
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'items array is required and must not be empty' })
      return
    }
    const parsed = items.map((item: unknown) => {
      const i = item as Record<string, unknown>
      return {
        stationId: String(i.stationId ?? ''),
        fuelAdded: Number(i.fuelAdded ?? 0),
        hoursRun: Number(i.hoursRun ?? 0),
        consumptionRate: Number(i.consumptionRate ?? 0),
        maxCapacity: Number(i.maxCapacity ?? 0),
      }
    })
    const result = await previewValidate(parsed)
    res.json(result)
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

export async function postCheckExactDuplicates(req: Request, res: Response): Promise<void> {
  try {
    const items = req.body
    if (!Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'items array is required and must not be empty' })
      return
    }
    const parsed = items.map((item: unknown) => {
      const i = item as Record<string, unknown>
      return {
        stationId: String(i.stationId ?? ''),
        recordedDate: new Date(i.recordedDate as string),
        fuelAdded: Number(i.fuelAdded ?? 0),
        hoursRun: Number(i.hoursRun ?? 0),
      }
    })
    const result = await checkExactDuplicates(parsed)
    res.json(result)
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

export async function postImportCommit(req: Request, res: Response): Promise<void> {
  try {
    const result = await commitImport(req.body)
    res.json(result)
  } catch (err: unknown) {
    const status = (err as { status?: number }).status || 500
    res.status(status).json({ error: (err as Error).message })
  }
}
