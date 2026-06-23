import app from './app'
import { connect as connectRabbit } from './clients/rabbitmq'

const PORT = parseInt(process.env.PORT || '3004', 10)

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] import-export-service: Unhandled rejection:', reason)
  process.exit(1)
})
process.on('uncaughtException', (err) => {
  console.error('[FATAL] import-export-service: Uncaught exception:', err)
  process.exit(1)
})

async function start() {
  try {
    await connectRabbit()
  } catch {
    console.warn('import-export-service: RabbitMQ not available, continuing without realtime')
  }
  app.listen(PORT, () => {
    console.log(`import-export-service listening on port ${PORT}`)
  })
}

start()
