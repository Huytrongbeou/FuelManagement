import http from 'http'
import app, { wsProxy } from './app'

const PORT = parseInt(process.env.PORT || '3000', 10)

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] gateway: Unhandled rejection:', reason)
  process.exit(1)
})
process.on('uncaughtException', (err) => {
  console.error('[FATAL] gateway: Uncaught exception:', err)
  process.exit(1)
})

const server = http.createServer(app)

server.on('upgrade', (req, socket, head) => {
  wsProxy.upgrade(req, socket as never, head)
})

server.listen(PORT, () => {
  console.log(`gateway listening on port ${PORT}`)
})

function shutdown(signal: string) {
  console.log(`[${signal}] Graceful shutdown gateway...`)
  server.close(() => { process.exit(0) })
  setTimeout(() => process.exit(1), 10_000)
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
