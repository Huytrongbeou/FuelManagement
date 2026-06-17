import type { Request, Response, NextFunction } from 'express'

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = req.headers['x-user-role'] as string | undefined
    if (!role || !allowedRoles.includes(role)) {
      res.status(403).json({ error: 'Bạn không có quyền thực hiện thao tác này. Liên hệ Admin nếu cần.' })
      return
    }
    next()
  }
}
