import express from 'express'
import fuelRoutes from './routes/fuel-record.routes'

const app = express()

app.use(express.json())

app.set('json replacer', (_key: string, value: unknown) =>
  typeof value === 'bigint' ? Number(value) : value
)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'fuel-service' })
})

app.use('/fuel', fuelRoutes)

export default app
