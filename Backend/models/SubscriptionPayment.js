const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SubscriptionPayment = sequelize.define(
  'SubscriptionPayment',
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
    plan: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'starter | professional | enterprise',
    },
    billingPeriod: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'monthly',
      comment: 'monthly | yearly',
    },
    periodStart: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    periodEnd: {
      type: DataTypes.DATE,
      allowNull: false,
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
      defaultValue: 'success',
      comment: 'success | pending | failed | refunded',
    },
    provider: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'manual',
      comment: 'paystack | manual',
    },
    providerReference: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    recordedBy: {
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
    tableName: 'subscription_payments',
    timestamps: true,
    indexes: [
      { fields: ['tenantId'] },
      { fields: ['tenantId', 'periodStart', 'periodEnd'] },
      { fields: ['status'] },
      {
        unique: true,
        fields: ['provider', 'providerReference'],
        where: { providerReference: { [require('sequelize').Op.ne]: null } },
      },
    ],
  }
);

module.exports = SubscriptionPayment;
