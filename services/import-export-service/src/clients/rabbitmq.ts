import amqplib from 'amqplib'

let channel: amqplib.Channel | null = null

export async function connect() {
  const url = process.env.RABBITMQ_URL || 'amqp://fuelapp:fuelapp_secret@localhost:5672'
  const conn = await amqplib.connect(url)
  channel = await conn.createChannel()
  await channel.assertExchange('fuel.events', 'topic', { durable: true })
  console.log('import-export-service: RabbitMQ connected')
}

export async function publish(routingKey: string, data: unknown) {
  if (!channel) return
  channel.publish('fuel.events', routingKey, Buffer.from(JSON.stringify(data)), { persistent: true })
}
