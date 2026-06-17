import type { Server } from 'socket.io'
import type amqplib from 'amqplib'

export function makeFuelEventHandler(io: Server, channel: amqplib.Channel) {
  return (msg: amqplib.ConsumeMessage | null) => {
    if (!msg) return
    try {
      const data = JSON.parse(msg.content.toString()) as unknown
      io.to('dashboard').emit(msg.fields.routingKey, data)
    } finally {
      channel.ack(msg)
    }
  }
}
