import type { Request, Response } from 'express'
import * as authService from './auth.service'
import type { UserPayload } from './auth.types'

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const result = await authService.login(req.body)
    res.json(result)
  } catch (err: unknown) {
    const status = (err as { status?: number }).status || 500
    res.status(status).json({ error: (err as Error).message })
  }
}

export async function me(req: Request, res: Response): Promise<void> {
  try {
    const userId = ((req as Request & { user: UserPayload }).user).id
    const user = await authService.me(userId)
    res.json(user)
  } catch (err: unknown) {
    const status = (err as { status?: number }).status || 500
    res.status(status).json({ error: (err as Error).message })
  }
}
