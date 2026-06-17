import http from 'http'
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { requireAuth } from './middleware/auth.middleware'
import { mapStationsHandler } from './aggregates/map-stations.aggregate'
import { stationFullHandler } from './aggregates/station-full.aggregate'
import { stationsListHandler } from './aggregates/stations.aggregate'
import { dashboardSummaryHandler } from './aggregates/dashboard.aggregate'

const app = express()
const PORT = parseInt(process.env.PORT || '3000', 10)
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173,http://localhost:5174'

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001'
const STATION_URL = process.env.STATION_SERVICE_URL || 'http://localhost:3002'
const FUEL_URL = process.env.FUEL_SERVICE_URL || 'http://localhost:3003'
const IMPORT_URL = process.env.IMPORT_EXPORT_SERVICE_URL || 'http://localhost:3004'
const REALTIME_URL = process.env.REALTIME_SERVICE_URL || 'http://localhost:3005'

const stripApi = { pathRewrite: { '^/api': '' } }

const corsOrigins = CORS_ORIGIN.split(',').map(o => o.trim())
app.use(cors({ origin: corsOrigins, credentials: true }))
app.use(rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false }))

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'gateway' })
})

// ── 1. Aggregate endpoints — BEFORE proxy wildcards (specific before general) ──
app.get('/api/dashboard/summary', requireAuth, dashboardSummaryHandler)
app.get('/api/map/stations', requireAuth, mapStationsHandler)
app.get('/api/stations', requireAuth, stationsListHandler)           // merged list with fuel state
app.get('/api/stations/:id/full', requireAuth, stationFullHandler)   // merged single station

// ── 2. Public: login (no JWT) ───────────────────────────────────────────────
app.post('/api/auth/login', createProxyMiddleware({ target: AUTH_URL, changeOrigin: true, ...stripApi }))

// ── 3. Block internal-only endpoints BEFORE proxy wildcards ─────────────────
app.post('/api/fuel/import-commit', (_req, res) => {
  res.status(403).json({ error: 'Forbidden' })
})

// ── 4. Protected proxy wildcards — AFTER specifics and blocks ────────────────
app.all('/api/auth*', requireAuth, createProxyMiddleware({ target: AUTH_URL, changeOrigin: true, ...stripApi }))
app.all('/api/brands*', requireAuth, createProxyMiddleware({ target: STATION_URL, changeOrigin: true, ...stripApi }))
app.all('/api/models*', requireAuth, createProxyMiddleware({ target: STATION_URL, changeOrigin: true, ...stripApi }))
app.all('/api/stations*', requireAuth, createProxyMiddleware({ target: STATION_URL, changeOrigin: true, ...stripApi }))
app.all('/api/fuel*', requireAuth, createProxyMiddleware({ target: FUEL_URL, changeOrigin: true, ...stripApi }))
app.all('/api/manual-entry*', requireAuth, createProxyMiddleware({ target: IMPORT_URL, changeOrigin: true, ...stripApi }))
app.all('/api/import*', requireAuth, createProxyMiddleware({ target: IMPORT_URL, changeOrigin: true, ...stripApi }))
app.all('/api/export*', requireAuth, createProxyMiddleware({ target: IMPORT_URL, changeOrigin: true, ...stripApi }))

// ── 5. WebSocket proxy ────────────────────────────────────────────────────────
const wsProxy = createProxyMiddleware({ target: REALTIME_URL, changeOrigin: true, ws: true })
app.all('/socket.io*', wsProxy)

const server = http.createServer(app)

server.on('upgrade', (req, socket, head) => {
  wsProxy.upgrade(req, socket as never, head)
})

server.listen(PORT, () => {
  console.log(`gateway listening on port ${PORT}`)
})
