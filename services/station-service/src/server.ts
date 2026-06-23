import app from './app'
import { connect as connectRabbit } from './clients/rabbitmq'
import { prisma } from './lib/prisma'

const PORT = parseInt(process.env.PORT || '3002', 10)

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] station-service: Unhandled rejection:', reason)
  process.exit(1)
})
process.on('uncaughtException', (err) => {
  console.error('[FATAL] station-service: Uncaught exception:', err)
  process.exit(1)
})

let server: ReturnType<typeof app.listen>

function shutdown(signal: string) {
  console.log(`[${signal}] Graceful shutdown station-service...`)
  server.close(async () => {
    await prisma.$disconnect().catch(() => {})
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10_000)
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

async function start() {
  try {
    await connectRabbit()
  } catch {
    console.warn('station-service: RabbitMQ not available, continuing without realtime')
  }
  server = app.listen(PORT, () => {
    console.log(`station-service listening on port ${PORT}`)
  })
}

start()
