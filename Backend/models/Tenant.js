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
    type: DataTypes.ENUM('printing_press', 'shop', 'pharmacy'),
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
  }
}, {
  tableName: 'tenants',
  timestamps: true
});

module.exports = Tenant;


