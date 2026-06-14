const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MarketplaceOrderPayment = sequelize.define('MarketplaceOrderPayment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tenantId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'tenants', key: 'id' },
  },
  shopId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'shops', key: 'id' },
  },
  saleId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'sales', key: 'id' },
  },
  storefrontCustomerId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'storefront_customers', key: 'id' },
  },
  currency: {
    type: DataTypes.STRING(8),
    allowNull: false,
    defaultValue: 'GHS',
  },
  grossAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
  },
  feeAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
  },
  netAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
  },
  refundedAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.ENUM('paid_held', 'released', 'refunded', 'disputed'),
    allowNull: false,
    defaultValue: 'paid_held',
  },
  paymentProvider: {
    type: DataTypes.STRING(40),
    allowNull: true,
  },
  providerReference: {
    type: DataTypes.STRING(160),
    allowNull: true,
  },
  heldAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  releaseEligibleAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  releasedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  refundedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
}, {
  tableName: 'marketplace_order_payments',
  timestamps: true,
});

module.exports = MarketplaceOrderPayment;
