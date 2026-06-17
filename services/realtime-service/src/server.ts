import http from 'http'
import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import app from './app'
import { connectRabbitMQ } from './config/rabbitmq'

const PORT = parseInt(process.env.PORT || '3005', 10)
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'
const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_production'

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

export { io }
