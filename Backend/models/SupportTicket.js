const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SupportTicket = sequelize.define(
  'SupportTicket',
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
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'open',
    },
    priority: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'medium',
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    source: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'admin_manual',
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
    assignedTo: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
    },
    resolvedAt: {
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
    tableName: 'support_tickets',
    timestamps: true,
    indexes: [
      { fields: ['tenantId'] },
      { fields: ['status'] },
      { fields: ['priority'] },
      { fields: ['assignedTo'] },
      { fields: ['createdAt'] },
    ],
  }
);

module.exports = SupportTicket;
