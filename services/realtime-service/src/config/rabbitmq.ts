import amqplib from 'amqplib'
import type { Server } from 'socket.io'
import { makeFuelEventHandler } from '../socket/fuel-events.handler'

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://fuelapp:fuelapp_secret@localhost:5672'

export async function connectRabbitMQ(io: Server): Promise<void> {
  const conn = await amqplib.connect(RABBITMQ_URL)
  const channel = await conn.createChannel()
  await channel.assertExchange('fuel.events', 'topic', { durable: true })

  const q = await channel.assertQueue('realtime-service', { durable: false, autoDelete: true })
  await channel.bindQueue(q.queue, 'fuel.events', 'fuel.record.created')
  await channel.bindQueue(q.queue, 'fuel.events', 'fuel.records.committed')
  await channel.bindQueue(q.queue, 'fuel.events', 'import.committed')
  await channel.bindQueue(q.queue, 'fuel.events', 'station.changed')

  channel.consume(q.queue, makeFuelEventHandler(io, channel))

  console.log('realtime-service: RabbitMQ consumer ready')
}
