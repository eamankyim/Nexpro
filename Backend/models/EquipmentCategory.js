const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const EquipmentCategory = sequelize.define('EquipmentCategory', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  tenantId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'tenants',
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'equipment_categories',
  timestamps: true,
  indexes: [
    { fields: ['tenantId'] },
    { unique: true, fields: ['tenantId', 'name'] }
  ]
});

module.exports = EquipmentCategory;
