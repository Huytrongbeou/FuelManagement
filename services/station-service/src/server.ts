import express from 'express'
import stationRoutes from './modules/stations/station.routes'
import brandRoutes from './modules/generator-brands/generator-brand.routes'
import modelRoutes from './modules/generator-models/generator-model.routes'
import { connect as connectRabbit } from './shared/clients/rabbitmq'

const app = express()
const PORT = parseInt(process.env.PORT || '3002', 10)

app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'station-service' })
})

app.use('/stations', stationRoutes)
app.use('/brands', brandRoutes)
app.use('/models', modelRoutes)

async function start() {
  try {
    await connectRabbit()
  } catch {
    console.warn('station-service: RabbitMQ not available, continuing without realtime')
  }
  app.listen(PORT, () => {
    console.log(`station-service listening on port ${PORT}`)
  })
}

start()
