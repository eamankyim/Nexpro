const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * Ledger of retail product stock changes (receive, adjustment, transfer).
 * Sales continue to be read from sale_items; this table covers non-sale moves.
 */
const ProductStockMovement = sequelize.define('ProductStockMovement', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tenantId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'tenants',
      key: 'id',
    },
  },
  productId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'products',
      key: 'id',
    },
  },
  productVariantId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'product_variants',
      key: 'id',
    },
  },
  shopId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'shops',
      key: 'id',
    },
  },
  type: {
    type: DataTypes.ENUM('receive', 'adjustment', 'transfer_in', 'transfer_out', 'return'),
    allowNull: false,
    defaultValue: 'adjustment',
  },
  quantityDelta: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  previousQuantity: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  newQuantity: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  reason: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  reference: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  occurredAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
}, {
  tableName: 'product_stock_movements',
  timestamps: true,
});

module.exports = ProductStockMovement;
