const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Line returned from an original sale item.
 * disposition restock → increment sellable stock; write_off → no restock (damaged/defective).
 */
const SaleReturnItem = sequelize.define('SaleReturnItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  saleReturnId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'sale_returns', key: 'id', onDelete: 'CASCADE' }
  },
  saleItemId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'sale_items', key: 'id' }
  },
  productId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'products', key: 'id' }
  },
  productVariantId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'product_variants', key: 'id' }
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  sku: {
    type: DataTypes.STRING,
    allowNull: true
  },
  qtyReturned: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 1
  },
  unitAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  },
  lineRefundAmount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  },
  disposition: {
    type: DataTypes.ENUM('restock', 'write_off'),
    allowNull: false,
    defaultValue: 'restock'
  },
  reasonCode: {
    type: DataTypes.STRING(64),
    allowNull: true
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'sale_return_items',
  timestamps: true,
  indexes: [
    { fields: ['saleReturnId'] },
    { fields: ['saleItemId'] },
    { fields: ['productId'] }
  ]
});

module.exports = SaleReturnItem;
