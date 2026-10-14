import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import env from './config/env.js';

let io = null;
export const getIO = () => io;

export function initSocket(httpServer) {
  io = new Server(httpServer, { cors: { origin: [env.clientUrl, env.adminUrl], credentials: true } });

  io.use((socket, next) => {
    try {
      const { token } = socket.handshake.auth || {};
      const payload = jwt.verify(token, env.jwtSecret);
      socket.userId = payload.id;
      socket.role = payload.role;
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    socket.join(`user:${socket.userId}`);
    if (socket.role === 'admin') socket.join('admins');
    socket.on('typing', ({ rfqId, to }) => to && io.to(`user:${to}`).emit('typing', { rfqId, from: socket.userId }));
  });

  return io;
}
