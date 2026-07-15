const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * POS refund / exchange header linked to an original sale.
 * Separate from marketplace Trade Assurance refunds (those only flip sale.status).
 */
const SaleReturn = sequelize.define('SaleReturn', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  tenantId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'tenants', key: 'id' }
  },
  shopId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'shops', key: 'id' }
  },
  originalSaleId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'sales', key: 'id' }
  },
  returnNumber: {
    type: DataTypes.STRING,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('refund', 'exchange'),
    allowNull: false,
    defaultValue: 'refund'
  },
  status: {
    type: DataTypes.ENUM('completed', 'cancelled'),
    allowNull: false,
    defaultValue: 'completed'
  },
  reasonSummary: {
    type: DataTypes.STRING,
    allowNull: true
  },
  refundAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  },
  collectAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  },
  refundMethod: {
    type: DataTypes.ENUM('cash', 'card', 'mobile_money', 'bank_transfer', 'other'),
    allowNull: true
  },
  collectMethod: {
    type: DataTypes.ENUM('cash', 'card', 'mobile_money', 'bank_transfer', 'other'),
    allowNull: true
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' }
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'sale_returns',
  timestamps: true,
  indexes: [
    { fields: ['tenantId'] },
    { fields: ['shopId'] },
    { fields: ['originalSaleId'] },
    { fields: ['returnNumber'] },
    { fields: ['createdAt'] }
  ]
});

module.exports = SaleReturn;
