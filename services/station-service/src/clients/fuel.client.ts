const FUEL_URL = process.env.FUEL_SERVICE_URL || 'http://localhost:3003'

export interface UserContext {
  userId?: string
  userRole?: string
  userName?: string
}

function userHeaders(ctx?: UserContext): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (ctx?.userId) h['x-user-id'] = ctx.userId
  if (ctx?.userRole) h['x-user-role'] = ctx.userRole
  if (ctx?.userName) h['x-user-name'] = ctx.userName
  return h
}

export async function initCurrentState(
  input: { stationId: string; stationCode: string; consumptionRate: number; maxCapacity: number; initialFuel?: number },
  ctx?: UserContext
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${FUEL_URL}/fuel/current/init`, {
      method: 'POST',
      headers: userHeaders(ctx),
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      return { ok: false, error: (data as { error?: string }).error || `HTTP ${res.status}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: (e as Error).message || 'Lỗi kết nối fuel-service' }
  }
}
