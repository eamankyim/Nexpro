const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Partnership = sequelize.define(
  'Partnership',
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
    applicationId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'partnership_applications', key: 'id' },
    },
    referralCode: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'active',
      comment: 'active | revoked',
    },
    firstClientRatePercent: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
    },
    returningClientRatePercent: {
      type: DataTypes.DECIMAL(6, 2),
      allowNull: false,
    },
    attributionMonths: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 12,
    },
    activatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    revokedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
  },
  {
    tableName: 'partnerships',
    timestamps: true,
    indexes: [
      { fields: ['tenantId', 'status'] },
      { fields: ['marketerId', 'status'] },
      { unique: true, fields: ['referralCode'] },
      { unique: true, fields: ['tenantId', 'marketerId'] },
    ],
  }
);

module.exports = Partnership;
