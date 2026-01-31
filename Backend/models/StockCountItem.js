const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * StockCountItem Model
 * Individual product counts within a stock count session
 */
const StockCountItem = sequelize.define('StockCountItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  stockCountId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'stock_counts',
      key: 'id'
    }
  },
  tenantId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'tenants',
      key: 'id'
    }
  },
  productId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'products',
      key: 'id'
    }
  },
  productVariantId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'product_variants',
      key: 'id'
    }
  },
  // Snapshot of product info at count time
  productName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  productSku: {
    type: DataTypes.STRING
  },
  productBarcode: {
    type: DataTypes.STRING
  },
  unitCost: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0
  },
  // Count quantities
  systemQuantity: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  },
  countedQuantity: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true
  },
  // Variance calculation
  varianceQuantity: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true
  },
  varianceValue: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true
  },
  varianceType: {
    type: DataTypes.ENUM('match', 'shrinkage', 'overage', 'uncounted'),
    defaultValue: 'uncounted'
  },
  // Adjustment info
  adjustmentApplied: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  adjustmentNotes: {
    type: DataTypes.TEXT
  },
  countedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  countedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'stock_count_items',
  timestamps: true,
  indexes: [
    { fields: ['stockCountId'] },
    { fields: ['tenantId'] },
    { fields: ['productId'] },
    { fields: ['varianceType'] }
  ]
});

module.exports = StockCountItem;
