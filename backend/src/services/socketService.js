// src/services/socketService.js
import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../middleware/auth.js';
import { redis, isRedisReady, onRedisReady } from './redisClient.js';
import { supabase } from './supabaseClient.js';

let io = null;
let redisAdapterAttached = false;

// TEMPORARILY disabled for single-instance deployments.
// Re-enable later when the app is intentionally running multiple backend instances
// behind a load balancer and Redis pub/sub is required for cross-instance Socket.IO sync.
const attachRedisAdapter = () => {
  // if (!io || redisAdapterAttached || !isRedisReady() || !redis) return;
  // try {
  //   const pubClient = redis.duplicate();
  //   const subClient = redis.duplicate();
  //   io.adapter(createAdapter(pubClient, subClient));
  //   redisAdapterAttached = true;
  //   console.log('[Socket.io] Redis adapter attached for cross-instance real-time pub/sub');
  // } catch (err) {
  //   console.warn('[Socket.io] Redis adapter failed; using in-memory adapter:', err.message);
  // }
};

export const initSocket = (httpServer) => {
  const socketOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean)
    : process.env.NODE_ENV === 'production'
      ? []
      : ['http://localhost:3000', 'http://localhost:3001'];
  io = new Server(httpServer, {
    cors: {
      origin: socketOrigins,
      credentials: true,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket'], // Force WebSocket transport (AWS ALB friendly)
  });

  // Redis Socket.IO adapter is intentionally disabled for now.
  // This keeps single-instance deployments stable and avoids startup crashes.
  // Re-enable this block when you are ready for multi-instance Socket.IO synchronization.
  if (false) {
    // if (isRedisReady() && redis) {
    //   try {
    //     const pubClient = redis.duplicate();
    //     const subClient = redis.duplicate();
    //     io.adapter(createAdapter(pubClient, subClient));
    //     redisAdapterAttached = true;
    //     console.log('[Socket.io] 🔄 Redis Adapter attached for cross-instance real-time pub/sub');
    //   } catch (err) {
    //     console.warn('[Socket.io] ⚠️ Redis Adapter failed, falling back to in-memory adapter:', err.message);
    //   }
    // } else {
    //   console.log('[Socket.io] ℹ️ Running with default in-memory adapter (Redis offline or local mode)');
    // }
  }

  console.log('[Socket.io] ℹ️ Running with default in-memory adapter (single-instance deployment)');

  // Managed Redis often becomes ready after the HTTP server starts.
  // Adapter re-enable hook remains commented out intentionally for now.
  // onRedisReady(attachRedisAdapter);

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
    socket.on('join_trip', async (tripId, acknowledgement) => {
      if (!tripId || !username) {
        acknowledgement?.({ ok: false, error: 'Invalid trip room' });
        return;
      }

      try {
        const { data: membership, error } = await supabase
          .from('trip_members')
          .select('trip_id')
          .eq('trip_id', tripId)
          .eq('username', username)
          .maybeSingle();

        if (error) throw error;
        if (!membership) {
          console.warn(`[Socket.io] Denied trip room [trip:${tripId}] for @${username}`);
          acknowledgement?.({ ok: false, error: 'You are not a member of this trip' });
          return;
        }

        {
        const roomName = `trip:${tripId}`;
        socket.join(roomName);
        console.log(`[Socket.io] 👤 @${username} joined room [${roomName}]`);
        acknowledgement?.({ ok: true });
        }
      } catch (error) {
        console.warn(`[Socket.io] Trip room verification failed: ${error.message}`);
        acknowledgement?.({ ok: false, error: 'Unable to join trip updates' });
      }
    });

    socket.on('join_group', async (groupId, acknowledgement) => {
      if (!groupId || !username) {
        acknowledgement?.({ ok: false, error: 'Invalid group room' });
        return;
      }

      try {
        const { data: membership, error } = await supabase
          .from('group_members')
          .select('group_id')
          .eq('group_id', groupId)
          .eq('username', username)
          .maybeSingle();

        if (error) throw error;
        if (!membership) {
          console.warn(`[Socket.io] Denied group room [group:${groupId}] for @${username}`);
          acknowledgement?.({ ok: false, error: 'You are not a member of this group' });
          return;
        }

        const roomName = `group:${groupId}`;
        socket.join(roomName);
        console.log(`[Socket.io] @${username} joined room [${roomName}]`);
        acknowledgement?.({ ok: true });
      } catch (error) {
        console.warn(`[Socket.io] Group room verification failed: ${error.message}`);
        acknowledgement?.({ ok: false, error: 'Unable to join group updates' });
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

export const emitToGroup = (groupId, event, data) => {
  if (io && groupId) {
    io.to(`group:${groupId}`).emit(event, data);
    console.log(`[Socket.io] Emitted [${event}] to room [group:${groupId}]`);
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
