import express from 'express'
import fuelRoutes from './routes/fuel-record.routes'
import adjustmentRoutes from './routes/adjustment-request.routes'
import { prisma } from './lib/prisma'

const app = express()

app.use(express.json())

app.set('json replacer', (_key: string, value: unknown) =>
  typeof value === 'bigint' ? Number(value) : value
)

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', service: 'fuel-service' })
  } catch {
    res.status(503).json({ status: 'error', reason: 'db_unavailable' })
  }
})

app.use('/fuel', fuelRoutes)
app.use('/fuel', adjustmentRoutes)

export default app
