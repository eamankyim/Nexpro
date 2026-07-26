const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PartnershipApplication = sequelize.define(
  'PartnershipApplication',
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
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'pending',
      comment: 'pending | approved | declined',
    },
    pitch: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    decisionNote: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    reviewedBy: {
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
    tableName: 'partnership_applications',
    timestamps: true,
    indexes: [
      { fields: ['tenantId', 'status'] },
      { fields: ['marketerId', 'status'] },
      { unique: true, fields: ['tenantId', 'marketerId'] },
    ],
  }
);

module.exports = PartnershipApplication;
