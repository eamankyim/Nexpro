const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PlatformAdminRole = sequelize.define('PlatformAdminRole', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  department: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  isDefault: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_default'
  }
}, {
  tableName: 'platform_admin_roles',
  timestamps: true
});

module.exports = PlatformAdminRole;
