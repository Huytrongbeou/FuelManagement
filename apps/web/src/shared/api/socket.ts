// Socket.IO client — requires socket.io-client dependency
// When ready, install: npm install socket.io-client
// For now, provides typed stubs that are no-ops

type FuelEventCallback = (data: { stationId: string; fuelAfter: number; fuelStatus: string }) => void;

let _cleanup: (() => void) | null = null;

export function initSocket(_token: string): void {
  // TODO: implement when socket.io-client is installed
  // Connect via gateway (:3000/socket.io) — NOT directly to realtime-service (:3005)
  // const socket = io(import.meta.env.VITE_WS_URL || 'http://localhost:3000', {
  //   auth: { token: _token }
  // })
  // _socket = socket
}

export function onFuelEvent(cb: FuelEventCallback): () => void {
  // TODO: socket.on('fuel.record.created', cb)
  void cb;
  _cleanup = () => {};
  return () => {};
}

export function disconnect(): void {
  if (_cleanup) { _cleanup(); _cleanup = null; }
}
