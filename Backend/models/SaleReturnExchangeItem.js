const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Outgoing products given to the customer as part of an exchange.
 * Stock is decremented like a normal sale when the return is completed.
 */
const SaleReturnExchangeItem = sequelize.define('SaleReturnExchangeItem', {
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
  quantity: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 1
  },
  unitPrice: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  },
  lineTotal: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'sale_return_exchange_items',
  timestamps: true,
  indexes: [
    { fields: ['saleReturnId'] },
    { fields: ['productId'] }
  ]
});

module.exports = SaleReturnExchangeItem;
