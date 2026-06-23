import http from 'http'
import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import app from './app'
import { connectRabbitMQ } from './config/rabbitmq'

const PORT = parseInt(process.env.PORT || '3005', 10)
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'
function loadJwtSecret(): string {
  const s = process.env.JWT_SECRET ?? process.env.AUTH_JWT_SECRET ?? ''
  if (!s || s.length < 32 || s.toLowerCase().includes('change_me')) {
    console.error('FATAL: JWT_SECRET missing, too short, or using placeholder value. Exiting.')
    process.exit(1)
  }
  return s
}

const JWT_SECRET = loadJwtSecret()

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] realtime-service: Unhandled rejection:', reason)
  process.exit(1)
})
process.on('uncaughtException', (err) => {
  console.error('[FATAL] realtime-service: Uncaught exception:', err)
  process.exit(1)
})

const server = http.createServer(app)

const io = new Server(server, {
  cors: { origin: CORS_ORIGIN, credentials: true },
})

io.use((socket, next) => {
  const token = socket.handshake.auth.token as string | undefined
  if (!token) return next(new Error('Authentication required'))
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    socket.data.user = payload
    next()
  } catch {
    next(new Error('Invalid token'))
  }
})

io.on('connection', (socket) => {
  socket.join('dashboard')
  socket.on('disconnect', () => {})
})

async function start() {
  try {
    await connectRabbitMQ(io)
  } catch {
    console.warn('realtime-service: RabbitMQ not available, retrying in background')
  }
  server.listen(PORT, () => {
    console.log(`realtime-service listening on port ${PORT}`)
  })
}

start()

function shutdown(signal: string) {
  console.log(`[${signal}] Graceful shutdown realtime-service...`)
  io.close(() => {
    server.close(() => { process.exit(0) })
  })
  setTimeout(() => process.exit(1), 10_000)
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

export { io }
