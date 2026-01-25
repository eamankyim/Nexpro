const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Drug = sequelize.define('Drug', {
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
  pharmacyId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'pharmacies',
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  genericName: {
    type: DataTypes.STRING
  },
  brandName: {
    type: DataTypes.STRING
  },
  sku: {
    type: DataTypes.STRING
  },
  barcode: {
    type: DataTypes.STRING
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
  // Drug classification
  drugType: {
    type: DataTypes.ENUM('prescription', 'otc', 'controlled', 'herbal', 'supplement'),
    allowNull: false,
    defaultValue: 'otc'
  },
  schedule: {
    type: DataTypes.ENUM('I', 'II', 'III', 'IV', 'V', 'N/A'),
    allowNull: true
  },
  // Pricing
  costPrice: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  },
  sellingPrice: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0
  },
  // Stock management
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
  unit: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'pcs'
  },
  // Drug details
  strength: {
    type: DataTypes.STRING // e.g., "500mg", "10ml"
  },
  form: {
    type: DataTypes.STRING // e.g., "Tablet", "Capsule", "Syrup", "Injection"
  },
  manufacturer: {
    type: DataTypes.STRING
  },
  supplier: {
    type: DataTypes.STRING
  },
  // Expiry tracking
  expiryDate: {
    type: DataTypes.DATEONLY
  },
  batchNumber: {
    type: DataTypes.STRING
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
  tableName: 'drugs',
  timestamps: true,
  indexes: [
    {
      fields: ['tenantId']
    },
    {
      fields: ['pharmacyId']
    },
    {
      fields: ['categoryId']
    },
    {
      fields: ['drugType']
    },
    {
      unique: true,
      fields: ['tenantId', 'sku'],
      where: {
        sku: { [require('sequelize').Op.ne]: null }
      }
    },
    {
      fields: ['barcode']
    },
    {
      fields: ['expiryDate']
    }
  ]
});

module.exports = Drug;
