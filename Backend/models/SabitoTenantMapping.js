const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SabitoTenantMapping = sequelize.define('SabitoTenantMapping', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  sabitoBusinessId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    field: 'sabito_business_id'
  },
  nexproTenantId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'nexpro_tenant_id',
    references: {
      model: 'tenants',
      key: 'id'
    }
  },
  businessName: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'business_name'
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {}
  }
}, {
  tableName: 'sabito_tenant_mappings',
  timestamps: true
});

module.exports = SabitoTenantMapping;




