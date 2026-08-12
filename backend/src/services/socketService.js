// src/services/socketService.js
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../middleware/auth.js';
import { redis, isRedisReady } from './redisClient.js';

let io = null;

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: [
        'https://track-trips.vercel.app',
        'http://localhost:3000',
        'http://localhost:3001',
      ],
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket'], // Force WebSocket transport (AWS ALB friendly)
  });

  // Attach Redis adapter for horizontal scaling across multi-instance ECS Fargate
  if (isRedisReady() && redis) {
    try {
      const pubClient = redis.duplicate();
      const subClient = redis.duplicate();
      io.adapter(createAdapter(pubClient, subClient));
      console.log('[Socket.io] 🔄 Redis Adapter attached for cross-instance real-time pub/sub');
    } catch (err) {
      console.warn('[Socket.io] ⚠️ Redis Adapter failed, falling back to in-memory adapter:', err.message);
    }
  } else {
    console.log('[Socket.io] ℹ️ Running with default in-memory adapter (Redis offline or local mode)');
  }

  // Socket Authentication Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');
    if (!token) {
      return next(new Error('Authentication error: Missing token'));
    }

    try {
      const decoded = jwt.verify(token, getJwtSecret());
      socket.user = decoded; // { username, email }
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    const username = socket.user?.username;
    console.log(`[Socket.io] ⚡ Client connected: ${socket.id} (user: @${username})`);

    // Personal user room for direct user notifications
    if (username) {
      socket.join(`user:${username}`);
    }

    // Join a specific trip room
    socket.on('join_trip', (tripId) => {
      if (tripId) {
        const roomName = `trip:${tripId}`;
        socket.join(roomName);
        console.log(`[Socket.io] 👤 @${username} joined room [${roomName}]`);
      }
    });

    // Leave a specific trip room
    socket.on('leave_trip', (tripId) => {
      if (tripId) {
        const roomName = `trip:${tripId}`;
        socket.leave(roomName);
        console.log(`[Socket.io] 👤 @${username} left room [${roomName}]`);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.io] 🔌 Client disconnected: ${socket.id} (reason: ${reason})`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) {
    console.warn('[Socket.io] getIO called before initSocket');
  }
  return io;
};

/**
 * Emit an event to all clients in a specific trip room
 */
export const emitToTrip = (tripId, event, data) => {
  if (io && tripId) {
    io.to(`trip:${tripId}`).emit(event, data);
    console.log(`[Socket.io] 📢 Emitted [${event}] to room [trip:${tripId}]`);
  }
};

/**
 * Emit an event to a specific user
 */
export const emitToUser = (username, event, data) => {
  if (io && username) {
    io.to(`user:${username}`).emit(event, data);
    console.log(`[Socket.io] 📢 Emitted [${event}] to user [user:${username}]`);
  }
};
