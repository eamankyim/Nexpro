const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Marketer cashout request against due commissions (manual payout by business).
 */
const PartnerCashoutRequest = sequelize.define(
  'PartnerCashoutRequest',
  {
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
    marketerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'marketers', key: 'id' },
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'GHS',
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'pending',
      comment: 'pending | approved | rejected | paid',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    payoutReference: {
      type: DataTypes.STRING(160),
      allowNull: true,
    },
    processedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    processedByUserId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
  },
  {
    tableName: 'partner_cashout_requests',
    timestamps: true,
    indexes: [
      { fields: ['tenantId', 'status'] },
      { fields: ['marketerId', 'status'] },
      { fields: ['createdAt'] },
    ],
  }
);

module.exports = PartnerCashoutRequest;
