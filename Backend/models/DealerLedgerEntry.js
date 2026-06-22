const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DealerLedgerEntry = sequelize.define('DealerLedgerEntry', {
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
  dealerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'dealers', key: 'id' },
  },
  shopId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'shops', key: 'id' },
  },
  entryType: {
    type: DataTypes.ENUM('opening_balance', 'sale_charge', 'payment', 'adjustment', 'reversal'),
    allowNull: false,
  },
  direction: {
    type: DataTypes.ENUM('debit', 'credit'),
    allowNull: false,
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  balanceAfter: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  saleId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'sales', key: 'id' },
  },
  paymentId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'payments', key: 'id' },
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  entryDate: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
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
  tableName: 'dealer_ledger_entries',
  timestamps: true,
  indexes: [
    { fields: ['tenantId'] },
    { fields: ['dealerId', 'entryDate'] },
  ],
});

module.exports = DealerLedgerEntry;
