// src/hooks/useSocket.js
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export const useSocket = (tripId, onExpenseAdded, onExpenseDeleted, onSettlementUpdated) => {
  const socketRef = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token || !tripId) return;

    // Determine Socket.io server URL
    let socketUrl = 'http://localhost:5000';
    if (process.env.REACT_APP_API_URL) {
      socketUrl = process.env.REACT_APP_API_URL.replace(/\/api\/?$/, '');
    } else if (typeof window !== 'undefined') {
      const { protocol, hostname } = window.location;
      const isLocalHost = hostname === 'localhost' || hostname === '127.0.0.1';
      const isTunnelHost = hostname.includes('devtunnels.ms') || hostname.includes('localtunnel.me') || hostname.includes('ngrok-free.app') || hostname.includes('trycloudflare.com');

      if (isLocalHost) {
        socketUrl = 'http://localhost:5000';
      } else if (isTunnelHost) {
        const backendHostname = hostname.replace(/-(\d+)\./, '-5000.');
        socketUrl = `${protocol}//${backendHostname}`;
      } else {
        socketUrl = 'https://track-trips.onrender.com';
      }
    } else {
      socketUrl = 'https://track-trips.onrender.com';
    }

    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket'], // Pure WebSocket mode for stability and AWS ALB compatibility
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[Socket.io Client] ⚡ Connected to real-time server:', socket.id);
      socket.emit('join_trip', tripId);
    });

    socket.on('expense:added', (data) => {
      console.log('[Socket.io Client] 📢 expense:added', data);
      if (onExpenseAdded) onExpenseAdded(data);
    });

    socket.on('expense:deleted', (data) => {
      console.log('[Socket.io Client] 📢 expense:deleted', data);
      if (onExpenseDeleted) onExpenseDeleted(data);
    });

    socket.on('settlement:updated', (data) => {
      console.log('[Socket.io Client] 📢 settlement:updated', data);
      if (onSettlementUpdated) onSettlementUpdated(data);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket.io Client] Connection warning:', err.message);
    });

    return () => {
      if (socket) {
        socket.emit('leave_trip', tripId);
        socket.disconnect();
        console.log('[Socket.io Client] Disconnected from trip room');
      }
    };
  }, [tripId, onExpenseAdded, onExpenseDeleted, onSettlementUpdated]);

  return socketRef.current;
};

export default useSocket;
