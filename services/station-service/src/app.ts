import express from 'express'
import stationRoutes from './routes/station.routes'
import brandRoutes from './routes/generator-brand.routes'
import modelRoutes from './routes/generator-model.routes'
import { prisma } from './lib/prisma'

const app = express()

app.use(express.json())

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', service: 'station-service' })
  } catch {
    res.status(503).json({ status: 'error', reason: 'db_unavailable' })
  }
})

app.use('/stations', stationRoutes)
app.use('/brands', brandRoutes)
app.use('/models', modelRoutes)

export default app
