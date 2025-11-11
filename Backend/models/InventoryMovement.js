const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InventoryMovement = sequelize.define('InventoryMovement', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  itemId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'inventory_items',
      key: 'id'
    }
  },
  type: {
    type: DataTypes.ENUM('purchase', 'usage', 'adjustment', 'return', 'transfer'),
    allowNull: false
  },
  quantityDelta: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  previousQuantity: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  newQuantity: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false
  },
  unitCost: {
    type: DataTypes.DECIMAL(12, 2)
  },
  reference: {
    type: DataTypes.STRING
  },
  notes: {
    type: DataTypes.TEXT
  },
  jobId: {
    type: DataTypes.UUID,
    references: {
      model: 'jobs',
      key: 'id'
    }
  },
  createdBy: {
    type: DataTypes.UUID,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  occurredAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'inventory_movements',
  timestamps: true
});

module.exports = InventoryMovement;






