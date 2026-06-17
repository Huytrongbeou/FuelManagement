import type { Request, Response } from 'express'
import { preview, confirm } from './manual-entry.service'

export async function previewHandler(req: Request, res: Response): Promise<void> {
  try {
    const { rows, createdBy } = req.body
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: 'rows array is required and must not be empty' })
      return
    }
    const result = await preview(rows, createdBy)
    res.status(201).json(result)
  } catch (err: unknown) {
    res.status((err as { status?: number }).status || 500).json({ error: (err as Error).message })
  }
}

export async function confirmHandler(req: Request, res: Response): Promise<void> {
  try {
    const { jobId, committedBy } = req.body
    if (!jobId) {
      res.status(400).json({ error: 'jobId is required' })
      return
    }
    const result = await confirm(jobId, committedBy)
    res.json(result)
  } catch (err: unknown) {
    res.status((err as { status?: number }).status || 500).json({ error: (err as Error).message })
  }
}
