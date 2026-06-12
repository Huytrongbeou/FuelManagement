import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

export function useSocket(onEvent: (event: string, data: unknown) => void) {
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) return

    const socket = io('http://localhost:3000', {
      auth: { token },
      transports: ['websocket', 'polling'],
    })

    socketRef.current = socket

    const events = ['fuel.record.created', 'fuel.records.committed', 'import.committed', 'station.changed']
    events.forEach((ev) => {
      socket.on(ev, (data: unknown) => onEvent(ev, data))
    })

    socket.on('connect_error', (err) => {
      console.warn('Socket.IO error:', err.message)
    })

    return () => {
      socket.disconnect()
    }
  }, [onEvent])

  return socketRef
}
