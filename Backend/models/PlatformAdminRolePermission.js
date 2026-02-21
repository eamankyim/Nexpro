const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PlatformAdminRolePermission = sequelize.define('PlatformAdminRolePermission', {
  roleId: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
    references: {
      model: 'platform_admin_roles',
      key: 'id'
    },
    field: 'roleId'
  },
  permissionId: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
    references: {
      model: 'platform_admin_permissions',
      key: 'id'
    },
    field: 'permissionId'
  }
}, {
  tableName: 'platform_admin_role_permissions',
  timestamps: false
});

module.exports = PlatformAdminRolePermission;
