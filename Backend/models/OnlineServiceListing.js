const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const OnlineServiceListing = sequelize.define('OnlineServiceListing', {
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
  studioLocationId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'studio_locations',
      key: 'id',
    },
  },
  pricingTemplateId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'pricing_templates',
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
  category: {
    type: DataTypes.STRING(120),
    allowNull: true,
  },
  ctaType: {
    type: DataTypes.ENUM('request_quote', 'book_service', 'fixed_price'),
    allowNull: false,
    defaultValue: 'request_quote',
  },
  priceType: {
    type: DataTypes.ENUM('starting_from', 'fixed', 'quote_only'),
    allowNull: false,
    defaultValue: 'starting_from',
  },
  startingPrice: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
  },
  compareAtPrice: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true,
  },
  durationMinutes: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  turnaroundLabel: {
    type: DataTypes.STRING(80),
    allowNull: true,
  },
  images: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
  pickupEnabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  },
  deliveryEnabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
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
  tableName: 'online_service_listings',
  timestamps: true,
  indexes: [
    { fields: ['tenantId'] },
    { fields: ['studioLocationId'] },
    { fields: ['pricingTemplateId'] },
    { fields: ['status'] },
    { fields: ['category'] },
    { fields: ['sortOrder'] },
    { unique: true, fields: ['tenantId', 'slug'] },
  ],
});

module.exports = OnlineServiceListing;
