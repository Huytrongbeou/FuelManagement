interface AuditEvent {
  action: string
  userId?: string
  userName?: string
  role?: string
  target?: string
  result?: string
  [key: string]: unknown
}

export function auditLog(event: AuditEvent): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), service: 'fuel-service', ...event }))
}
