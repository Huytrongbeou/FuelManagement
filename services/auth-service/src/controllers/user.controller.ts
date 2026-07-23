import type { Request, Response } from 'express'
import * as userService from '../services/user.service'

function actorId(req: Request): string {
  return (req.headers['x-user-id'] as string | undefined) ?? ''
}

function sendError(res: Response, err: unknown): void {
  const status = (err as { status?: number }).status || 500
  res.status(status).json({ error: (err as Error).message })
}

export async function getUsers(_req: Request, res: Response): Promise<void> {
  try {
    res.json(await userService.listUsers())
  } catch (err: unknown) {
    sendError(res, err)
  }
}

export async function postUser(req: Request, res: Response): Promise<void> {
  try {
    res.status(201).json(await userService.createUser(req.body))
  } catch (err: unknown) {
    sendError(res, err)
  }
}

export async function patchUser(req: Request, res: Response): Promise<void> {
  try {
    res.json(await userService.updateUser(req.params.id, req.body, actorId(req)))
  } catch (err: unknown) {
    sendError(res, err)
  }
}

export async function deleteUser(req: Request, res: Response): Promise<void> {
  try {
    res.json(await userService.deactivateUser(req.params.id, actorId(req)))
  } catch (err: unknown) {
    sendError(res, err)
  }
}
