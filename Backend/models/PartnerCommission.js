const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Commission earned by a marketer when a customer payment is collected.
 */
const PartnerCommission = sequelize.define(
  'PartnerCommission',
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
    partnershipId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'partnerships', key: 'id' },
    },
    marketerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'marketers', key: 'id' },
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'customers', key: 'id' },
    },
    saleId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'sales', key: 'id' },
    },
    invoiceId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'invoices', key: 'id' },
    },
    paymentId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'payments', key: 'id' },
    },
    rateType: {
      type: DataTypes.STRING(32),
      allowNull: false,
      comment: 'first | returning',
    },
    ratePercent: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
    },
    paymentAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      comment: 'Amount collected that this commission is based on',
    },
    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      comment: 'Commission amount in GHS',
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
    paidNote: {
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
    tableName: 'partner_commissions',
    timestamps: true,
    indexes: [
      { fields: ['tenantId', 'status'] },
      { fields: ['marketerId', 'status'] },
      { fields: ['partnershipId', 'status'] },
      { fields: ['paymentId'] },
      { fields: ['customerId'] },
      { fields: ['createdAt'] },
    ],
  }
);

module.exports = PartnerCommission;
