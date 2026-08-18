// src/hooks/useSocket.js
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

export const useSocket = (tripId, onExpenseAdded, onExpenseDeleted, onSettlementUpdated, onPlaceChanged, onPaymentChanged) => {
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

    socket.on('place:added', (data) => {
      if (onPlaceChanged) onPlaceChanged(data);
    });

    ['payment:initiated', 'payment:updated', 'payment:awaiting_confirmation', 'payment:completed'].forEach((event) => {
      socket.on(event, (data) => { if (onPaymentChanged) onPaymentChanged(data); });
    });

    socket.on('place:updated', (data) => {
      if (onPlaceChanged) onPlaceChanged(data);
    });

    socket.on('place:deleted', (data) => {
      if (onPlaceChanged) onPlaceChanged(data);
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
  }, [tripId, onExpenseAdded, onExpenseDeleted, onSettlementUpdated, onPlaceChanged, onPaymentChanged]);

  return socketRef.current;
};

// Group rooms keep group trip lists synchronized when another member creates a trip.
export const useGroupSocket = (groupIds, onTripCreated) => {
  const socketRef = useRef(null);
  const groupKey = (Array.isArray(groupIds) ? groupIds : []).filter(Boolean).slice().sort().join(',');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const groupIdsForSocket = groupKey ? groupKey.split(',') : [];
    if (!token || !groupIdsForSocket.length) return undefined;

    let socketUrl = 'http://localhost:5000';
    if (process.env.REACT_APP_API_URL) {
      socketUrl = process.env.REACT_APP_API_URL.replace(/\/api\/?$/, '');
    } else if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      socketUrl = 'https://track-trips.onrender.com';
    }

    const socket = io(socketUrl, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      groupIdsForSocket.forEach((groupId) => socket.emit('join_group', groupId));
    });

    socket.on('trip:created', (data) => {
      if (onTripCreated) onTripCreated(data);
    });

    socket.on('connect_error', (err) => {
      console.warn('[Socket.io Client] Group connection warning:', err.message);
    });

    return () => socket.disconnect();
  }, [groupKey, onTripCreated]);

  return socketRef.current;
};

export default useSocket;
