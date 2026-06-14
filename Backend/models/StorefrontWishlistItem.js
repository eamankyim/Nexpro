const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const StorefrontWishlistItem = sequelize.define('StorefrontWishlistItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  storefrontCustomerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'storefront_customers',
      key: 'id',
    },
  },
  tenantId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'tenants',
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
  listingId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'online_product_listings',
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
  metadata: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
}, {
  tableName: 'storefront_wishlist_items',
  timestamps: true,
  indexes: [
    { fields: ['storefrontCustomerId'] },
    { fields: ['tenantId'] },
    { fields: ['shopId'] },
    { fields: ['listingId'] },
    { unique: true, fields: ['storefrontCustomerId', 'listingId'] },
  ],
});

module.exports = StorefrontWishlistItem;
