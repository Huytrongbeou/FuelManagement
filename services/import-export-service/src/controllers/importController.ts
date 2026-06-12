import type { Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'
import { previewImport, confirmImport } from '../services/importOrchestrator'
import { v4 as uuidv4 } from 'uuid'
import path from 'path'

const prisma = new PrismaClient()

export async function upload(req: Request, res: Response): Promise<void> {
  try {
    const file = (req as Request & { file?: { path: string; originalname: string } }).file
    if (!file) { res.status(400).json({ error: 'File is required' }); return }

    const job = await prisma.importJob.create({
      data: {
        idempotencyKey: uuidv4(),
        filename: file.originalname,
        status: 'pending',
      },
    })

    // Run preview in background-ish (await is fine for MVP)
    await previewImport(job.id, file.path, new Date())

    const updated = await prisma.importJob.findUnique({ where: { id: job.id } })
    res.status(201).json(updated)
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
    const result = await confirmImport(req.params.job_id, req.body.committed_by)
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
