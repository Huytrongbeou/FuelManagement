import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { requireAuth } from './middleware/auth.middleware'
import { mapStationsHandler } from './controllers/map-stations.controller'
import { stationFullHandler } from './controllers/station-full.controller'
import { stationsListHandler } from './controllers/stations.controller'
import { dashboardSummaryHandler } from './controllers/dashboard.controller'

const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174'
const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001'
const STATION_URL = process.env.STATION_SERVICE_URL || 'http://localhost:3002'
const FUEL_URL = process.env.FUEL_SERVICE_URL || 'http://localhost:3003'
const IMPORT_URL = process.env.IMPORT_EXPORT_SERVICE_URL || 'http://localhost:3004'
const REALTIME_URL = process.env.REALTIME_SERVICE_URL || 'http://localhost:3005'

const stripApi = { pathRewrite: { '^/api': '' } }

const app = express()

app.set('trust proxy', 1)  // nginx terminates TLS; rate-limit and HSTS read correct client IP/proto
app.use(helmet({ hsts: { maxAge: 31536000, includeSubDomains: true } }))

// Native (Capacitor) builds serve the UI from a local webview origin rather than the site's
// domain, so those origins must be allowed alongside the configured browser origins.
// Android uses http(s)://localhost, iOS uses capacitor://localhost.
const NATIVE_APP_ORIGINS = ['capacitor://localhost', 'http://localhost', 'https://localhost']
const corsOrigins = [...CORS_ORIGIN.split(',').map(o => o.trim()).filter(Boolean), ...NATIVE_APP_ORIGINS]
app.use(cors({ origin: corsOrigins, credentials: true }))
app.use(rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false }))

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'gateway' })
})

// ── 1. Aggregate endpoints — BEFORE proxy wildcards (specific before general) ──
app.get('/api/dashboard/summary', requireAuth, dashboardSummaryHandler)
app.get('/api/map/stations', requireAuth, mapStationsHandler)
app.get('/api/stations', requireAuth, stationsListHandler)
app.get('/api/stations/:id/full', requireAuth, stationFullHandler)

// ── 2. Public: login (no JWT) ───────────────────────────────────────────────
app.post('/api/auth/login', createProxyMiddleware({ target: AUTH_URL, changeOrigin: true, ...stripApi }))

// ── 3. Block internal-only endpoints BEFORE proxy wildcards ─────────────────
app.post('/api/fuel/import-commit', (_req, res) => {
  res.status(403).json({ error: 'Forbidden' })
})
app.post('/api/fuel/current/init', (_req, res) => {
  res.status(403).json({ error: 'Forbidden' })
})

// ── 4. Protected proxy wildcards — AFTER specifics and blocks ────────────────
app.all('/api/auth*', requireAuth, createProxyMiddleware({ target: AUTH_URL, changeOrigin: true, ...stripApi }))
// User administration lives in auth-service; the admin-only check is enforced there via the
// x-user-role header this gateway sets.
app.all('/api/users*', requireAuth, createProxyMiddleware({ target: AUTH_URL, changeOrigin: true, ...stripApi }))
app.all('/api/brands*', requireAuth, createProxyMiddleware({ target: STATION_URL, changeOrigin: true, ...stripApi }))
app.all('/api/models*', requireAuth, createProxyMiddleware({ target: STATION_URL, changeOrigin: true, ...stripApi }))
app.all('/api/stations*', requireAuth, createProxyMiddleware({ target: STATION_URL, changeOrigin: true, ...stripApi }))
// Station proposals: any role may submit, station-service gates approval to manager/admin.
app.all('/api/station-requests*', requireAuth, createProxyMiddleware({ target: STATION_URL, changeOrigin: true, ...stripApi }))
app.all('/api/fuel*', requireAuth, createProxyMiddleware({ target: FUEL_URL, changeOrigin: true, ...stripApi }))
app.all('/api/manual-entry*', requireAuth, createProxyMiddleware({ target: IMPORT_URL, changeOrigin: true, ...stripApi }))
app.all('/api/import*', requireAuth, createProxyMiddleware({ target: IMPORT_URL, changeOrigin: true, ...stripApi }))
app.all('/api/export*', requireAuth, createProxyMiddleware({ target: IMPORT_URL, changeOrigin: true, ...stripApi }))

// ── 5. WebSocket proxy ────────────────────────────────────────────────────────
export const wsProxy = createProxyMiddleware({ target: REALTIME_URL, changeOrigin: true, ws: true })
app.all('/socket.io*', wsProxy)

export default app
