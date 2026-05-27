const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const StockTransfer = sequelize.define('StockTransfer', {
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
  sourceShopId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'shops',
      key: 'id',
    },
  },
  destinationShopId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'shops',
      key: 'id',
    },
  },
  sourceProductId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'products',
      key: 'id',
    },
  },
  destinationProductId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'products',
      key: 'id',
    },
  },
  sourceVariantId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'product_variants',
      key: 'id',
    },
  },
  destinationVariantId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'product_variants',
      key: 'id',
    },
  },
  quantity: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  unit: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pcs',
  },
  status: {
    type: DataTypes.ENUM('completed', 'cancelled'),
    allowNull: false,
    defaultValue: 'completed',
  },
  sourceBeforeQuantity: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  sourceAfterQuantity: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  destinationBeforeQuantity: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  destinationAfterQuantity: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  reason: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
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
  metadata: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
}, {
  tableName: 'stock_transfers',
  timestamps: true,
  indexes: [
    { fields: ['tenantId'] },
    { fields: ['sourceShopId'] },
    { fields: ['destinationShopId'] },
    { fields: ['sourceProductId'] },
    { fields: ['destinationProductId'] },
    { fields: ['sourceVariantId'] },
    { fields: ['destinationVariantId'] },
    { fields: ['createdAt'] },
  ],
});

module.exports = StockTransfer;
