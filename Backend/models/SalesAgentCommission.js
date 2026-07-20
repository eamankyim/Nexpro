const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SalesAgentCommission = sequelize.define(
  'SalesAgentCommission',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    salesAgentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'sales_agents', key: 'id' },
    },
    tenantId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'tenants', key: 'id' },
    },
    subscriptionPaymentId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'subscription_payments', key: 'id' },
    },
    periodNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: '1–3 successful paid subscription periods for this tenant-agent pair',
    },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      comment: 'Amount in smallest currency unit (pesewas for GHS)',
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: false,
      defaultValue: 'GHS',
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'due',
      comment: 'due | paid',
    },
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    paidBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
  },
  {
    tableName: 'sales_agent_commissions',
    timestamps: true,
    indexes: [
      { fields: ['salesAgentId', 'status'] },
      { fields: ['tenantId'] },
      { unique: true, fields: ['salesAgentId', 'tenantId', 'periodNumber'] },
    ],
  }
);

module.exports = SalesAgentCommission;
