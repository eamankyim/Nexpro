import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../services/api';

/** Production WebSocket base URL when app is on ABS / African Business Suite production domains */
const ABS_WS_URL = 'https://api.africanbusinesssuite.com';

const getWsUrl = () => {
  const explicit = import.meta.env.VITE_WS_URL?.trim();
  if (explicit && explicit.startsWith('http')) return explicit;
  const base = API_BASE_URL?.trim();
  if (base && base.startsWith('http')) {
    try {
      const u = new URL(base);
      if (u.hostname && u.hostname !== 'http' && u.hostname !== 'https') return base;
    } catch (_) {}
  }
  if (typeof window !== 'undefined') {
    const { hostname } = window.location;
    if (hostname === 'myapp.africanbusinesssuite.com' || hostname === 'africanbusinesssuite.com') return ABS_WS_URL;
  }
  return 'http://localhost:5001';
};

const WS_URL = getWsUrl();

/** When 'false' or '0', skip Socket.IO connection (backend may not have /socket.io/). Set in .env to reduce 404 log spam. */
const isWsEnabled = () => {
  const v = import.meta.env.VITE_WS_ENABLED;
  return v !== 'false' && v !== '0';
};

/**
 * useWebSocket hook
 * Provides real-time WebSocket connection for live updates
 * @param {Object} options - Configuration options
 * @param {Array<string>} options.channels - Channels to subscribe to
 * @param {Function} options.onSaleCreated - Callback for new sales
 * @param {Function} options.onSaleUpdated - Callback for sale updates
 * @param {Function} options.onInventoryAlert - Callback for inventory alerts
 * @param {Function} options.onNotification - Callback for notifications
 * @param {Function} options.onTrafficUpdate - Callback for traffic updates
 * @param {Function} options.onDashboardUpdate - Callback for dashboard updates
 * @returns {Object} WebSocket state and controls
 */
export const useWebSocket = (options = {}) => {
  const {
    channels = [],
    onSaleCreated,
    onSaleUpdated,
    onInventoryAlert,
    onNotification,
    onTrafficUpdate,
    onDashboardUpdate,
    enabled = true
  } = options;

  const { user, activeTenantId } = useAuth();
  const socketRef = useRef(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  /** Stable key so inline `channels={[]}` does not recreate the socket every render */
  const channelsKey = JSON.stringify(Array.isArray(channels) ? channels : []);

  /** Always call latest handlers without listing them in the effect deps (avoids reconnect loops) */
  const handlersRef = useRef({});
  handlersRef.current = {
    onSaleCreated,
    onSaleUpdated,
    onInventoryAlert,
    onNotification,
    onTrafficUpdate,
    onDashboardUpdate
  };

  const getToken = useCallback(() => {
    return localStorage.getItem('token');
  }, []);

  useEffect(() => {
    if (!isWsEnabled() || !enabled || !user?.id || !activeTenantId) {
      return;
    }

    const token = getToken();
    if (!token) {
      console.warn('[WebSocket] No auth token available');
      return;
    }

    let channelList = [];
    try {
      channelList = JSON.parse(channelsKey);
      if (!Array.isArray(channelList)) channelList = [];
    } catch {
      channelList = [];
    }

    const socket = io(WS_URL, {
      auth: { token, tenantId: activeTenantId },
      query: { token, tenantId: activeTenantId },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[WebSocket] Connected');
      setIsConnected(true);
      reconnectAttempts.current = 0;

      if (channelList.length > 0) {
        socket.emit('subscribe', channelList);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('[WebSocket] Disconnected:', reason);
      setIsConnected(false);
    });

    socket.on('connect_error', (error) => {
      const msg = error?.message || (typeof error === 'string' ? error : 'websocket error');
      console.error('[WebSocket] Connection error:', msg);

      if (error?.message === 'Invalid authentication token') {
        try {
          localStorage.removeItem('token');
          localStorage.removeItem('tenantMemberships');
          localStorage.removeItem('activeTenantId');
          console.warn('[WebSocket] Cleared invalid auth token from storage. User must log in again.');
        } catch (_) {
          // ignore storage errors
        }
      }

      reconnectAttempts.current += 1;
      if (reconnectAttempts.current >= maxReconnectAttempts) {
        console.warn('[WebSocket] Max reconnection attempts reached');
      }
    });

    socket.on('sale:created', (data) => {
      setLastMessage({ type: 'sale:created', data, timestamp: new Date() });
      handlersRef.current.onSaleCreated?.(data);
    });

    socket.on('sale:updated', (data) => {
      setLastMessage({ type: 'sale:updated', data, timestamp: new Date() });
      handlersRef.current.onSaleUpdated?.(data);
    });

    socket.on('inventory:alert', (data) => {
      setLastMessage({ type: 'inventory:alert', data, timestamp: new Date() });
      handlersRef.current.onInventoryAlert?.(data);
    });

    socket.on('notification', (data) => {
      setLastMessage({ type: 'notification', data, timestamp: new Date() });
      handlersRef.current.onNotification?.(data);
    });

    socket.on('traffic:update', (data) => {
      setLastMessage({ type: 'traffic:update', data, timestamp: new Date() });
      handlersRef.current.onTrafficUpdate?.(data);
    });

    socket.on('dashboard:update', (data) => {
      setLastMessage({ type: 'dashboard:update', data, timestamp: new Date() });
      handlersRef.current.onDashboardUpdate?.(data);
    });

    socket.on('pong', () => {});

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('sale:created');
      socket.off('sale:updated');
      socket.off('inventory:alert');
      socket.off('notification');
      socket.off('traffic:update');
      socket.off('dashboard:update');
      socket.off('pong');
      socket.disconnect();
    };
  }, [enabled, user?.id, activeTenantId, getToken, channelsKey]);

  const subscribe = useCallback((newChannels) => {
    if (socketRef.current?.connected && Array.isArray(newChannels)) {
      socketRef.current.emit('subscribe', newChannels);
    }
  }, []);

  const unsubscribe = useCallback((channelsToRemove) => {
    if (socketRef.current?.connected && Array.isArray(channelsToRemove)) {
      socketRef.current.emit('unsubscribe', channelsToRemove);
    }
  }, []);

  const ping = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('ping');
    }
  }, []);

  const reconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current.connect();
    }
  }, []);

  return {
    isConnected,
    lastMessage,
    subscribe,
    unsubscribe,
    ping,
    reconnect,
    socket: socketRef.current
  };
};

export default useWebSocket;
