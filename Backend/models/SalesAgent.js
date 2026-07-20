const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SalesAgent = sequelize.define(
  'SalesAgent',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(150),
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
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: 'pending',
      comment: 'pending | active | disabled',
    },
    commissionAmount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5000,
      comment: 'Commission in smallest currency unit (pesewas for GHS) per paid subscription event',
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    leadId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: 'leads', key: 'id' },
    },
    approvedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    approvedBy: {
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
    tableName: 'sales_agents',
    timestamps: true,
    indexes: [{ fields: ['status'] }, { fields: ['email'] }],
  }
);

module.exports = SalesAgent;
