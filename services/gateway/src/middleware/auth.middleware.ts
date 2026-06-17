import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_production'

interface JwtPayload {
  id?: string
  username?: string
  role?: string
  [key: string]: unknown
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization header required' })
    return
  }
  const token = authHeader.slice(7)
  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload
    if (!payload.role) {
      res.status(401).json({ error: 'Phiên làm việc hết hạn, vui lòng đăng nhập lại.' })
      return
    }
    next()
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' })
  }
}
