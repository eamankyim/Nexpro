const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SalesAgentCode = sequelize.define(
  'SalesAgentCode',
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
    code: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'active',
      comment: 'active | disabled',
    },
    label: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
  },
  {
    tableName: 'sales_agent_codes',
    timestamps: true,
    indexes: [
      { fields: ['salesAgentId'] },
      { fields: ['status'] },
      { unique: true, fields: ['code'] },
    ],
  }
);

module.exports = SalesAgentCode;
