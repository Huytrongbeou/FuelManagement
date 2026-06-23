import type { Request, Response } from 'express'
import * as authService from '../services/auth.service'
import type { UserPayload } from '../models/auth.types'

// Matches JWT_EXPIRES_IN of 8h
const COOKIE_MAX_AGE = 8 * 60 * 60 * 1000

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: COOKIE_MAX_AGE,
  path: '/',
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const result = await authService.login(req.body)
    res.cookie('fuel_token', result.token, cookieOpts)
    res.json(result)
  } catch (err: unknown) {
    const status = (err as { status?: number }).status || 500
    res.status(status).json({ error: (err as Error).message })
  }
}

export async function logout(_req: Request, res: Response): Promise<void> {
  res.clearCookie('fuel_token', { path: '/', sameSite: 'strict', secure: process.env.NODE_ENV === 'production' })
  res.json({ ok: true })
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
