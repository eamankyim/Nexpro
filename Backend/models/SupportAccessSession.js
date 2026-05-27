const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SupportAccessSession = sequelize.define(
  'SupportAccessSession',
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
    adminUserId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    supportTicketId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'support_tickets', key: 'id' },
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    mode: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: 'read_only',
    },
    startedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    endedAt: {
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
    tableName: 'support_access_sessions',
    timestamps: true,
    indexes: [
      { fields: ['tenantId'] },
      { fields: ['adminUserId'] },
      { fields: ['expiresAt'] },
      { fields: ['endedAt'] },
    ],
  }
);

module.exports = SupportAccessSession;
