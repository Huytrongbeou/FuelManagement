import express from 'express'
import importRoutes from './routes/import.routes'
import exportRoutes from './routes/export.routes'
import manualEntryRoutes from './routes/manual-entry.routes'

const app = express()

app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'import-export-service' })
})

app.use('/import', importRoutes)
app.use('/export', exportRoutes)
app.use('/manual-entry', manualEntryRoutes)

export default app
