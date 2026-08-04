import express from 'express'
import stationRoutes from './routes/station.routes'
import stationRequestRoutes from './routes/station-request.routes'
import brandRoutes from './routes/generator-brand.routes'
import modelRoutes from './routes/generator-model.routes'
import employeeRoutes from './routes/employee.routes'
import { prisma } from './config/prisma'

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
app.use('/station-requests', stationRequestRoutes)
app.use('/brands', brandRoutes)
app.use('/models', modelRoutes)
app.use('/employees', employeeRoutes)

export default app
