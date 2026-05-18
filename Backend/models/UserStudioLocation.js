const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UserStudioLocation = sequelize.define(
  'UserStudioLocation',
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
    studioLocationId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: 'studio_locations', key: 'id' },
    },
  },
  {
    tableName: 'user_studio_locations',
    timestamps: true,
    indexes: [
      { unique: true, fields: ['userId', 'studioLocationId'] },
      { fields: ['userId', 'tenantId'] },
    ],
  }
);

module.exports = UserStudioLocation;
