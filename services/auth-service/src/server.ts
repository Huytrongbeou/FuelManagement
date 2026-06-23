import app from './app'
import { prisma } from './lib/prisma'

const PORT = parseInt(process.env.PORT || '3001', 10)

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] auth-service: Unhandled rejection:', reason)
  process.exit(1)
})
process.on('uncaughtException', (err) => {
  console.error('[FATAL] auth-service: Uncaught exception:', err)
  process.exit(1)
})

const server = app.listen(PORT, () => {
  console.log(`auth-service listening on port ${PORT}`)
})

function shutdown(signal: string) {
  console.log(`[${signal}] Graceful shutdown auth-service...`)
  server.close(async () => {
    await prisma.$disconnect().catch(() => {})
    process.exit(0)
  })
  setTimeout(() => process.exit(1), 10_000)
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
