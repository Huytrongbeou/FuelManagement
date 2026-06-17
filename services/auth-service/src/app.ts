import express from 'express'
import authRoutes from './routes/auth.routes'

const app = express()

app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'auth-service' })
})

app.use('/auth', authRoutes)

export default app
