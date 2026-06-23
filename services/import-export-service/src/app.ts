import express from 'express'
import importRoutes from './routes/import.routes'
import exportRoutes from './routes/export.routes'
import manualEntryRoutes from './routes/manual-entry.routes'
import { prisma } from './lib/prisma'

const app = express()

app.use(express.json())

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', service: 'import-export-service' })
  } catch {
    res.status(503).json({ status: 'error', reason: 'db_unavailable' })
  }
})

app.use('/import', importRoutes)
app.use('/export', exportRoutes)
app.use('/manual-entry', manualEntryRoutes)

export default app
