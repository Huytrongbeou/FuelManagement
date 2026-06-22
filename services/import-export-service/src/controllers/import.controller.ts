import type { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { previewImport, confirmImport } from '../services/import-orchestrator.service'
import type { UserContext } from '../clients/fuel.client'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'

const prisma = new PrismaClient()

function extractUserCtx(req: Request): UserContext {
  return {
    userId: req.headers['x-user-id'] as string | undefined,
    userRole: req.headers['x-user-role'] as string | undefined,
    userName: req.headers['x-user-name'] as string | undefined,
  }
}

export async function upload(req: Request, res: Response): Promise<void> {
  try {
    const file = (req as Request & { file?: { path: string; originalname: string; size: number } }).file
    if (!file) { res.status(400).json({ error: 'Vui lòng chọn file để upload.' }); return }
    if (file.size === 0) { res.status(400).json({ error: 'File rỗng. Vui lòng kiểm tra lại.' }); return }

    const ctx = extractUserCtx(req)
    const job = await prisma.importJob.create({
      data: {
        idempotencyKey: uuidv4(),
        filename: file.originalname,
        status: 'pending',
      },
    })

    let signatureWarning: { importedAt: Date; importedBy: string | null; filename: string } | null = null
    try {
      const result = await previewImport(job.id, file.path, ctx.userName, ctx)
      signatureWarning = result.signatureWarning
    } catch (err: unknown) {
      const status = (err as { status?: number }).status
      const rawMsg = (err as Error).message || ''
      const isFormatError = /zip|central.?directory|not a zip|jszipexception/i.test(rawMsg)
      const message = (isFormatError || !rawMsg)
        ? 'Không thể đọc file Excel. Vui lòng kiểm tra định dạng file.'
        : rawMsg
      await prisma.importJob.update({ where: { id: job.id }, data: { status: 'failed', errorMessage: message } }).catch(() => undefined)
      res.status(status || 422).json({ error: message })
      return
    }

    const updated = await prisma.importJob.findUnique({ where: { id: job.id } })
    res.status(201).json({ ...updated, signatureWarning: signatureWarning ?? null })
  } catch (err: unknown) {
    res.status((err as { status?: number }).status || 500).json({ error: (err as Error).message })
  }
}

export async function getJob(req: Request, res: Response): Promise<void> {
  try {
    const job = await prisma.importJob.findUnique({ where: { id: req.params.job_id } })
    if (!job) { res.status(404).json({ error: 'Job not found' }); return }
    res.json(job)
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

export async function listJobs(_req: Request, res: Response): Promise<void> {
  try {
    const jobs = await prisma.importJob.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })
    res.json(jobs)
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

export async function confirm(req: Request, res: Response): Promise<void> {
  try {
    const ctx = extractUserCtx(req)
    const result = await confirmImport(req.params.job_id, {
      committedBy: ctx.userName,
      source: 'import',
      userCtx: ctx,
    })
    res.json(result)
  } catch (err: unknown) {
    res.status((err as { status?: number }).status || 500).json({ error: (err as Error).message })
  }
}

export async function cancel(req: Request, res: Response): Promise<void> {
  try {
    const job = await prisma.importJob.findUnique({ where: { id: req.params.job_id } })
    if (!job) { res.status(404).json({ error: 'Job not found' }); return }
    if (job.status === 'committed') { res.status(400).json({ error: 'Cannot cancel committed job' }); return }
    await prisma.importJob.update({ where: { id: req.params.job_id }, data: { status: 'cancelled' } })
    res.json({ success: true })
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
}

// suppress unused import warning
void path.resolve
void uuidv4
