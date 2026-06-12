import type { Request, Response } from 'express'
import { createManualRecord } from '../services/fuelRecordService'
import { commitImport } from '../services/importCommitService'
import { findAllCurrentStates, findCurrentState, findRecordsByStation } from '../repositories/fuelRepository'

export async function postRecord(req: Request, res: Response): Promise<void> {
  try {
    const { stationId, stationCode, recordedDate, fuelAdded, hoursRun, actualFuel, notes, recordedBy } = req.body
    if (!stationId || !stationCode || !recordedDate) {
      res.status(400).json({ error: 'stationId, stationCode, recordedDate are required' })
      return
    }
    const record = await createManualRecord({
      stationId, stationCode, recordedDate,
      fuelAdded: Number(fuelAdded ?? 0),
      hoursRun: Number(hoursRun ?? 0),
      actualFuel: actualFuel != null ? Number(actualFuel) : null,
      notes, recordedBy,
    })
    res.status(201).json(record)
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
    res.json(records)
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

export async function getAllCurrentStates(_req: Request, res: Response): Promise<void> {
  try {
    res.json(await findAllCurrentStates())
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

export async function getCurrentState(req: Request, res: Response): Promise<void> {
  try {
    const state = await findCurrentState(req.params.station_id)
    if (!state) { res.status(404).json({ error: 'No fuel data for this station' }); return }
    res.json(state)
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
