import express from 'express'
import importRoutes from './modules/excel-import/import.routes'
import exportRoutes from './modules/excel-export/export.routes'
import manualEntryRoutes from './modules/manual-entry/manual-entry.routes'
import { connect as connectRabbit } from './shared/clients/rabbitmq'

const app = express()
const PORT = parseInt(process.env.PORT || '3004', 10)

app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'import-export-service' })
})

app.use('/import', importRoutes)
app.use('/export', exportRoutes)
app.use('/manual-entry', manualEntryRoutes)

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
