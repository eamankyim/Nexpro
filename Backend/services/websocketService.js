const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

let io = null;

// Store connected clients by tenant
const tenantSockets = new Map();

/**
 * Initialize WebSocket server
 * @param {http.Server} server - HTTP server instance
 */
const initializeWebSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: config.cors.origin,
      methods: ['GET', 'POST'],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });

  // Authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;
    
    if (!token) {
      return next(new Error('Authentication token required'));
    }

    try {
      const decoded = jwt.verify(token, config.jwtSecret);
      socket.userId = decoded.id;
      socket.tenantId = socket.handshake.auth.tenantId || socket.handshake.query.tenantId;
      next();
    } catch (error) {
      return next(new Error('Invalid authentication token'));
    }
  });

  io.on('connection', (socket) => {
    const { userId, tenantId } = socket;
    
    console.log(`[WebSocket] Client connected: userId=${userId}, tenantId=${tenantId}`);

    // Join tenant room
    if (tenantId) {
      socket.join(`tenant:${tenantId}`);
      
      // Track connected sockets per tenant
      if (!tenantSockets.has(tenantId)) {
        tenantSockets.set(tenantId, new Set());
      }
      tenantSockets.get(tenantId).add(socket.id);
    }

    // Handle client subscribing to specific events
    socket.on('subscribe', (channels) => {
      if (Array.isArray(channels)) {
        channels.forEach(channel => {
          if (tenantId) {
            socket.join(`tenant:${tenantId}:${channel}`);
          }
        });
      }
    });

    // Handle client unsubscribing
    socket.on('unsubscribe', (channels) => {
      if (Array.isArray(channels)) {
        channels.forEach(channel => {
          if (tenantId) {
            socket.leave(`tenant:${tenantId}:${channel}`);
          }
        });
      }
    });

    // Ping/pong for connection health
    socket.on('ping', () => {
      socket.emit('pong');
    });

    socket.on('disconnect', () => {
      console.log(`[WebSocket] Client disconnected: userId=${userId}, tenantId=${tenantId}`);
      
      // Remove from tracking
      if (tenantId && tenantSockets.has(tenantId)) {
        tenantSockets.get(tenantId).delete(socket.id);
        if (tenantSockets.get(tenantId).size === 0) {
          tenantSockets.delete(tenantId);
        }
      }
    });
  });

  console.log('[WebSocket] Server initialized');
  return io;
};

/**
 * Broadcast event to all clients in a tenant
 * @param {string} tenantId - Tenant ID
 * @param {string} event - Event name
 * @param {object} data - Event data
 */
const broadcastToTenant = (tenantId, event, data) => {
  if (!io) {
    console.warn('[WebSocket] Server not initialized');
    return;
  }

  io.to(`tenant:${tenantId}`).emit(event, {
    ...data,
    timestamp: new Date().toISOString()
  });
};

/**
 * Broadcast to specific channel within a tenant
 * @param {string} tenantId - Tenant ID
 * @param {string} channel - Channel name (e.g., 'sales', 'dashboard')
 * @param {string} event - Event name
 * @param {object} data - Event data
 */
const broadcastToChannel = (tenantId, channel, event, data) => {
  if (!io) {
    console.warn('[WebSocket] Server not initialized');
    return;
  }

  io.to(`tenant:${tenantId}:${channel}`).emit(event, {
    ...data,
    timestamp: new Date().toISOString()
  });
};

/**
 * Emit events for new sale
 * @param {string} tenantId - Tenant ID
 * @param {object} sale - Sale data
 */
const emitNewSale = (tenantId, sale) => {
  broadcastToTenant(tenantId, 'sale:created', {
    type: 'sale:created',
    sale: {
      id: sale.id,
      saleNumber: sale.saleNumber,
      total: sale.total,
      status: sale.status,
      paymentMethod: sale.paymentMethod,
      customerName: sale.customer?.name || 'Walk-in',
      itemCount: sale.items?.length || 0,
      createdAt: sale.createdAt
    }
  });

  // Also emit dashboard update
  broadcastToChannel(tenantId, 'dashboard', 'dashboard:update', {
    type: 'sale',
    action: 'created'
  });
};

/**
 * Emit events for sale status change
 * @param {string} tenantId - Tenant ID
 * @param {object} sale - Sale data
 * @param {string} oldStatus - Previous status
 */
const emitSaleStatusChange = (tenantId, sale, oldStatus) => {
  broadcastToTenant(tenantId, 'sale:updated', {
    type: 'sale:updated',
    sale: {
      id: sale.id,
      saleNumber: sale.saleNumber,
      status: sale.status,
      oldStatus,
      total: sale.total
    }
  });
};

/**
 * Emit events for new customer
 * @param {string} tenantId - Tenant ID
 * @param {object} customer - Customer data
 */
const emitNewCustomer = (tenantId, customer) => {
  broadcastToTenant(tenantId, 'customer:created', {
    type: 'customer:created',
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone
    }
  });
};

/**
 * Emit inventory alert
 * @param {string} tenantId - Tenant ID
 * @param {object} product - Product data
 * @param {string} alertType - Alert type (low_stock, out_of_stock)
 */
const emitInventoryAlert = (tenantId, product, alertType) => {
  broadcastToTenant(tenantId, 'inventory:alert', {
    type: 'inventory:alert',
    alertType,
    product: {
      id: product.id,
      name: product.name,
      sku: product.sku,
      quantity: product.quantityOnHand,
      reorderLevel: product.reorderLevel
    }
  });
};

/**
 * Emit foot traffic update
 * @param {string} tenantId - Tenant ID
 * @param {object} traffic - Traffic data
 */
const emitFootTrafficUpdate = (tenantId, traffic) => {
  broadcastToTenant(tenantId, 'traffic:update', {
    type: 'traffic:update',
    traffic: {
      todayCount: traffic.visitorCount,
      timestamp: traffic.createdAt
    }
  });
};

/**
 * Emit notification
 * @param {string} tenantId - Tenant ID
 * @param {string} userId - Target user ID (optional, for user-specific notifications)
 * @param {object} notification - Notification data
 */
const emitNotification = (tenantId, userId, notification) => {
  if (userId) {
    // User-specific notification - find user's socket
    if (io) {
      const sockets = io.sockets.sockets;
      sockets.forEach((socket) => {
        if (socket.userId === userId && socket.tenantId === tenantId) {
          socket.emit('notification', notification);
        }
      });
    }
  } else {
    // Broadcast to all tenant users
    broadcastToTenant(tenantId, 'notification', notification);
  }
};

/**
 * Get number of connected clients for a tenant
 * @param {string} tenantId - Tenant ID
 * @returns {number} Number of connected clients
 */
const getConnectedCount = (tenantId) => {
  if (!tenantSockets.has(tenantId)) return 0;
  return tenantSockets.get(tenantId).size;
};

/**
 * Get WebSocket IO instance
 * @returns {Server|null} Socket.io server instance
 */
const getIO = () => io;

module.exports = {
  initializeWebSocket,
  broadcastToTenant,
  broadcastToChannel,
  emitNewSale,
  emitSaleStatusChange,
  emitNewCustomer,
  emitInventoryAlert,
  emitFootTrafficUpdate,
  emitNotification,
  getConnectedCount,
  getIO
};
