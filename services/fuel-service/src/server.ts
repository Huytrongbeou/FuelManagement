import express from 'express'
import fuelRoutes from './routes/fuelRoutes'
import { connect as connectRabbit } from './clients/rabbitmq'

const app = express()
const PORT = parseInt(process.env.PORT || '3003', 10)

app.use(express.json())

// BigInt values (snapshotVersion) must be serialized as numbers
app.set('json replacer', (_key: string, value: unknown) =>
  typeof value === 'bigint' ? Number(value) : value
)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'fuel-service' })
})

app.use('/fuel', fuelRoutes)

async function start() {
  try {
    await connectRabbit()
  } catch {
    console.warn('fuel-service: RabbitMQ not available, continuing without realtime')
  }
  app.listen(PORT, () => {
    console.log(`fuel-service listening on port ${PORT}`)
  })
}

start()
