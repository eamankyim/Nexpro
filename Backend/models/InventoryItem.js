const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InventoryItem = sequelize.define('InventoryItem', {
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
  sku: {
    type: DataTypes.STRING
    // Unique per tenant via migration idx_inventory_items_tenant_sku
  },
  description: {
    type: DataTypes.TEXT
  },
  categoryId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'inventory_categories',
      key: 'id'
    }
  },
  unit: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pcs'
  },
  quantityOnHand: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  },
  reorderLevel: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  },
  preferredVendorId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'vendors',
      key: 'id'
    }
  },
  unitCost: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  },
  location: {
    type: DataTypes.STRING
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
  tableName: 'inventory_items',
  timestamps: true,
  indexes: [
    { fields: ['tenantId'] },
    {
      unique: true,
      fields: ['tenantId', 'sku'],
      where: { sku: { [require('sequelize').Op.ne]: null } }
    }
  ]
});

module.exports = InventoryItem;






