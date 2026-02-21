const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Equipment = sequelize.define('Equipment', {
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
  categoryId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'equipment_categories',
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
  purchaseDate: {
    type: DataTypes.DATEONLY
  },
  purchaseValue: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  },
  location: {
    type: DataTypes.STRING
  },
  serialNumber: {
    type: DataTypes.STRING
  },
  status: {
    type: DataTypes.ENUM('active', 'disposed', 'sold'),
    allowNull: false,
    defaultValue: 'active'
  },
  vendorId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'vendors',
      key: 'id'
    }
  },
  notes: {
    type: DataTypes.TEXT
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'equipment',
  timestamps: true,
  indexes: [
    { fields: ['tenantId'] },
    { fields: ['categoryId'] },
    { fields: ['status'] },
    { fields: ['vendorId'] }
  ]
});

module.exports = Equipment;
