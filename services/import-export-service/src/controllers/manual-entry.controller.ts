import type { Request, Response } from 'express'
import { preview, confirm } from '../services/manual-entry.service'
import type { UserContext } from '../clients/fuel.client'

function extractUserCtx(req: Request): UserContext {
  return {
    userId: req.headers['x-user-id'] as string | undefined,
    userRole: req.headers['x-user-role'] as string | undefined,
    userName: req.headers['x-user-name'] as string | undefined,
  }
}

export async function previewHandler(req: Request, res: Response): Promise<void> {
  try {
    const { rows } = req.body
    if (!Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: 'rows array is required and must not be empty' })
      return
    }
    const ctx = extractUserCtx(req)
    const result = await preview(rows, ctx.userName, ctx)
    res.status(201).json(result)
  } catch (err: unknown) {
    res.status((err as { status?: number }).status || 500).json({ error: (err as Error).message })
  }
}

export async function confirmHandler(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.body
    if (!jobId) {
      res.status(400).json({ error: 'jobId is required' })
      return
    }
    const ctx = extractUserCtx(req)
    const result = await confirm(jobId, ctx.userName, ctx)
    res.json(result)
  } catch (err: unknown) {
    res.status((err as { status?: number }).status || 500).json({ error: (err as Error).message })
  }
}
