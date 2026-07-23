import type { Request, Response } from 'express'
import * as service from '../services/station-request.service'

function reviewerName(req: Request): string {
  return (req.headers['x-user-name'] as string | undefined) ?? 'unknown'
}

function userCtx(req: Request) {
  return {
    userId: req.headers['x-user-id'] as string | undefined,
    userRole: req.headers['x-user-role'] as string | undefined,
    userName: req.headers['x-user-name'] as string | undefined,
  }
}

function sendError(res: Response, err: unknown): void {
  const status = (err as { status?: number }).status || 500
  res.status(status).json({ error: (err as Error).message })
}

export async function list(req: Request, res: Response): Promise<void> {
  try {
    res.json(await service.listRequests(req.query.status as string | undefined))
  } catch (err: unknown) {
    sendError(res, err)
  }
}

export async function getOne(req: Request, res: Response): Promise<void> {
  try {
    res.json(await service.getRequest(req.params.id))
  } catch (err: unknown) {
    sendError(res, err)
  }
}

export async function create(req: Request, res: Response): Promise<void> {
  try {
    res.status(201).json(await service.createRequest(req.body, reviewerName(req)))
  } catch (err: unknown) {
    sendError(res, err)
  }
}

export async function approve(req: Request, res: Response): Promise<void> {
  try {
    const result = await service.approveRequest(req.params.id, {
      name: reviewerName(req),
      ctx: userCtx(req),
    })
    res.json(result)
  } catch (err: unknown) {
    sendError(res, err)
  }
}

export async function reject(req: Request, res: Response): Promise<void> {
  try {
    res.json(await service.rejectRequest(req.params.id, reviewerName(req), req.body?.reason))
  } catch (err: unknown) {
    sendError(res, err)
  }
}
