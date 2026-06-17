import express from 'express'
import stationRoutes from './routes/station.routes'
import brandRoutes from './routes/generator-brand.routes'
import modelRoutes from './routes/generator-model.routes'

const app = express()

app.use(express.json())

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'station-service' })
})

app.use('/stations', stationRoutes)
app.use('/brands', brandRoutes)
app.use('/models', modelRoutes)

export default app
