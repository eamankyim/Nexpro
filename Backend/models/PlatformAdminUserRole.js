const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PlatformAdminUserRole = sequelize.define('PlatformAdminUserRole', {
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
    references: {
      model: 'users',
      key: 'id'
    },
    field: 'userId'
  },
  roleId: {
    type: DataTypes.UUID,
    allowNull: false,
    primaryKey: true,
    references: {
      model: 'platform_admin_roles',
      key: 'id'
    },
    field: 'roleId'
  }
}, {
  tableName: 'platform_admin_user_roles',
  timestamps: true
});

module.exports = PlatformAdminUserRole;
