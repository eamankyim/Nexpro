const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PrescriptionItem = sequelize.define('PrescriptionItem', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  prescriptionId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'prescriptions',
      key: 'id',
      onDelete: 'CASCADE'
    }
  },
  drugId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'drugs',
      key: 'id'
    }
  },
  drugName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  strength: {
    type: DataTypes.STRING
  },
  form: {
    type: DataTypes.STRING
  },
  quantity: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 1
  },
  quantityFilled: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  },
  unit: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pcs'
  },
  dosage: {
    type: DataTypes.STRING // e.g., "1 tablet twice daily"
  },
  duration: {
    type: DataTypes.STRING // e.g., "7 days"
  },
  instructions: {
    type: DataTypes.TEXT
  },
  unitPrice: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  },
  totalPrice: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  },
  status: {
    type: DataTypes.ENUM('pending', 'filled', 'partially_filled', 'unavailable', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending'
  },
  notes: {
    type: DataTypes.TEXT
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {}
  }
}, {
  tableName: 'prescription_items',
  timestamps: true,
  indexes: [
    {
      fields: ['prescriptionId']
    },
    {
      fields: ['drugId']
    },
    {
      fields: ['status']
    }
  ]
});

module.exports = PrescriptionItem;
