import express from 'express'
import importRoutes from './routes/importRoutes'
import exportRoutes from './routes/exportRoutes'
import { connect as connectRabbit } from './clients/rabbitmq'

const app = express()
const PORT = parseInt(process.env.PORT || '3004', 10)

app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'import-export-service' })
})

app.use('/import', importRoutes)
app.use('/export', exportRoutes)

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
