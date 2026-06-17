import type { Request, Response, NextFunction } from 'express'

export function validateLogin(req: Request, res: Response, next: NextFunction): void {
  const { username, password } = req.body
  if (!username || typeof username !== 'string' || username.trim() === '') {
    res.status(400).json({ error: 'username is required' })
    return
  }
  if (!password || typeof password !== 'string' || password === '') {
    res.status(400).json({ error: 'password is required' })
    return
  }
  next()
}
