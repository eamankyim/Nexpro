const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const OnlineProductListing = sequelize.define('OnlineProductListing', {
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
  shopId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'shops',
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
  status: {
    type: DataTypes.ENUM('draft', 'published', 'hidden'),
    allowNull: false,
    defaultValue: 'draft',
  },
  title: {
    type: DataTypes.STRING(180),
    allowNull: false,
  },
  slug: {
    type: DataTypes.STRING(120),
    allowNull: false,
  },
  shortDescription: {
    type: DataTypes.STRING(280),
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  salesCopy: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  publicPrice: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  compareAtPrice: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
  },
  images: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
  inventoryPolicy: {
    type: DataTypes.STRING(40),
    allowNull: false,
    defaultValue: 'track',
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  publishedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
}, {
  tableName: 'online_product_listings',
  timestamps: true,
  indexes: [
    { fields: ['tenantId'] },
    { fields: ['shopId'] },
    { fields: ['productId'] },
    { fields: ['status'] },
    { fields: ['sortOrder'] },
    { unique: true, fields: ['tenantId', 'slug'] },
    { unique: true, fields: ['tenantId', 'productId', 'productVariantId'] },
  ],
});

module.exports = OnlineProductListing;
