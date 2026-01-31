const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ProductCategory = sequelize.define('ProductCategory', {
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
    unique: 'tenant_product_category_name'
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: 'tenant_product_category_name'
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
  tableName: 'product_categories',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['tenantId', 'name']
    }
  ]
});

module.exports = ProductCategory;
