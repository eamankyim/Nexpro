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
  businessType: {
    type: DataTypes.ENUM('shop', 'studio', 'pharmacy'),
    allowNull: true,
    comment: 'Business type this category belongs to (null = applies to all)'
  },
  studioType: {
    type: DataTypes.ENUM('printing_press', 'mechanic', 'barber', 'salon'),
    allowNull: true,
    comment: 'Studio type (only relevant when businessType is studio)'
  },
  shopType: {
    type: DataTypes.STRING(50),
    allowNull: true,
    comment: 'Shop type (only relevant when businessType is shop)'
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






