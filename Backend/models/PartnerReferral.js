const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Marketer-created referral lead. Matched to ABS customers by email/phone.
 */
const PartnerReferral = sequelize.define(
  'PartnerReferral',
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
    partnershipId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'partnerships', key: 'id' },
    },
    clientName: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    phone: {
      type: DataTypes.STRING(40),
      allowNull: true,
    },
    emailNormalized: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    phoneNormalized: {
      type: DataTypes.STRING(40),
      allowNull: true,
    },
    location: {
      type: DataTypes.STRING(160),
      allowNull: true,
    },
    note: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'pending',
      comment: 'pending | matched | conflict | closed',
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'customers', key: 'id' },
    },
    matchedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    matchedBy: {
      type: DataTypes.STRING(40),
      allowNull: true,
      comment: 'create | customer_upsert | manual',
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
  },
  {
    tableName: 'partner_referrals',
    timestamps: true,
    indexes: [
      { fields: ['tenantId', 'status'] },
      { fields: ['marketerId', 'status'] },
      { fields: ['partnershipId'] },
      { fields: ['customerId'] },
      { fields: ['emailNormalized'] },
      { fields: ['phoneNormalized'] },
    ],
  }
);

module.exports = PartnerReferral;
