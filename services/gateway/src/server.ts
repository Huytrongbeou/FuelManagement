import http from 'http'
import app, { wsProxy } from './app'

const PORT = parseInt(process.env.PORT || '3000', 10)

const server = http.createServer(app)

server.on('upgrade', (req, socket, head) => {
  wsProxy.upgrade(req, socket as never, head)
})

server.listen(PORT, () => {
  console.log(`gateway listening on port ${PORT}`)
})
