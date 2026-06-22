const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DealerProductPrice = sequelize.define('DealerProductPrice', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  tenantId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'tenants', key: 'id' },
  },
  shopId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'shops', key: 'id' },
  },
  dealerId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'dealers', key: 'id' },
  },
  priceTierId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'dealer_price_tiers', key: 'id' },
  },
  productId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'products', key: 'id' },
  },
  productVariantId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'product_variants', key: 'id' },
  },
  unitPrice: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
}, {
  tableName: 'dealer_product_prices',
  timestamps: true,
  indexes: [
    { fields: ['tenantId', 'shopId', 'productId'] },
  ],
});

module.exports = DealerProductPrice;
