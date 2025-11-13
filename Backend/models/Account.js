const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Account = sequelize.define(
  'Account',
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
      unique: 'tenant_account_code_unique'
    },
    code: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: 'tenant_account_code_unique'
    },
    name: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    category: {
      type: DataTypes.STRING(50)
    },
    parentId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'accounts',
        key: 'id'
      }
    },
    description: {
      type: DataTypes.TEXT
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  },
  {
    tableName: 'accounts',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['tenantId', 'code']
      }
    ]
  }
);

module.exports = Account;



