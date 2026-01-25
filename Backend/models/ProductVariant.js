const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ProductVariant = sequelize.define('ProductVariant', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  productId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'products',
      key: 'id',
      onDelete: 'CASCADE'
    }
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  sku: {
    type: DataTypes.STRING
  },
  barcode: {
    type: DataTypes.STRING
  },
  // Variant-specific pricing (optional - can inherit from product)
  costPrice: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true
  },
  sellingPrice: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true
  },
  // Variant-specific stock
  quantityOnHand: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  },
  // Variant attributes (size, color, etc.)
  attributes: {
    type: DataTypes.JSONB,
    defaultValue: {}
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
  tableName: 'product_variants',
  timestamps: true,
  indexes: [
    {
      fields: ['productId']
    },
    {
      unique: true,
      fields: ['productId', 'sku'],
      where: {
        sku: { [require('sequelize').Op.ne]: null }
      }
    },
    {
      fields: ['barcode']
    }
  ]
});

module.exports = ProductVariant;
