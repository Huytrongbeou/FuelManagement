import http from 'http'
import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { requireAuth } from './middleware/auth'
import { mapStationsHandler } from './aggregates/mapStations'
import { stationFullHandler } from './aggregates/stationFull'
import { dashboardSummaryHandler } from './aggregates/dashboard'

const app = express()
const PORT = parseInt(process.env.PORT || '3000', 10)
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'

const AUTH_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001'
const STATION_URL = process.env.STATION_SERVICE_URL || 'http://localhost:3002'
const FUEL_URL = process.env.FUEL_SERVICE_URL || 'http://localhost:3003'
const IMPORT_URL = process.env.IMPORT_EXPORT_SERVICE_URL || 'http://localhost:3004'
const REALTIME_URL = process.env.REALTIME_SERVICE_URL || 'http://localhost:3005'

// Strip /api prefix when forwarding to downstream services
// e.g. /api/stations/123 → /stations/123
const stripApi = { pathRewrite: { '^/api': '' } }

app.use(cors({ origin: CORS_ORIGIN, credentials: true }))
app.use(rateLimit({ windowMs: 60_000, max: 300, standardHeaders: true, legacyHeaders: false }))

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'gateway' })
})

// Aggregate endpoints (gateway implements, no proxy)
app.get('/api/map/stations', requireAuth, mapStationsHandler)
app.get('/api/stations/:id/full', requireAuth, stationFullHandler)
app.get('/api/dashboard/summary', requireAuth, dashboardSummaryHandler)

// Public: login (no JWT required)
// app.post keeps full req.url → pathRewrite strips /api → /auth/login on auth-service
app.post('/api/auth/login', createProxyMiddleware({ target: AUTH_URL, changeOrigin: true, ...stripApi }))

// All other /api/* routes require JWT
// app.all with wildcard does NOT strip the path (unlike app.use), so pathRewrite works on the full URL
app.all('/api/auth*', requireAuth, createProxyMiddleware({ target: AUTH_URL, changeOrigin: true, ...stripApi }))
app.all('/api/generator-types*', requireAuth, createProxyMiddleware({ target: STATION_URL, changeOrigin: true, ...stripApi }))
app.all('/api/stations*', requireAuth, createProxyMiddleware({ target: STATION_URL, changeOrigin: true, ...stripApi }))
app.all('/api/fuel*', requireAuth, createProxyMiddleware({ target: FUEL_URL, changeOrigin: true, ...stripApi }))
app.all('/api/import*', requireAuth, createProxyMiddleware({ target: IMPORT_URL, changeOrigin: true, ...stripApi }))
app.all('/api/export*', requireAuth, createProxyMiddleware({ target: IMPORT_URL, changeOrigin: true, ...stripApi }))

// WebSocket proxy: app.all preserves full path, Socket.IO on realtime-service uses /socket.io default path
const wsProxy = createProxyMiddleware({ target: REALTIME_URL, changeOrigin: true, ws: true })
app.all('/socket.io*', wsProxy)

const server = http.createServer(app)

server.on('upgrade', (req, socket, head) => {
  wsProxy.upgrade(req, socket as never, head)
})

server.listen(PORT, () => {
  console.log(`gateway listening on port ${PORT}`)
})
