import amqplib from 'amqplib'

let channel: amqplib.Channel | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

function scheduleReconnect() {
  if (reconnectTimer) return
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null
    try { await connect() }
    catch { scheduleReconnect() }
  }, 5000)
}

export async function connect() {
  const url = process.env.RABBITMQ_URL || 'amqp://fuelapp:fuelapp_secret@localhost:5672'
  try {
    const conn = await amqplib.connect(url)
    conn.on('close', () => { channel = null; scheduleReconnect() })
    conn.on('error', () => { channel = null })
    channel = await conn.createChannel()
    await channel.assertExchange('fuel.events', 'topic', { durable: true })
    console.log('fuel-service: RabbitMQ connected')
  } catch (err) {
    scheduleReconnect()
    throw err
  }
}

export async function publish(routingKey: string, data: unknown) {
  if (!channel) return
  channel.publish('fuel.events', routingKey, Buffer.from(JSON.stringify(data)), { persistent: true })
}
