const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PlatformAdminPermission = sequelize.define('PlatformAdminPermission', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  key: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: false
  }
}, {
  tableName: 'platform_admin_permissions',
  timestamps: true
});

module.exports = PlatformAdminPermission;
