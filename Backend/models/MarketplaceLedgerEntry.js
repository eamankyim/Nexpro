const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MarketplaceLedgerEntry = sequelize.define('MarketplaceLedgerEntry', {
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
  marketplacePayoutId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'marketplace_payouts', key: 'id' },
  },
  entryType: {
    type: DataTypes.ENUM('hold', 'release', 'payout', 'refund', 'fee', 'adjustment'),
    allowNull: false,
  },
  balanceType: {
    type: DataTypes.ENUM('pending', 'available', 'paid_out', 'fee', 'refunded'),
    allowNull: false,
  },
  direction: {
    type: DataTypes.ENUM('credit', 'debit'),
    allowNull: false,
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
  description: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
}, {
  tableName: 'marketplace_ledger_entries',
  timestamps: true,
});

module.exports = MarketplaceLedgerEntry;
