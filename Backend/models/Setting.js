const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Setting = sequelize.define(
  'Setting',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    tenantId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'tenants',
        key: 'id'
      },
      unique: 'tenant_key_unique'
    },
    key: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: 'tenant_key_unique'
    },
    value: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {}
    },
    description: {
      type: DataTypes.TEXT
    }
  },
  {
    tableName: 'settings',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['tenantId', 'key']
      }
    ]
  }
);

module.exports = Setting;



