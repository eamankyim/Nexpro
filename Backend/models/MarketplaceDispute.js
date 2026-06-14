const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MarketplaceDispute = sequelize.define('MarketplaceDispute', {
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
  marketplaceOrderPaymentId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'marketplace_order_payments', key: 'id' },
  },
  storefrontCustomerId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'storefront_customers', key: 'id' },
  },
  status: {
    type: DataTypes.ENUM('open', 'under_review', 'resolved_release', 'resolved_refund', 'cancelled'),
    allowNull: false,
    defaultValue: 'open',
  },
  reason: {
    type: DataTypes.STRING(120),
    allowNull: false,
    defaultValue: 'issue',
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  openedByEmail: {
    type: DataTypes.STRING(160),
    allowNull: true,
  },
  openedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  resolvedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  resolvedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
  },
  resolutionNotes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
}, {
  tableName: 'marketplace_disputes',
  timestamps: true,
});

module.exports = MarketplaceDispute;
