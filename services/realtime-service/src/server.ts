import http from 'http'
import express from 'express'
import { Server } from 'socket.io'
import jwt from 'jsonwebtoken'
import amqplib from 'amqplib'

const app = express()
const PORT = parseInt(process.env.PORT || '3005', 10)
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173'
const JWT_SECRET = process.env.JWT_SECRET || 'change_me_in_production'
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://fuelapp:fuelapp_secret@localhost:5672'

app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'realtime-service' })
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

async function connectRabbitMQ() {
  const conn = await amqplib.connect(RABBITMQ_URL)
  const channel = await conn.createChannel()
  await channel.assertExchange('fuel.events', 'topic', { durable: true })

  const q = await channel.assertQueue('realtime-service', { durable: false, autoDelete: true })
  await channel.bindQueue(q.queue, 'fuel.events', 'fuel.record.created')
  await channel.bindQueue(q.queue, 'fuel.events', 'fuel.records.committed')
  await channel.bindQueue(q.queue, 'fuel.events', 'import.committed')
  await channel.bindQueue(q.queue, 'fuel.events', 'station.changed')

  channel.consume(q.queue, (msg) => {
    if (!msg) return
    try {
      const data = JSON.parse(msg.content.toString()) as unknown
      io.to('dashboard').emit(msg.fields.routingKey, data)
    } finally {
      channel.ack(msg)
    }
  })

  console.log('realtime-service: RabbitMQ consumer ready')
}

async function start() {
  try {
    await connectRabbitMQ()
  } catch {
    console.warn('realtime-service: RabbitMQ not available, retrying in background')
  }
  server.listen(PORT, () => {
    console.log(`realtime-service listening on port ${PORT}`)
  })
}

start()

export { io }
