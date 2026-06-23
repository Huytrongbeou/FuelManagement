import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001'

function loadJwtSecret(): string {
  const s = process.env.JWT_SECRET ?? process.env.AUTH_JWT_SECRET ?? ''
  if (!s || s.length < 32 || s.toLowerCase().includes('change_me')) {
    console.error('FATAL: JWT_SECRET missing, too short, or using placeholder value. Exiting.')
    process.exit(1)
  }
  return s
}

const JWT_SECRET = loadJwtSecret()

interface JwtPayload {
  id?: string
  username?: string
  role?: string
  [key: string]: unknown
}

// In-memory isActive cache: userId → {active, exp}
const activeCache = new Map<string, { active: boolean; exp: number }>()

async function checkActive(userId: string, token: string): Promise<boolean> {
  const cached = activeCache.get(userId)
  if (cached && Date.now() < cached.exp) return cached.active

  type FetchResponse = { ok: boolean; status: number; json: () => Promise<{ isActive?: boolean }> }
  let resp: FetchResponse
  try {
    resp = await fetch(`${AUTH_URL}/auth/me`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    }) as unknown as FetchResponse
  } catch {
    // Network error / timeout → FAIL-OPEN: auth-service down must not block all users
    console.warn('[auth-middleware] isActive check network error for', userId, '— fail open')
    return true
  }

  if (resp.status === 404) {
    // auth.service.me() throws 404 when user is inactive or not found
    activeCache.set(userId, { active: false, exp: Date.now() + 30_000 })
    return false
  }

  if (!resp.ok) {
    // 500/503 (DB auth down) or other error → FAIL-OPEN (deliberate tradeoff)
    console.warn('[auth-middleware] isActive check failed', resp.status, 'for', userId, '— fail open')
    return true
  }

  const data = await resp.json()
  const active = data.isActive === true
  activeCache.set(userId, { active, exp: Date.now() + 30_000 })
  return active
}

function extractToken(req: Request): string | undefined {
  // Prefer HttpOnly cookie; fall back to Authorization header for API clients
  const cookie = req.headers.cookie
  if (cookie) {
    const match = cookie.split(';').find(c => c.trim().startsWith('fuel_token='))
    if (match) return match.trim().slice('fuel_token='.length)
  }
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7)
  return undefined
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Strip all X-User-* headers from client to prevent role impersonation
  for (const key of Object.keys(req.headers)) {
    if (key.toLowerCase().startsWith('x-user-')) {
      delete req.headers[key]
    }
  }

  const token = extractToken(req)
  if (!token) {
    console.log(JSON.stringify({ ts: new Date().toISOString(), service: 'gateway', action: 'auth_fail', status: 401, reason: 'no_token', path: req.path, ip: req.ip }))
    res.status(401).json({ error: 'Authorization required' })
    return
  }

  let payload: JwtPayload
  try {
    payload = jwt.verify(token, JWT_SECRET) as JwtPayload
  } catch {
    console.log(JSON.stringify({ ts: new Date().toISOString(), service: 'gateway', action: 'auth_fail', status: 401, reason: 'invalid_token', path: req.path, ip: req.ip }))
    res.status(401).json({ error: 'Invalid or expired token' })
    return
  }

  if (!payload.role) {
    res.status(401).json({ error: 'Phiên làm việc hết hạn, vui lòng đăng nhập lại.' })
    return
  }

  const userId = payload.id ?? ''

  checkActive(userId, token).then(active => {
    if (!active) {
      console.log(JSON.stringify({ ts: new Date().toISOString(), service: 'gateway', action: 'auth_fail', status: 401, reason: 'user_inactive', userId, path: req.path }))
      res.status(401).json({ error: 'Tài khoản đã bị vô hiệu hóa.' })
      return
    }
    // Set user identity for downstream services (only gateway may write these)
    if (payload.id) req.headers['x-user-id'] = payload.id
    req.headers['x-user-role'] = payload.role!
    if (payload.username) req.headers['x-user-name'] = payload.username
    // Forward token so downstream services that verify it directly can still work
    req.headers['authorization'] = `Bearer ${token}`
    next()
  }).catch(() => {
    // Unexpected error in checkActive → fail open, proceed
    if (payload.id) req.headers['x-user-id'] = payload.id
    req.headers['x-user-role'] = payload.role!
    if (payload.username) req.headers['x-user-name'] = payload.username
    req.headers['authorization'] = `Bearer ${token}`
    next()
  })
}
