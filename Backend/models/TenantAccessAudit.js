const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TenantAccessAudit = sequelize.define(
  'TenantAccessAudit',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    tenantId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    actorUserId: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    action: {
      type: DataTypes.STRING(80),
      allowNull: false,
      defaultValue: 'tenant_access_updated',
    },
    before: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    after: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: 'tenant_access_audits',
    timestamps: true,
    indexes: [
      { fields: ['tenantId'] },
      { fields: ['actorUserId'] },
      { fields: ['createdAt'] },
    ],
  }
);

module.exports = TenantAccessAudit;
