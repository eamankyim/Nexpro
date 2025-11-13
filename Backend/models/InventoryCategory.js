const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InventoryCategory = sequelize.define('InventoryCategory', {
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
    unique: 'tenant_inventory_category_name'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: 'tenant_inventory_category_name'
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
}, {
  tableName: 'inventory_categories',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['tenantId', 'name']
    }
  ]
});

module.exports = InventoryCategory;






