const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

/**
 * StockCount Model
 * Records physical stock counts for inventory reconciliation
 */
const StockCount = sequelize.define('StockCount', {
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
    }
  },
  shopId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'shops',
      key: 'id'
    }
  },
  // Count session info
  countNumber: {
    type: DataTypes.STRING,
    allowNull: false
  },
  countDate: {
    type: DataTypes.DATE,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('draft', 'in_progress', 'completed', 'approved', 'cancelled'),
    allowNull: false,
    defaultValue: 'draft'
  },
  countType: {
    type: DataTypes.ENUM('full', 'partial', 'cycle', 'spot'),
    allowNull: false,
    defaultValue: 'full'
  },
  // Summary stats (calculated when completed)
  totalProducts: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  countedProducts: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  matchedProducts: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  varianceProducts: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  totalVarianceValue: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0
  },
  totalShrinkageValue: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0
  },
  totalOverageValue: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0
  },
  // Who performed the count
  countedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  approvedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  approvedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'stock_counts',
  timestamps: true,
  indexes: [
    { fields: ['tenantId'] },
    { fields: ['shopId'] },
    { fields: ['countDate'] },
    { fields: ['status'] }
  ]
});

module.exports = StockCount;
