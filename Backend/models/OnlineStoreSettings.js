const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const OnlineStoreSettings = sequelize.define('OnlineStoreSettings', {
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
  enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  slug: {
    type: DataTypes.STRING(80),
    allowNull: false,
  },
  displayName: {
    type: DataTypes.STRING(160),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  logoUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  bannerImageUrl: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  primaryColor: {
    type: DataTypes.STRING(24),
    allowNull: false,
    defaultValue: '#166534',
  },
  contactPhone: {
    type: DataTypes.STRING(40),
    allowNull: true,
  },
  whatsappNumber: {
    type: DataTypes.STRING(40),
    allowNull: true,
  },
  contactEmail: {
    type: DataTypes.STRING(160),
    allowNull: true,
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
  deliveryFee: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
  },
  currency: {
    type: DataTypes.STRING(8),
    allowNull: false,
    defaultValue: 'GHS',
  },
  setupCompletedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
}, {
  tableName: 'online_store_settings',
  timestamps: true,
  indexes: [
    { fields: ['tenantId'] },
    { fields: ['shopId'] },
    { unique: true, fields: ['slug'] },
    { fields: ['enabled'] },
  ],
});

module.exports = OnlineStoreSettings;
