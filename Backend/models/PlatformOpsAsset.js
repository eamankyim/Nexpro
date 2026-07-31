const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PlatformOpsAsset = sequelize.define('PlatformOpsAsset', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    comment: 'domain | server | service | other',
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'active',
    comment: 'active | archived',
  },
  expiresOn: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  loginUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  username: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  passwordEncrypted: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  details: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  customerId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'customers', key: 'id' },
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
  },
  updatedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'users', key: 'id' },
  },
}, {
  timestamps: true,
  tableName: 'platform_ops_assets',
});

module.exports = PlatformOpsAsset;
