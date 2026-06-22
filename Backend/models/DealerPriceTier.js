const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DealerPriceTier = sequelize.define('DealerPriceTier', {
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
  name: {
    type: DataTypes.STRING(120),
    allowNull: false,
  },
  description: {
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
  tableName: 'dealer_price_tiers',
  timestamps: true,
  indexes: [{ fields: ['tenantId'] }],
});

module.exports = DealerPriceTier;
