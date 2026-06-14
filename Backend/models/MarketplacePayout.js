const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MarketplacePayout = sequelize.define('MarketplacePayout', {
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
    allowNull: true,
    references: { model: 'sales', key: 'id' },
  },
  marketplaceOrderPaymentId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'marketplace_order_payments', key: 'id' },
  },
  payoutNumber: {
    type: DataTypes.STRING(40),
    allowNull: false,
    unique: true,
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  currency: {
    type: DataTypes.STRING(8),
    allowNull: false,
    defaultValue: 'GHS',
  },
  status: {
    type: DataTypes.ENUM('available', 'processing', 'paid_out', 'cancelled'),
    allowNull: false,
    defaultValue: 'available',
  },
  releaseReason: {
    type: DataTypes.STRING(120),
    allowNull: true,
  },
  releasedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
  },
  releasedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  paidOutAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
}, {
  tableName: 'marketplace_payouts',
  timestamps: true,
});

module.exports = MarketplacePayout;
