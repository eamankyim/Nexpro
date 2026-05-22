const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UserShop = sequelize.define(
  'UserShop',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'users', key: 'id' },
    },
    tenantId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'tenants', key: 'id' },
    },
    shopId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'shops', key: 'id' },
    },
  },
  {
    tableName: 'user_shops',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['userId', 'shopId'] },
      { fields: ['userId', 'tenantId'] },
    ],
  }
);

module.exports = UserShop;
