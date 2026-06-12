import type { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../services/authService'

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization header required' })
    return
  }
  const token = authHeader.slice(7)
  try {
    const payload = verifyToken(token)
    ;(req as Request & { user: typeof payload }).user = payload
    next()
  } catch (err: unknown) {
    const status = (err as { status?: number }).status || 401
    res.status(status).json({ error: (err as Error).message })
  }
}
