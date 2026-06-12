import express from 'express'
import stationRoutes from './routes/stationRoutes'
import generatorTypeRoutes from './routes/generatorTypeRoutes'
import { connect as connectRabbit } from './clients/rabbitmq'

const app = express()
const PORT = parseInt(process.env.PORT || '3002', 10)

app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'station-service' })
})

// Gateway strips /api then routes /stations and /generator-types here
app.use('/stations', stationRoutes)
app.use('/generator-types', generatorTypeRoutes)

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
