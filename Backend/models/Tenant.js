const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Tenant = sequelize.define('Tenant', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(150),
    allowNull: false
  },
  slug: {
    type: DataTypes.STRING(150),
    allowNull: false,
    unique: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'active'
  },
  plan: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'trial'
  },
  businessType: {
    type: DataTypes.ENUM('shop', 'studio', 'pharmacy', 'printing_press', 'mechanic', 'barber', 'salon'),
    allowNull: true,
    defaultValue: null
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  },
  trialEndsAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  billingCustomerId: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  paystackSubaccountCode: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Paystack subaccount code (ACCT_xxx) for POS payment splits'
  },
  categoriesSeeded: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Whether default categories have been seeded for this tenant'
  },
  accountsSeeded: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Whether default chart of accounts has been seeded for this tenant'
  },
  equipmentCategoriesSeeded: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Whether default equipment categories have been seeded for this tenant'
  }
}, {
  tableName: 'tenants',
  timestamps: true
});

module.exports = Tenant;


