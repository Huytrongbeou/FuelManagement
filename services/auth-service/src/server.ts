import express from 'express'
import authRoutes from './routes/authRoutes'

const app = express()
const PORT = parseInt(process.env.PORT || '3001', 10)

app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'auth-service' })
})

app.use('/auth', authRoutes)

app.listen(PORT, () => {
  console.log(`auth-service listening on port ${PORT}`)
})
