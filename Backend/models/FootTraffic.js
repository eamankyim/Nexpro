const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * FootTraffic Model
 * Tracks customer visits/foot traffic to shops
 * Supports both manual entry and IoT device integration
 */
const FootTraffic = sequelize.define('FootTraffic', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  tenantId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'tenants',
      key: 'id'
    }
  },
  shopId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'shops',
      key: 'id'
    }
  },
  // Traffic count for the period
  visitorCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: 0
    }
  },
  // Entry method: manual, iot_counter, camera, mobile_checkin
  entryMethod: {
    type: DataTypes.ENUM('manual', 'iot_counter', 'camera', 'mobile_checkin'),
    allowNull: false,
    defaultValue: 'manual'
  },
  // Period type: hourly, daily, custom
  periodType: {
    type: DataTypes.ENUM('hourly', 'daily', 'custom'),
    allowNull: false,
    defaultValue: 'daily'
  },
  // Period start and end times
  periodStart: {
    type: DataTypes.DATE,
    allowNull: false
  },
  periodEnd: {
    type: DataTypes.DATE,
    allowNull: false
  },
  // Conversion tracking (visitors who made purchases)
  purchaseCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  // Revenue generated during this period
  periodRevenue: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  },
  // Device info (for IoT integration)
  deviceId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // Weather conditions (can affect traffic)
  weather: {
    type: DataTypes.STRING,
    allowNull: true
  },
  // Notes for manual entries
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // Who recorded this entry
  recordedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  // Additional metadata (IoT data, etc.)
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'foot_traffic',
  timestamps: true,
  indexes: [
    {
      fields: ['tenantId']
    },
    {
      fields: ['shopId']
    },
    {
      fields: ['periodStart']
    },
    {
      fields: ['periodEnd']
    },
    {
      fields: ['entryMethod']
    },
    {
      fields: ['tenantId', 'periodStart', 'periodEnd']
    }
  ]
});

module.exports = FootTraffic;
