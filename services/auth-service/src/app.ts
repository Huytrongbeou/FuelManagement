import express from 'express'
import authRoutes from './routes/auth.routes'
import { prisma } from './lib/prisma'

const app = express()

app.use(express.json())

app.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', service: 'auth-service' })
  } catch {
    res.status(503).json({ status: 'error', reason: 'db_unavailable' })
  }
})

app.use('/auth', authRoutes)

export default app
