import app from './app'

const PORT = parseInt(process.env.PORT || '3001', 10)

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] auth-service: Unhandled rejection:', reason)
  process.exit(1)
})
process.on('uncaughtException', (err) => {
  console.error('[FATAL] auth-service: Uncaught exception:', err)
  process.exit(1)
})

app.listen(PORT, () => {
  console.log(`auth-service listening on port ${PORT}`)
})
