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

type ActiveResult = 'active' | 'inactive' | 'unknown'

// In-memory isActive cache: userId → {active, exp}. 'unknown' results are never cached —
// they represent a transient auth-service outage, not a fact about the user.
const activeCache = new Map<string, { active: boolean; exp: number }>()

async function checkActive(userId: string, token: string): Promise<ActiveResult> {
  const cached = activeCache.get(userId)
  if (cached && Date.now() < cached.exp) return cached.active ? 'active' : 'inactive'

  type FetchResponse = { ok: boolean; status: number; json: () => Promise<{ isActive?: boolean }> }
  let resp: FetchResponse
  try {
    resp = await fetch(`${AUTH_URL}/auth/me`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    }) as unknown as FetchResponse
  } catch {
    // Network error / timeout — auth-service is unreachable, not a fact about this user
    console.warn('[auth-middleware] isActive check network error for', userId, '— treated as unknown')
    return 'unknown'
  }

  if (resp.status === 404) {
    // auth.service.me() throws 404 when user is inactive or not found
    activeCache.set(userId, { active: false, exp: Date.now() + 30_000 })
    return 'inactive'
  }

  if (!resp.ok) {
    // 500/503 (DB auth down) or other error — auth-service couldn't answer
    console.warn('[auth-middleware] isActive check failed', resp.status, 'for', userId, '— treated as unknown')
    return 'unknown'
  }

  const data = await resp.json()
  const active = data.isActive === true
  activeCache.set(userId, { active, exp: Date.now() + 30_000 })
  return active ? 'active' : 'inactive'
}

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])

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
  const isSafeMethod = SAFE_METHODS.has(req.method)

  const proceed = () => {
    // Set user identity for downstream services (only gateway may write these)
    if (payload.id) req.headers['x-user-id'] = payload.id
    req.headers['x-user-role'] = payload.role!
    if (payload.username) req.headers['x-user-name'] = payload.username
    // Forward token so downstream services that verify it directly can still work
    req.headers['authorization'] = `Bearer ${token}`
    next()
  }

  const handleResult = (result: ActiveResult) => {
    if (result === 'inactive') {
      console.log(JSON.stringify({ ts: new Date().toISOString(), service: 'gateway', action: 'auth_fail', status: 401, reason: 'user_inactive', userId, path: req.path }))
      res.status(401).json({ error: 'Tài khoản đã bị vô hiệu hóa.' })
      return
    }
    if (result === 'unknown' && !isSafeMethod) {
      // Fail-closed for writes: cannot verify the account isn't disabled, so refuse rather
      // than risk a disabled account performing a write. Reads stay fail-open — a monitoring
      // dashboard going blind because auth-service hiccuped is worse than the residual risk.
      console.warn(JSON.stringify({ ts: new Date().toISOString(), service: 'gateway', action: 'auth_fail', status: 503, reason: 'active_check_unknown_write', userId, path: req.path, method: req.method }))
      res.status(503).json({ error: 'Không thể xác thực trạng thái tài khoản. Vui lòng thử lại sau.' })
      return
    }
    if (result === 'unknown') {
      console.warn(JSON.stringify({ ts: new Date().toISOString(), service: 'gateway', action: 'auth_degraded', reason: 'active_check_unknown_read', userId, path: req.path, method: req.method }))
    }
    proceed()
  }

  checkActive(userId, token).then(handleResult).catch(() => handleResult('unknown'))
}
