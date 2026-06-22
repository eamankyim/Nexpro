const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Dealer = sequelize.define('Dealer', {
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
  businessName: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  contactName: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  phone: {
    type: DataTypes.STRING(40),
    allowNull: true,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: { isEmail: true },
  },
  creditTerms: {
    type: DataTypes.STRING(120),
    allowNull: true,
  },
  creditLimit: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
  },
  balance: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
  },
  priceTierId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: { model: 'dealer_price_tiers', key: 'id' },
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
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
  tableName: 'dealers',
  timestamps: true,
  indexes: [
    { fields: ['tenantId'] },
    { fields: ['tenantId', 'shopId'] },
    { fields: ['tenantId', 'shopId', 'isActive'] },
    {
      unique: true,
      fields: ['tenantId', 'shopId', 'businessName'],
      name: 'uq_dealers_tenant_shop_business_name',
    },
  ],
  hooks: {
    beforeCreate: (dealer) => {
      if (dealer.email && typeof dealer.email === 'string') {
        dealer.email = dealer.email.trim().toLowerCase();
      }
    },
    beforeUpdate: (dealer) => {
      if (dealer.changed('email') && dealer.email && typeof dealer.email === 'string') {
        dealer.email = dealer.email.trim().toLowerCase();
      }
    },
  },
});

module.exports = Dealer;
