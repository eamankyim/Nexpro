const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Sale = sequelize.define('Sale', {
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
  saleNumber: {
    type: DataTypes.STRING,
    allowNull: false
  },
  customerId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'customers',
      key: 'id'
    }
  },
  // Sale totals
  subtotal: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  },
  discount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  },
  tax: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  },
  total: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  },
  // Payment
  paymentMethod: {
    type: DataTypes.ENUM('cash', 'card', 'mobile_money', 'bank_transfer', 'credit', 'other'),
    allowNull: false,
    defaultValue: 'cash'
  },
  amountPaid: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  },
  change: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'cancelled', 'refunded'),
    allowNull: false,
    defaultValue: 'completed'
  },
  // Invoice reference (if invoice was generated)
  invoiceId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'invoices',
      key: 'id'
    }
  },
  soldBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  notes: {
    type: DataTypes.TEXT
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'sales',
  timestamps: true,
  indexes: [
    {
      fields: ['tenantId']
    },
    {
      fields: ['shopId']
    },
    {
      fields: ['customerId']
    },
    {
      fields: ['saleNumber']
    },
    {
      fields: ['status']
    },
    {
      fields: ['createdAt']
    }
  ]
});

module.exports = Sale;
