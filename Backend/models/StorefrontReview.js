const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const StorefrontReview = sequelize.define('StorefrontReview', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  reviewType: {
    type: DataTypes.ENUM('store', 'product', 'service'),
    allowNull: false,
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
    allowNull: true,
    references: {
      model: 'online_product_listings',
      key: 'id',
    },
  },
  serviceListingId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'online_service_listings',
      key: 'id',
    },
  },
  studioLocationId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'studio_locations',
      key: 'id',
    },
  },
  jobId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'jobs',
      key: 'id',
    },
  },
  productId: {
    type: DataTypes.UUID,
    allowNull: true,
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
  saleId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'sales',
      key: 'id',
    },
  },
  saleItemId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'sale_items',
      key: 'id',
    },
  },
  rating: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 5,
    },
  },
  title: {
    type: DataTypes.STRING(120),
    allowNull: true,
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('published', 'hidden', 'removed'),
    allowNull: false,
    defaultValue: 'published',
  },
  verifiedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
}, {
  tableName: 'storefront_reviews',
  timestamps: true,
  indexes: [
    { fields: ['reviewType'] },
    { fields: ['storefrontCustomerId'] },
    { fields: ['tenantId'] },
    { fields: ['shopId'] },
    { fields: ['listingId'] },
    { fields: ['serviceListingId'] },
    { fields: ['jobId'] },
    { fields: ['studioLocationId'] },
    { fields: ['productId'] },
    { fields: ['saleId'] },
    { fields: ['status'] },
  ],
});

module.exports = StorefrontReview;
