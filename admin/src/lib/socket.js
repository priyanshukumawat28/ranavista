import { io } from 'socket.io-client';
import { useEffect } from 'react';
import { API_BASE } from './api';

let socket = null;

export function connectSocket(token) {
  if (socket?.connected || !token) return socket;
  socket?.disconnect();
  socket = io(API_BASE || undefined, { auth: { token }, transports: ['websocket', 'polling'] });
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}

export const getSocket = () => socket;

/** Subscribe to a socket event for the lifetime of a component. */
export function useSocketEvent(event, handler) {
  useEffect(() => {
    const s = getSocket();
    if (!s) return undefined;
    s.on(event, handler);
    return () => s.off(event, handler);
  }, [event, handler]);
}
