import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

export function getSocket() {
  if (!socket) {
    const url =
      process.env.NEXT_PUBLIC_SOCKET_URL ||
      (process.env.NEXT_PUBLIC_API_URL
        ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api$/, '')
        : 'http://localhost:5000');
    socket = io(url, {
      transports: ['websocket'],
      withCredentials: true,
    });
  }
  return socket;
}

export default getSocket;
