const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ExpiryAlert = sequelize.define('ExpiryAlert', {
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
  drugId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'drugs',
      key: 'id'
    }
  },
  batchNumber: {
    type: DataTypes.STRING
  },
  expiryDate: {
    type: DataTypes.DATEONLY,
    allowNull: false
  },
  quantity: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  },
  alertType: {
    type: DataTypes.ENUM('expired', 'expiring_soon', 'expiring_30_days', 'expiring_60_days', 'expiring_90_days'),
    allowNull: false
  },
  daysUntilExpiry: {
    type: DataTypes.INTEGER
  },
  isAcknowledged: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  acknowledgedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  acknowledgedAt: {
    type: DataTypes.DATE
  },
  notes: {
    type: DataTypes.TEXT
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'expiry_alerts',
  timestamps: true,
  indexes: [
    {
      fields: ['tenantId']
    },
    {
      fields: ['drugId']
    },
    {
      fields: ['expiryDate']
    },
    {
      fields: ['alertType']
    },
    {
      fields: ['isAcknowledged']
    }
  ]
});

module.exports = ExpiryAlert;
